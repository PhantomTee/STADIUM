// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IConvictionHookMultiplier {
    function getConvictionMultiplier(address user, string memory team) external view returns (uint256);
}

interface IChampionPoolDeposit {
    function recordDeposit(uint256 amount) external;
}

/// @notice Handles all VAR prediction market logic for all 4 markets per match
contract VARMarket is ReentrancyGuard {
    // ────────────────────────────── Types ──────────────────────────────

    uint8 public constant MARKET_MATCH_WINNER = 0;
    uint8 public constant MARKET_FIRST_GOAL = 1;
    uint8 public constant MARKET_RED_CARD = 2;
    uint8 public constant MARKET_EXTRA_TIME = 3;

    struct MarketInfo {
        uint256 matchId;
        uint8 marketType;
        bool open;
        bool settled;
        string correctOutcome;
        uint256 totalYesPool;
        uint256 totalNoPool;
    }

    struct Position {
        uint256 amount;
        string outcome;
        bool settled;
        uint256 refundOrPayout;
    }

    // ────────────────────────────── State ──────────────────────────────

    IERC20 public immutable usdc;

    address public oracle;
    address public convictionHook;
    address public treasury;
    address public championPool;

    // matchId => marketType => MarketInfo
    mapping(uint256 => mapping(uint8 => MarketInfo)) public markets;
    // matchId => marketType => user => yes amount
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public yesAmounts;
    // matchId => marketType => user => no amount
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public noAmounts;
    // matchId => marketType => position list (for iteration)
    mapping(uint256 => mapping(uint8 => address[])) public marketParticipants;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public hasParticipated;

    // matchId => teamA name (stored when market opens)
    mapping(uint256 => string) public matchTeamA;
    mapping(uint256 => string) public matchTeamB;

    // ────────────────────────────── Events ──────────────────────────────

    event BetPlaced(
        uint256 indexed matchId,
        uint8 marketType,
        address indexed user,
        string outcome,
        uint256 amount
    );
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
        usdc = IERC20(_usdc);
        oracle = _oracle;
        convictionHook = _convictionHook;
        treasury = _treasury;
        championPool = _championPool;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "VARMarket: not oracle");
        _;
    }

    // ────────────────────────────── Oracle Functions ──────────────────────────────

    function openMarkets(uint256 matchId) external onlyOracle {
        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].matchId = matchId;
            markets[matchId][i].marketType = i;
            markets[matchId][i].open = true;
            markets[matchId][i].settled = false;
        }
        emit MarketsOpened(matchId);
    }

    function openMarketsWithTeams(
        uint256 matchId,
        string memory teamA,
        string memory teamB
    ) external onlyOracle {
        matchTeamA[matchId] = teamA;
        matchTeamB[matchId] = teamB;
        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].matchId = matchId;
            markets[matchId][i].marketType = i;
            markets[matchId][i].open = true;
            markets[matchId][i].settled = false;
        }
        emit MarketsOpened(matchId);
    }

    function closeMarkets(uint256 matchId) external onlyOracle {
        for (uint8 i = 0; i < 4; i++) {
            markets[matchId][i].open = false;
        }
        emit MarketsClosed(matchId);
    }

    /// @notice Settle a specific market and distribute funds
    function settleMarket(
        uint256 matchId,
        uint8 marketType,
        string memory correctOutcome
    ) external onlyOracle nonReentrant {
        MarketInfo storage market = markets[matchId][marketType];
        if (market.settled) return; // idempotent
        market.settled = true;
        market.correctOutcome = correctOutcome;

        bytes32 outcomeHash = keccak256(bytes(correctOutcome));

        address[] memory participants = marketParticipants[matchId][marketType];

        // Compute losing pool total and winner count
        uint256 losingPoolTotal = 0;
        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            uint256 yes = yesAmounts[matchId][marketType][p];
            uint256 no = noAmounts[matchId][marketType][p];
            // "yes" side = outcome matches correctOutcome
            if (_isYesSide(marketType, outcomeHash)) {
                losingPoolTotal += no;
            } else {
                losingPoolTotal += yes;
            }
        }

        // 90% of losing pool goes to redistribution
        uint256 losersNinety = losingPoolTotal * 90 / 100;
        uint256 toWinnersPool = losersNinety * 45 / 100;
        uint256 toChampPool = losersNinety * 25 / 100;
        uint256 toTreasury = losersNinety - toWinnersPool - toChampPool; // ~20%

        // Total winning pool (original bets on correct side)
        uint256 totalWinningPool = _isYesSide(marketType, outcomeHash)
            ? market.totalYesPool
            : market.totalNoPool;

        // Send to champion pool
        if (toChampPool > 0 && championPool != address(0)) {
            usdc.transfer(championPool, toChampPool);
        }

        // Send to treasury
        if (toTreasury > 0) {
            usdc.transfer(treasury, toTreasury);
        }

        // Process each participant
        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            bool isWinner = _isParticipantWinner(matchId, marketType, p, outcomeHash);

            if (isWinner) {
                uint256 betAmount = _isYesSide(marketType, outcomeHash)
                    ? yesAmounts[matchId][marketType][p]
                    : noAmounts[matchId][marketType][p];

                if (betAmount == 0 || totalWinningPool == 0) continue;

                uint256 winnerShare = (betAmount * toWinnersPool) / totalWinningPool;
                uint256 netWinnings = winnerShare;

                // Apply conviction multiplier
                uint256 multiplier = 100;
                if (convictionHook != address(0)) {
                    string memory relevantTeam = _getRelevantTeam(matchId, marketType, correctOutcome);
                    if (bytes(relevantTeam).length > 0) {
                        multiplier = IConvictionHookMultiplier(convictionHook).getConvictionMultiplier(
                            p,
                            relevantTeam
                        );
                    }
                }

                uint256 bonusWinnings = netWinnings * multiplier / 100;
                uint256 totalPayout = betAmount + bonusWinnings;

                usdc.transfer(p, totalPayout);
                emit PayoutSent(p, totalPayout);
            } else {
                // Loser gets 10% refund
                uint256 lostAmount = _isYesSide(marketType, outcomeHash)
                    ? noAmounts[matchId][marketType][p]
                    : yesAmounts[matchId][marketType][p];

                if (lostAmount == 0) continue;

                uint256 refund = lostAmount * 10 / 100;
                if (refund > 0) {
                    usdc.transfer(p, refund);
                    emit RefundSent(p, refund);
                }
            }
        }

        emit MarketSettled(matchId, marketType, correctOutcome);
    }

    // ────────────────────────────── User Functions ──────────────────────────────

    function placeBet(
        uint256 matchId,
        uint8 marketType,
        string memory outcome,
        uint256 amount
    ) external nonReentrant {
        require(marketType < 4, "VARMarket: invalid market type");
        MarketInfo storage market = markets[matchId][marketType];
        require(market.open, "VARMarket: market not open");
        require(amount > 0, "VARMarket: zero amount");
        require(_isValidOutcome(marketType, outcome), "VARMarket: invalid outcome");

        usdc.transferFrom(msg.sender, address(this), amount);

        if (!hasParticipated[matchId][marketType][msg.sender]) {
            hasParticipated[matchId][marketType][msg.sender] = true;
            marketParticipants[matchId][marketType].push(msg.sender);
        }

        bytes32 outcomeHash = keccak256(bytes(outcome));
        if (_isYesSide(marketType, outcomeHash) || _isOutcomeTeamA(outcomeHash, matchId)) {
            yesAmounts[matchId][marketType][msg.sender] += amount;
            market.totalYesPool += amount;
        } else {
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
        uint8 marketType,
        address user
    ) external view returns (uint256 yes, uint256 no) {
        return (yesAmounts[matchId][marketType][user], noAmounts[matchId][marketType][user]);
    }

    function getParticipantCount(uint256 matchId, uint8 marketType) external view returns (uint256) {
        return marketParticipants[matchId][marketType].length;
    }

    // ────────────────────────────── Internal Helpers ──────────────────────────────

    /// @dev For binary markets (RED_CARD, EXTRA_TIME), "YES" is the yes-side
    ///      For MATCH_WINNER and FIRST_GOAL, teamA outcome is the "yes-side"
    function _isYesSide(uint8 marketType, bytes32 outcomeHash) internal pure returns (bool) {
        if (marketType == MARKET_RED_CARD || marketType == MARKET_EXTRA_TIME) {
            return outcomeHash == keccak256(bytes("YES"));
        }
        // For match winner / first goal: "teamA" is yes-side
        return outcomeHash == keccak256(bytes("teamA"));
    }

    function _isOutcomeTeamA(bytes32 outcomeHash, uint256 /*matchId*/) internal pure returns (bool) {
        return outcomeHash == keccak256(bytes("teamA"));
    }

    function _isParticipantWinner(
        uint256 matchId,
        uint8 marketType,
        address p,
        bytes32 outcomeHash
    ) internal view returns (bool) {
        bool yesSide = _isYesSide(marketType, outcomeHash);
        if (yesSide) {
            return yesAmounts[matchId][marketType][p] > 0;
        } else {
            return noAmounts[matchId][marketType][p] > 0;
        }
    }

    function _isValidOutcome(uint8 marketType, string memory outcome) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(outcome));
        if (marketType == MARKET_RED_CARD || marketType == MARKET_EXTRA_TIME) {
            return h == keccak256(bytes("YES")) || h == keccak256(bytes("NO"));
        }
        if (marketType == MARKET_MATCH_WINNER) {
            return h == keccak256(bytes("teamA"))
                || h == keccak256(bytes("teamB"))
                || h == keccak256(bytes("draw"));
        }
        if (marketType == MARKET_FIRST_GOAL) {
            return h == keccak256(bytes("teamA"))
                || h == keccak256(bytes("teamB"))
                || h == keccak256(bytes("none"));
        }
        return false;
    }

    function _getRelevantTeam(
        uint256 matchId,
        uint8 marketType,
        string memory correctOutcome
    ) internal view returns (string memory) {
        if (marketType == MARKET_MATCH_WINNER || marketType == MARKET_FIRST_GOAL) {
            bytes32 h = keccak256(bytes(correctOutcome));
            if (h == keccak256(bytes("teamA"))) return matchTeamA[matchId];
            if (h == keccak256(bytes("teamB"))) return matchTeamB[matchId];
        }
        return "";
    }
}
