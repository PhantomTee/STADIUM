// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IConvictionHook {
    function settleElimination(string memory team) external;
    function settleChampion(string memory team) external;
}

interface IVARMarket {
    function openMarkets(uint256 matchId) external;
    function closeMarkets(uint256 matchId) external;
    function settleMarket(uint256 matchId, uint8 marketType, string memory correctOutcome) external;
}

interface IChampionPool {
    function distribute(string memory winningTeam) external;
}

/// @notice Admin-controlled oracle posting all World Cup match data on-chain
contract MatchOracle is Ownable {
    struct Match {
        uint256 matchId;
        string teamA;
        string teamB;
        uint256 kickoffTime;
        bool varOpen;
        bool varClosed;
        bool settled;
        string winner;       // "teamA", "teamB", or "draw"
        string firstGoal;    // "teamA", "teamB", or "none"
        bool redCard;
        bool extraTime;
        bool teamAEliminated;
        bool teamBEliminated;
    }

    mapping(uint256 => Match) public matches;
    uint256[] public matchIds;

    address public treasury;
    address public championPool;
    address public convictionHook;
    address public varMarket;

    event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 kickoffTime);
    event VAROpened(uint256 indexed matchId);
    event MatchStarted(uint256 indexed matchId);
    event ResultPosted(uint256 indexed matchId, string winner, string firstGoal, bool redCard, bool extraTime);
    event TeamEliminated(string teamName);
    event ChampionAnnounced(string teamName);

    constructor(address initialOwner, address _treasury) Ownable(initialOwner) {
        treasury = _treasury;
    }

    function setAddresses(address _convictionHook, address _varMarket, address _championPool) external onlyOwner {
        convictionHook = _convictionHook;
        varMarket = _varMarket;
        championPool = _championPool;
    }

    function createMatch(
        uint256 matchId,
        string memory teamA,
        string memory teamB,
        uint256 kickoffTime
    ) external onlyOwner {
        require(matches[matchId].matchId == 0, "Oracle: match exists");
        matches[matchId] = Match({
            matchId: matchId,
            teamA: teamA,
            teamB: teamB,
            kickoffTime: kickoffTime,
            varOpen: false,
            varClosed: false,
            settled: false,
            winner: "",
            firstGoal: "",
            redCard: false,
            extraTime: false,
            teamAEliminated: false,
            teamBEliminated: false
        });
        matchIds.push(matchId);
        emit MatchCreated(matchId, teamA, teamB, kickoffTime);
    }

    function openVARWindow(uint256 matchId) external onlyOwner {
        Match storage m = matches[matchId];
        require(m.matchId != 0, "Oracle: match not found");
        require(!m.varOpen, "Oracle: already open");
        require(!m.varClosed, "Oracle: already closed");
        m.varOpen = true;
        if (varMarket != address(0)) {
            IVARMarket(varMarket).openMarkets(matchId);
        }
        emit VAROpened(matchId);
    }

    function startMatch(uint256 matchId) external onlyOwner {
        Match storage m = matches[matchId];
        require(m.matchId != 0, "Oracle: match not found");
        require(m.varOpen, "Oracle: VAR not open");
        m.varOpen = false;
        m.varClosed = true;
        if (varMarket != address(0)) {
            IVARMarket(varMarket).closeMarkets(matchId);
        }
        emit MatchStarted(matchId);
    }

    function postResult(
        uint256 matchId,
        string memory winner,
        string memory firstGoal,
        bool redCard,
        bool extraTime
    ) external onlyOwner {
        Match storage m = matches[matchId];
        require(m.matchId != 0, "Oracle: match not found");
        require(!m.settled, "Oracle: already settled");
        m.winner = winner;
        m.firstGoal = firstGoal;
        m.redCard = redCard;
        m.extraTime = extraTime;
        m.settled = true;

        // Settle all 4 VAR markets
        if (varMarket != address(0)) {
            IVARMarket(varMarket).settleMarket(matchId, 0, winner);
            IVARMarket(varMarket).settleMarket(matchId, 1, firstGoal);
            IVARMarket(varMarket).settleMarket(matchId, 2, redCard ? "YES" : "NO");
            IVARMarket(varMarket).settleMarket(matchId, 3, extraTime ? "YES" : "NO");
        }

        emit ResultPosted(matchId, winner, firstGoal, redCard, extraTime);
    }

    function postElimination(string memory teamName) external onlyOwner {
        require(convictionHook != address(0), "Oracle: hook not set");
        IConvictionHook(convictionHook).settleElimination(teamName);
        emit TeamEliminated(teamName);
    }

    function postChampion(string memory teamName) external onlyOwner {
        require(convictionHook != address(0), "Oracle: hook not set");
        IConvictionHook(convictionHook).settleChampion(teamName);
        if (championPool != address(0)) {
            IChampionPool(championPool).distribute(teamName);
        }
        emit ChampionAnnounced(teamName);
    }

    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getMatchCount() external view returns (uint256) {
        return matchIds.length;
    }

    function getAllMatchIds() external view returns (uint256[] memory) {
        return matchIds;
    }
}
