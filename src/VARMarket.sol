// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IConvictionVault {
    /// @notice Returns 150 if user has active conviction on EITHER teamA or teamB, else 100.
    function getConvictionMultiplier(address user, uint16 teamA, uint16 teamB) external view returns (uint256);
}

interface IChampionPoolVAR {
    function recordDeposit(uint256 amount) external;
}

/// @notice VAR prediction market — completely rewritten with uint8 outcome enums,
///         uint16 teamIds, and pull-based claims (no payment loops in settleMarket).
///
/// Market types (MarketType enum, stored as uint8 index 0-3):
///   0 = MatchWinner  — valid outcomes: TEAM_A(1), TEAM_B(2), DRAW(3)
///   1 = FirstGoal    — valid outcomes: TEAM_A(1), TEAM_B(2), NO_GOAL(6)
///   2 = RedCard      — valid outcomes: YES(4), NO(5)
///   3 = ExtraTime    — valid outcomes: YES(4), NO(5)
///
/// Settlement distribution (percentages of losingPool):
///   10% → per-loser refund pool (10% of each loser's bet returned on claim)
///   45% → winners pool (distributed pro-rata weighted by conviction multiplier)
///   22.5% → champion pool
///   22.5% → treasury  (= remaining - toWinnersPool - toChampPool, absorbs rounding)
///   Total of remaining (90% of losingPool): 50 + 25 + 25 = 100% ✓
contract VARMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────── Outcome constants ───────────────────────────────

    uint8 public constant OUTCOME_NONE    = 0;  // unset / invalid
    uint8 public constant OUTCOME_TEAM_A  = 1;
    uint8 public constant OUTCOME_TEAM_B  = 2;
    uint8 public constant OUTCOME_DRAW    = 3;
    uint8 public constant OUTCOME_YES     = 4;
    uint8 public constant OUTCOME_NO      = 5;
    uint8 public constant OUTCOME_NO_GOAL = 6;

    // ─────────────────────────────── Market type constants ───────────────────────────────

    uint8 public constant MARKET_MATCH_WINNER = 0;
    uint8 public constant MARKET_FIRST_GOAL   = 1;
    uint8 public constant MARKET_RED_CARD     = 2;
    uint8 public constant MARKET_EXTRA_TIME   = 3;

    // ─────────────────────────────── Structs ───────────────────────────────

    struct MarketState {
        uint16  teamAId;
        uint16  teamBId;
        bool    open;
        bool    settled;
        uint8   correctOutcome;
        uint256 toWinnersPool;        // set at settlement
        uint256 totalWeightedWinning; // set at settlement (for share computation)
    }

    // ─────────────────────────────── State ───────────────────────────────

    IERC20 public immutable usdc;

    address public immutable oracle;
    address public immutable vault;      // IConvictionVault — for multiplier queries
    address public immutable treasury;
    address public immutable championPool;

    /// @notice matchId → marketType → market state
    mapping(uint256 => mapping(uint8 => MarketState)) public markets;

    /// @notice matchId → marketType → outcome → total USDC bet on that outcome
    mapping(uint256 => mapping(uint8 => mapping(uint8 => uint256))) public outcomePool;

    /// @notice Per-user bet amounts
    mapping(uint256 => mapping(uint8 => mapping(address => mapping(uint8 => uint256)))) public betAmount;

    /// @notice Conviction multiplier captured at bet time (100 or 150); last-write-wins per user per market
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public betMultiplier;

    /// @notice Whether the user has already participated in this market (for dedup in participants list)
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public hasParticipated;

    /// @notice Ordered participant list — iterated in settleMarket to compute totalWeightedWinning
    mapping(uint256 => mapping(uint8 => address[])) public participants;

    /// @notice Whether the user has already pulled their payout/refund for this market
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public claimed;

    /// @notice Per-user weighted contribution per outcome (amount * mult / 100 at bet time)
    mapping(uint256 => mapping(uint8 => mapping(address => mapping(uint8 => uint256)))) public betWeighted;
    /// @notice Running total weighted per outcome — pre-computed in placeBet, used in settleMarket
    mapping(uint256 => mapping(uint8 => mapping(uint8 => uint256))) public totalWeightedPerOutcome;

    // ─────────────────────────────── Events ───────────────────────────────

    event MarketsOpened(uint256 indexed matchId, uint16 teamAId, uint16 teamBId);
    event MarketsClosed(uint256 indexed matchId);
    event BetPlaced(uint256 indexed matchId, uint8 marketType, address indexed user, uint8 outcome, uint256 amount);
    event MarketSettled(uint256 indexed matchId, uint8 marketType, uint8 correctOutcome, uint256 toWinnersPool);
    event PayoutClaimed(address indexed user, uint256 indexed matchId, uint8 marketType, uint256 payout);
    // Backwards-compat alias
    event VARClaimed(address indexed user, uint256 indexed matchId, uint8 marketType, uint256 payout);
    /// @notice Emitted when toWinnersPool is redirected because nobody bet on the winning outcome.
    event NoWinnerFundsRouted(uint256 indexed matchId, uint8 marketType, uint256 amount);

    // ─────────────────────────────── Modifiers ───────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "VARMarket: not oracle");
        _;
    }

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(
        address _usdc,
        address _oracle,
        address _vault,
        address _treasury,
        address _championPool
    ) {
        require(_usdc         != address(0), "VARMarket: zero usdc");
        require(_oracle       != address(0), "VARMarket: zero oracle");
        require(_treasury     != address(0), "VARMarket: zero treasury");
        require(_championPool != address(0), "VARMarket: zero champPool");
        // _vault may be address(0) if vault not deployed yet; multiplier defaults to 100
        usdc         = IERC20(_usdc);
        oracle       = _oracle;
        vault        = _vault;
        treasury     = _treasury;
        championPool = _championPool;
    }

    // ─────────────────────────────── Oracle: open / close ───────────────────────────────

    /// @notice Open all 4 markets for a match and record the team IDs for multiplier lookups.
    function openMarketsWithTeams(
        uint256 matchId,
        uint16  teamAId,
        uint16  teamBId
    ) external onlyOracle {
        require(!markets[matchId][0].open,     "VARMarket: already open");
        require(!markets[matchId][0].settled,  "VARMarket: already settled");

        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].teamAId = teamAId;
            markets[matchId][i].teamBId = teamBId;
            markets[matchId][i].open    = true;
        }

        emit MarketsOpened(matchId, teamAId, teamBId);
    }

    /// @notice Close all 4 markets for a match (betting window ends).
    function closeMarkets(uint256 matchId) external onlyOracle {
        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].open = false;
        }
        emit MarketsClosed(matchId);
    }

    // ─────────────────────────────── Oracle: settle ───────────────────────────────

    /// @notice Settle a specific market. Computes totalWeightedWinning and
    ///         routes funds. Users pull payouts via claimVAR().
    ///
    /// Distribution of losingPool:
    ///   loserRefundPool = losingPool * 10 / 100           (10% — reserved for 10% refunds to losers)
    ///   remaining       = losingPool - loserRefundPool     (90% of losingPool)
    ///   toWinnersPool   = remaining * 50 / 100             (45% of losingPool → proportional to winners)
    ///   toChampPool     = remaining * 25 / 100             (22.5% of losingPool → champion pool)
    ///   toTreasury      = remaining - toWinnersPool - toChampPool  (22.5% of losingPool, absorbs dust)
    function settleMarket(
        uint256 matchId,
        uint8   marketType,
        uint8   correctOutcome
    ) external onlyOracle {
        require(marketType < 4,               "VARMarket: bad market type");
        require(_isValidOutcome(marketType, correctOutcome), "VARMarket: invalid outcome");

        MarketState storage m = markets[matchId][marketType];
        require(!m.settled, "VARMarket: already settled");
        require(!m.open,    "VARMarket: market still open");

        m.settled       = true;
        m.correctOutcome = correctOutcome;

        // ── Compute losingPool = sum of all non-winning outcome pools ──
        uint256 losingPool = 0;
        for (uint8 o = 1; o <= 6; o++) {
            if (o != correctOutcome) {
                losingPool += outcomePool[matchId][marketType][o];
            }
        }

        if (losingPool == 0) {
            // No losers — nothing to distribute; toWinnersPool stays 0
            emit MarketSettled(matchId, marketType, correctOutcome, 0);
            return;
        }

        // ── Split losingPool ──
        uint256 loserRefundPool = losingPool * 10 / 100;                             // 10% reserved for loser 10% refunds
        uint256 remaining       = losingPool - loserRefundPool;                      // 90% of losingPool
        uint256 toWinnersPool   = remaining * 50 / 100;                              // 45% of losingPool
        uint256 toChampPool     = remaining * 25 / 100;                              // 22.5% of losingPool
        uint256 toTreasury      = remaining - toWinnersPool - toChampPool;           // 22.5% of losingPool (absorbs dust)

        // ── Transfer champion pool share ──
        if (toChampPool > 0) {
            usdc.safeTransfer(championPool, toChampPool);
            IChampionPoolVAR(championPool).recordDeposit(toChampPool);
        }

        // ── Transfer treasury share ──
        if (toTreasury > 0) {
            usdc.safeTransfer(treasury, toTreasury);
        }

        // totalWeightedWinning was pre-computed incrementally in placeBet — no loop needed
        uint256 totalWeighted = totalWeightedPerOutcome[matchId][marketType][correctOutcome];

        // If nobody bet on the winning outcome toWinnersPool cannot be claimed; route to championPool.
        if (totalWeighted == 0 && toWinnersPool > 0) {
            usdc.safeTransfer(championPool, toWinnersPool);
            IChampionPoolVAR(championPool).recordDeposit(toWinnersPool);
            emit NoWinnerFundsRouted(matchId, marketType, toWinnersPool);
            toWinnersPool = 0;
        }

        // Store settled state for pull-based claims
        m.toWinnersPool        = toWinnersPool;
        m.totalWeightedWinning = totalWeighted;

        emit MarketSettled(matchId, marketType, correctOutcome, toWinnersPool);
    }

    // ─────────────────────────────── User: place bet ───────────────────────────────

    /// @notice Place a bet on a specific outcome for an open market.
    ///         The conviction multiplier is captured once per (user, market) — the highest
    ///         multiplier from any team relevant to the market is stored.
    function placeBet(
        uint256 matchId,
        uint8   marketType,
        uint8   outcome,
        uint256 amount
    ) external nonReentrant {
        require(marketType < 4, "VARMarket: invalid market type");
        MarketState storage m = markets[matchId][marketType];
        require(m.open,   "VARMarket: market not open");
        require(amount > 0, "VARMarket: zero amount");
        require(_isValidOutcome(marketType, outcome), "VARMarket: invalid outcome for market type");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Track participant list (deduplicated)
        if (!hasParticipated[matchId][marketType][msg.sender]) {
            hasParticipated[matchId][marketType][msg.sender] = true;
            participants[matchId][marketType].push(msg.sender);
        }

        // Capture conviction multiplier — relevant team depends on market type and outcome
        uint256 newMult = _getMultiplier(msg.sender, matchId, marketType, outcome, m.teamAId, m.teamBId);
        uint256 curMult = betMultiplier[matchId][marketType][msg.sender];
        // Keep the higher multiplier (150 beats 100)
        if (newMult > curMult) {
            betMultiplier[matchId][marketType][msg.sender] = newMult;
        }

        // Update per-user and per-market-outcome tallies
        betAmount[matchId][marketType][msg.sender][outcome] += amount;
        outcomePool[matchId][marketType][outcome]           += amount;

        // Pre-compute weighted contribution for gas-free settle
        uint256 weighted = amount * newMult / 100;
        betWeighted[matchId][marketType][msg.sender][outcome] += weighted;
        totalWeightedPerOutcome[matchId][marketType][outcome] += weighted;

        emit BetPlaced(matchId, marketType, msg.sender, outcome, amount);
    }

    // ─────────────────────────────── User: claim ───────────────────────────────

    /// @notice Pull-based payout for a settled market.
    ///         Winners receive their bet back plus a pro-rata share of toWinnersPool
    ///         (weighted by conviction multiplier). Losers receive a 10% refund.
    function claimPayout(uint256 matchId, uint8 marketType) external nonReentrant {
        require(marketType < 4, "VARMarket: invalid market type");
        _doClaim(msg.sender, matchId, marketType);
    }

    /// @notice Backwards-compatible alias for claimPayout.
    function claimVAR(uint256 matchId, uint8 marketType) external nonReentrant {
        require(marketType < 4, "VARMarket: invalid market type");
        _doClaim(msg.sender, matchId, marketType);
    }

    function _doClaim(address caller, uint256 matchId, uint8 marketType) private {
        MarketState storage m = markets[matchId][marketType];
        require(m.settled, "VARMarket: market not settled");
        require(!claimed[matchId][marketType][caller], "VARMarket: already claimed");
        claimed[matchId][marketType][caller] = true;

        uint8   correct  = m.correctOutcome;
        uint256 winBet   = betAmount[matchId][marketType][caller][correct];
        uint256 loseBet  = 0;
        for (uint8 o = 1; o <= 6; o++) {
            if (o != correct) loseBet += betAmount[matchId][marketType][caller][o];
        }

        uint256 payout = 0;
        if (winBet > 0 && m.totalWeightedWinning > 0) {
            uint256 userWeighted = betWeighted[matchId][marketType][caller][correct];
            uint256 earnedShare  = userWeighted * m.toWinnersPool / m.totalWeightedWinning;
            payout += winBet + earnedShare;
        } else if (winBet > 0) {
            payout += winBet;
        }
        if (loseBet > 0) payout += loseBet * 10 / 100;

        if (payout > 0) usdc.safeTransfer(caller, payout);

        emit PayoutClaimed(caller, matchId, marketType, payout);
        emit VARClaimed(caller, matchId, marketType, payout);
    }

    // ─────────────────────────────── View functions ───────────────────────────────

    function getMarket(uint256 matchId, uint8 marketType) external view returns (MarketState memory) {
        return markets[matchId][marketType];
    }

    function getUserBet(uint256 matchId, uint8 marketType, address user, uint8 outcome)
        external view returns (uint256)
    {
        return betAmount[matchId][marketType][user][outcome];
    }

    function getOutcomePool(uint256 matchId, uint8 marketType, uint8 outcome)
        external view returns (uint256)
    {
        return outcomePool[matchId][marketType][outcome];
    }

    function getParticipantCount(uint256 matchId, uint8 marketType) external view returns (uint256) {
        return participants[matchId][marketType].length;
    }

    // ─────────────────────────────── Internal helpers ───────────────────────────────

    /// @dev Validate that an outcome is legal for the given market type.
    ///      MatchWinner (0): TEAM_A(1), TEAM_B(2), DRAW(3)
    ///      FirstGoal   (1): TEAM_A(1), TEAM_B(2), NO_GOAL(6)
    ///      RedCard     (2): YES(4), NO(5)
    ///      ExtraTime   (3): YES(4), NO(5)
    function _isValidOutcome(uint8 marketType, uint8 outcome) internal pure returns (bool) {
        if (marketType == MARKET_MATCH_WINNER) {
            return outcome == OUTCOME_TEAM_A || outcome == OUTCOME_TEAM_B || outcome == OUTCOME_DRAW;
        }
        if (marketType == MARKET_FIRST_GOAL) {
            return outcome == OUTCOME_TEAM_A || outcome == OUTCOME_TEAM_B || outcome == OUTCOME_NO_GOAL;
        }
        if (marketType == MARKET_RED_CARD || marketType == MARKET_EXTRA_TIME) {
            return outcome == OUTCOME_YES || outcome == OUTCOME_NO;
        }
        return false;
    }

    /// @dev Determine the conviction multiplier for a user on a given market.
    ///      For MatchWinner and FirstGoal: uses both team IDs so conviction on either team
    ///      qualifies for the 1.5× boost.
    ///      For other market types or draws/no-goal outcomes: returns 100 (no boost).
    function _getMultiplier(
        address user,
        uint256 /*matchId*/,
        uint8   marketType,
        uint8   outcome,
        uint16  teamAId,
        uint16  teamBId
    ) internal view returns (uint256) {
        if (vault == address(0)) return 100;
        if (marketType != MARKET_MATCH_WINNER && marketType != MARKET_FIRST_GOAL) return 100;

        // For team-specific outcomes, use both teamIds — conviction on either team qualifies
        if (outcome == OUTCOME_TEAM_A || outcome == OUTCOME_TEAM_B) {
            if (teamAId == 0 && teamBId == 0) return 100;
            return IConvictionVault(vault).getConvictionMultiplier(user, teamAId, teamBId);
        }

        return 100; // DRAW or NO_GOAL — no conviction boost
    }
}
