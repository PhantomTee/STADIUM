// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IConvictionHookMultiplier {
    function getConvictionMultiplier(address user, string memory team) external view returns (uint256);
}

interface IChampionPoolRecord {
    function recordDeposit(uint256 amount) external;
}

/// @notice Handles all VAR prediction market logic for all 4 markets per match.
///
/// Outcome routing:
///   MATCH_WINNER  (type 0): "teamA" → yesPool | "teamB" → noPool | "draw" → drawPool
///   FIRST_GOAL    (type 1): "teamA" → yesPool | "teamB" → noPool | "none" → drawPool
///   RED_CARD      (type 2): "YES"   → yesPool | "NO"   → noPool
///   EXTRA_TIME    (type 3): "YES"   → yesPool | "NO"   → noPool
///
/// Distribution on settlement (percentages of the total losingPool):
///   10% → per-loser refunds  |  45% → winners pool  |  25% → champion pool  |  20% → treasury
///
/// Conviction multiplier: applied as a weighted share — conviction holders receive a larger
/// proportion of the 45% winners pool without creating extra tokens.
contract VARMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ────────────────────────────── Constants ──────────────────────────────

    uint8 public constant MARKET_MATCH_WINNER = 0;
    uint8 public constant MARKET_FIRST_GOAL   = 1;
    uint8 public constant MARKET_RED_CARD     = 2;
    uint8 public constant MARKET_EXTRA_TIME   = 3;

    bytes32 private constant H_TEAM_A = keccak256(bytes("teamA"));
    bytes32 private constant H_TEAM_B = keccak256(bytes("teamB"));
    bytes32 private constant H_DRAW   = keccak256(bytes("draw"));
    bytes32 private constant H_NONE   = keccak256(bytes("none"));
    bytes32 private constant H_YES    = keccak256(bytes("YES"));
    bytes32 private constant H_NO     = keccak256(bytes("NO"));

    // ────────────────────────────── Types ──────────────────────────────

    struct MarketInfo {
        uint256 matchId;
        uint8   marketType;
        bool    open;
        bool    settled;
        string  correctOutcome;
        uint256 totalYesPool;   // teamA / YES bets
        uint256 totalNoPool;    // teamB / NO  bets
        uint256 totalDrawPool;  // draw / none bets (3-way markets only)
    }

    // ────────────────────────────── State ──────────────────────────────

    IERC20 public immutable usdc;

    address public immutable oracle;
    address public immutable convictionHook;
    address public immutable treasury;
    address public immutable championPool;

    // matchId → marketType → MarketInfo
    mapping(uint256 => mapping(uint8 => MarketInfo)) public markets;

    // Per-user bet amounts per outcome bucket
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public yesAmounts;
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public noAmounts;
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public drawAmounts;

    // Ordered participant list for iteration during settlement
    mapping(uint256 => mapping(uint8 => address[])) public marketParticipants;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public hasParticipated;

    // Team names stored at market-open time for conviction multiplier lookups
    mapping(uint256 => string) public matchTeamA;
    mapping(uint256 => string) public matchTeamB;

    // ────────────────────────────── Events ──────────────────────────────

    event BetPlaced(uint256 indexed matchId, uint8 marketType, address indexed user, string outcome, uint256 amount);
    event MarketSettled(uint256 indexed matchId, uint8 marketType, string correctOutcome);
    event RefundSent(address indexed user, uint256 amount);
    event PayoutSent(address indexed user, uint256 amount);
    event MarketsOpened(uint256 indexed matchId);
    event MarketsClosed(uint256 indexed matchId);

    // ────────────────────────────── Constructor ──────────────────────────────

    constructor(
        address _usdc,
        address _oracle,
        address _convictionHook,
        address _treasury,
        address _championPool
    ) {
        require(_usdc           != address(0), "VARMarket: zero usdc");
        require(_oracle         != address(0), "VARMarket: zero oracle");
        require(_treasury       != address(0), "VARMarket: zero treasury");
        require(_championPool   != address(0), "VARMarket: zero champPool");
        // convictionHook may legitimately be address(0) if multiplier not used
        usdc         = IERC20(_usdc);
        oracle       = _oracle;
        convictionHook = _convictionHook;
        treasury     = _treasury;
        championPool = _championPool;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "VARMarket: not oracle");
        _;
    }

    // ────────────────────────────── Oracle: open / close ──────────────────────────────

    /// @notice Open all 4 markets for a match and record team names for multiplier lookups
    function openMarketsWithTeams(
        uint256 matchId,
        string memory teamA,
        string memory teamB
    ) external onlyOracle {
        // Guard against double-open or re-opening a settled market
        require(!markets[matchId][0].open, "VARMarket: already open");
        require(!markets[matchId][0].settled, "VARMarket: already settled");

        matchTeamA[matchId] = teamA;
        matchTeamB[matchId] = teamB;

        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].matchId    = matchId;
            markets[matchId][i].marketType = i;
            markets[matchId][i].open       = true;
        }
        emit MarketsOpened(matchId);
    }

    /// @notice Legacy open (no team names) — kept for backward compat
    function openMarkets(uint256 matchId) external onlyOracle {
        require(!markets[matchId][0].open, "VARMarket: already open");
        require(!markets[matchId][0].settled, "VARMarket: already settled");
        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].matchId    = matchId;
            markets[matchId][i].marketType = i;
            markets[matchId][i].open       = true;
        }
        emit MarketsOpened(matchId);
    }

    function closeMarkets(uint256 matchId) external onlyOracle {
        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].open = false;
        }
        emit MarketsClosed(matchId);
    }

    // ────────────────────────────── Oracle: settle ──────────────────────────────

    /// @notice Settle a specific market. Idempotent.
    ///         Markets MUST be closed before settlement can happen.
    function settleMarket(
        uint256 matchId,
        uint8   marketType,
        string memory correctOutcome
    ) external onlyOracle nonReentrant {
        require(marketType < 4, "VARMarket: bad market type");
        MarketInfo storage market = markets[matchId][marketType];

        // Idempotent guard
        if (market.settled) return;

        // Market must be closed before settlement
        require(!market.open, "VARMarket: market still open");

        market.settled       = true;
        market.correctOutcome = correctOutcome;

        bytes32 outcomeHash = keccak256(bytes(correctOutcome));
        bool is3Way = (marketType == MARKET_MATCH_WINNER || marketType == MARKET_FIRST_GOAL);

        // ── Determine winner and loser pool totals ──
        (uint256 winningPool, uint256 losingPool) = _computePools(market, outcomeHash, is3Way);

        if (losingPool == 0) {
            // No losers — nothing to distribute; winners keep their bets (already in contract)
            // They can be recovered via a separate sweep, but for this protocol they stay as-is.
            emit MarketSettled(matchId, marketType, correctOutcome);
            return;
        }

        // ── Distribution (percentages of losingPool) ──
        // 45% to winners | 25% to champion pool | 20% to treasury | 10% refunded per loser
        uint256 toWinnersPool = losingPool * 45 / 100;
        uint256 toChampPool   = losingPool * 25 / 100;
        // Treasury absorbs remainder (handles integer rounding) ≈ 20%
        uint256 toTreasury    = losingPool - toWinnersPool - toChampPool - (losingPool * 10 / 100);

        // Send champion pool share (record for accounting)
        if (toChampPool > 0) {
            usdc.safeTransfer(championPool, toChampPool);
            IChampionPoolRecord(championPool).recordDeposit(toChampPool);
        }

        if (toTreasury > 0) {
            usdc.safeTransfer(treasury, toTreasury);
        }

        // ── First pass: compute total weighted winning shares (for conviction multiplier) ──
        address[] memory participants = marketParticipants[matchId][marketType];
        uint256 totalWeightedWinning = 0;

        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            uint256 winBet = _getWinningBet(matchId, marketType, p, outcomeHash);
            if (winBet == 0) continue;
            uint256 multiplier = _getMultiplier(p, matchId, marketType, correctOutcome);
            totalWeightedWinning += (winBet * multiplier) / 100;
        }

        // ── Second pass: pay winners and refund losers ──
        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            uint256 winBet  = _getWinningBet(matchId, marketType, p, outcomeHash);
            uint256 loseBet = _getLosingBet(matchId, marketType, p, outcomeHash);

            if (winBet > 0 && totalWeightedWinning > 0) {
                uint256 multiplier   = _getMultiplier(p, matchId, marketType, correctOutcome);
                uint256 weightedBet  = (winBet * multiplier) / 100;
                uint256 earnedShare  = (weightedBet * toWinnersPool) / totalWeightedWinning;
                uint256 totalPayout  = winBet + earnedShare;
                usdc.safeTransfer(p, totalPayout);
                emit PayoutSent(p, totalPayout);
            }

            if (loseBet > 0) {
                uint256 refund = loseBet * 10 / 100;
                if (refund > 0) {
                    usdc.safeTransfer(p, refund);
                    emit RefundSent(p, refund);
                }
            }
        }

        emit MarketSettled(matchId, marketType, correctOutcome);
    }

    // ────────────────────────────── User: place bet ──────────────────────────────

    function placeBet(
        uint256 matchId,
        uint8   marketType,
        string memory outcome,
        uint256 amount
    ) external nonReentrant {
        require(marketType < 4, "VARMarket: invalid market type");
        MarketInfo storage market = markets[matchId][marketType];
        require(market.open,   "VARMarket: market not open");
        require(amount > 0,    "VARMarket: zero amount");
        require(_isValidOutcome(marketType, outcome), "VARMarket: invalid outcome");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (!hasParticipated[matchId][marketType][msg.sender]) {
            hasParticipated[matchId][marketType][msg.sender] = true;
            marketParticipants[matchId][marketType].push(msg.sender);
        }

        bytes32 h = keccak256(bytes(outcome));
        if (h == H_TEAM_A || h == H_YES) {
            yesAmounts[matchId][marketType][msg.sender] += amount;
            market.totalYesPool += amount;
        } else if (h == H_DRAW || h == H_NONE) {
            drawAmounts[matchId][marketType][msg.sender] += amount;
            market.totalDrawPool += amount;
        } else {
            // teamB or NO
            noAmounts[matchId][marketType][msg.sender] += amount;
            market.totalNoPool += amount;
        }

        emit BetPlaced(matchId, marketType, msg.sender, outcome, amount);
    }

    // ────────────────────────────── View Functions ──────────────────────────────

    function getMarket(uint256 matchId, uint8 marketType) external view returns (MarketInfo memory) {
        return markets[matchId][marketType];
    }

    function getUserBet(
        uint256 matchId,
        uint8   marketType,
        address user
    ) external view returns (uint256 yes, uint256 no, uint256 draw) {
        return (
            yesAmounts[matchId][marketType][user],
            noAmounts[matchId][marketType][user],
            drawAmounts[matchId][marketType][user]
        );
    }

    function getParticipantCount(uint256 matchId, uint8 marketType) external view returns (uint256) {
        return marketParticipants[matchId][marketType].length;
    }

    // ────────────────────────────── Internal Helpers ──────────────────────────────

    function _computePools(
        MarketInfo storage market,
        bytes32 outcomeHash,
        bool is3Way
    ) internal view returns (uint256 winningPool, uint256 losingPool) {
        if (!is3Way) {
            // Binary: YES or NO
            if (outcomeHash == H_YES) {
                winningPool = market.totalYesPool;
                losingPool  = market.totalNoPool;
            } else {
                winningPool = market.totalNoPool;
                losingPool  = market.totalYesPool;
            }
        } else {
            // 3-way: teamA / teamB / draw|none
            if (outcomeHash == H_TEAM_A) {
                winningPool = market.totalYesPool;
                losingPool  = market.totalNoPool + market.totalDrawPool;
            } else if (outcomeHash == H_TEAM_B) {
                winningPool = market.totalNoPool;
                losingPool  = market.totalYesPool + market.totalDrawPool;
            } else {
                // draw or none
                winningPool = market.totalDrawPool;
                losingPool  = market.totalYesPool + market.totalNoPool;
            }
        }
    }

    function _getWinningBet(
        uint256 matchId,
        uint8   marketType,
        address user,
        bytes32 outcomeHash
    ) internal view returns (uint256) {
        if (outcomeHash == H_TEAM_A || outcomeHash == H_YES) {
            return yesAmounts[matchId][marketType][user];
        }
        if (outcomeHash == H_TEAM_B || outcomeHash == H_NO) {
            return noAmounts[matchId][marketType][user];
        }
        // draw or none
        return drawAmounts[matchId][marketType][user];
    }

    function _getLosingBet(
        uint256 matchId,
        uint8   marketType,
        address user,
        bytes32 outcomeHash
    ) internal view returns (uint256) {
        uint256 total = yesAmounts[matchId][marketType][user]
                      + noAmounts[matchId][marketType][user]
                      + drawAmounts[matchId][marketType][user];
        return total - _getWinningBet(matchId, marketType, user, outcomeHash);
    }

    /// @dev Returns the conviction multiplier (100 or 150) for a user given the winning outcome.
    ///      Only teamA/teamB wins in MATCH_WINNER / FIRST_GOAL markets yield a relevant team.
    function _getMultiplier(
        address user,
        uint256 matchId,
        uint8   marketType,
        string memory correctOutcome
    ) internal view returns (uint256) {
        if (convictionHook == address(0)) return 100;
        if (marketType != MARKET_MATCH_WINNER && marketType != MARKET_FIRST_GOAL) return 100;

        bytes32 h = keccak256(bytes(correctOutcome));
        string memory relevantTeam;
        if (h == H_TEAM_A) {
            relevantTeam = matchTeamA[matchId];
        } else if (h == H_TEAM_B) {
            relevantTeam = matchTeamB[matchId];
        } else {
            return 100; // draw/none win — no conviction team
        }

        if (bytes(relevantTeam).length == 0) return 100;
        return IConvictionHookMultiplier(convictionHook).getConvictionMultiplier(user, relevantTeam);
    }

    function _isValidOutcome(uint8 marketType, string memory outcome) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(outcome));
        if (marketType == MARKET_RED_CARD || marketType == MARKET_EXTRA_TIME) {
            return h == H_YES || h == H_NO;
        }
        if (marketType == MARKET_MATCH_WINNER) {
            return h == H_TEAM_A || h == H_TEAM_B || h == H_DRAW;
        }
        if (marketType == MARKET_FIRST_GOAL) {
            return h == H_TEAM_A || h == H_TEAM_B || h == H_NONE;
        }
        return false;
    }
}
