// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IConvictionHook {
    function settleElimination(string memory team) external;
    function settleChampion(string memory team) external;
}

interface IVARMarket {
    function openMarketsWithTeams(uint256 matchId, string memory teamA, string memory teamB) external;
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

    mapping(uint256 => Match) private _matches;
    mapping(uint256 => bool) private _matchExists;
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
        require(_treasury != address(0), "Oracle: zero treasury");
        treasury = _treasury;
    }

    function setAddresses(address _convictionHook, address _varMarket, address _championPool) external onlyOwner {
        require(_convictionHook != address(0), "Oracle: zero hook");
        require(_varMarket != address(0), "Oracle: zero varMarket");
        require(_championPool != address(0), "Oracle: zero champPool");
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
        require(matchId != 0, "Oracle: matchId cannot be 0");
        require(!_matchExists[matchId], "Oracle: match exists");
        require(bytes(teamA).length > 0 && bytes(teamB).length > 0, "Oracle: empty team name");
        require(kickoffTime > block.timestamp, "Oracle: kickoff in the past");

        _matchExists[matchId] = true;
        _matches[matchId] = Match({
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
        Match storage m = _matches[matchId];
        require(_matchExists[matchId], "Oracle: match not found");
        require(!m.varOpen, "Oracle: already open");
        require(!m.varClosed, "Oracle: already started");
        m.varOpen = true;
        if (varMarket != address(0)) {
            IVARMarket(varMarket).openMarketsWithTeams(matchId, m.teamA, m.teamB);
        }
        emit VAROpened(matchId);
    }

    function startMatch(uint256 matchId) external onlyOwner {
        Match storage m = _matches[matchId];
        require(_matchExists[matchId], "Oracle: match not found");
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
        Match storage m = _matches[matchId];
        require(_matchExists[matchId], "Oracle: match not found");
        require(m.varClosed, "Oracle: match not started yet");
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

    /// @notice Marks a team as eliminated and triggers their CONVICTION settlement.
    ///         The hook's own guard prevents double-elimination.
    function postElimination(string memory teamName) external onlyOwner {
        require(convictionHook != address(0), "Oracle: hook not set");
        IConvictionHook(convictionHook).settleElimination(teamName);
        emit TeamEliminated(teamName);
    }

    /// @notice Announces the tournament champion.
    ///         CRITICAL ORDER: ChampionPool.distribute() MUST be called BEFORE
    ///         ConvictionHook.settleChampion() to read non-zeroed deposits.
    function postChampion(string memory teamName) external onlyOwner {
        require(convictionHook != address(0), "Oracle: hook not set");

        // Step 1: distribute champion pool while convictionDeposit values are still set
        if (championPool != address(0)) {
            IChampionPool(championPool).distribute(teamName);
        }

        // Step 2: settle conviction (zeroes convictionDeposit for champion backers)
        IConvictionHook(convictionHook).settleChampion(teamName);

        emit ChampionAnnounced(teamName);
    }

    // ────────────────────────────── View ──────────────────────────────

    function getMatch(uint256 matchId) external view returns (Match memory) {
        require(_matchExists[matchId], "Oracle: match not found");
        return _matches[matchId];
    }

    function matchExists(uint256 matchId) external view returns (bool) {
        return _matchExists[matchId];
    }

    function getMatchCount() external view returns (uint256) {
        return matchIds.length;
    }

    function getAllMatchIds() external view returns (uint256[] memory) {
        return matchIds;
    }
}
