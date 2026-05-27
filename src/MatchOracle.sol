// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IConvictionVault {
    function registerTeam(uint16 teamId, string calldata name) external;
    function settleElimination(uint16 teamId) external;
    function setChampion(uint16 teamId) external;
}

interface IVARMarket {
    function openMarketsWithTeams(uint256 matchId, uint16 teamAId, uint16 teamBId) external;
    function closeMarkets(uint256 matchId) external;
    function settleMarket(uint256 matchId, uint8 marketType, uint8 correctOutcome) external;
}

interface IChampionPool {
    function setChampion(uint16 teamId) external;
}

/// @notice Admin-controlled oracle. Acts as team registry and posts all match data on-chain.
///         Uses uint16 teamId throughout; team names are kept for display and events.
///
/// Outcome constants (uint8) — mirror VARMarket:
///   1 = TEAM_A, 2 = TEAM_B, 3 = DRAW, 4 = YES, 5 = NO, 6 = NO_GOAL
///
/// CRITICAL ORDER in postChampion:
///   1. IChampionPool.setChampion() FIRST — snapshots pool balance while deposits intact
///   2. IConvictionVault.setChampion() SECOND — enables principal claims
contract MatchOracle is Ownable {

    // ─────────────────────────────── Enums ───────────────────────────────

    enum Stage {
        GROUP,
        ROUND_OF_32,
        ROUND_OF_16,
        QUARTER_FINAL,
        SEMI_FINAL,
        FINAL
    }

    // ─────────────────────────────── Structs ───────────────────────────────

    struct Team {
        uint16 teamId;
        string name;
        bool   registered;
        bool   eliminated;
        bool   champion;
    }

    struct Match {
        uint256 matchId;
        uint16  teamAId;
        uint16  teamBId;
        string  teamAName;          // kept for display / events
        string  teamBName;
        uint256 kickoffTime;
        bool    varOpen;
        bool    varClosed;
        bool    settled;
        uint8   winner;             // Outcome: TEAM_A(1), TEAM_B(2), DRAW(3)
        uint8   firstGoal;          // Outcome: TEAM_A(1), TEAM_B(2), NO_GOAL(6)
        bool    redCard;
        bool    extraTime;
        Stage   stage;              // Tournament stage for this match
        uint256 externalFixtureId;  // External API fixture ID for data syncing
    }

    // ─────────────────────────────── State ───────────────────────────────

    mapping(uint16 => Team)    public teams;
    uint16 public teamCount;

    mapping(uint256 => Match)  private _matches;
    mapping(uint256 => bool)   public matchExists;
    uint256[] public matchIds;

    address public convictionVault;
    address public varMarket;
    address public championPool;
    address public treasury;  // stored for reference; not called directly by oracle

    // ─────────────────────────────── Events ───────────────────────────────

    event TeamRegistered(uint16 indexed teamId, string name);
    event MatchCreated(uint256 indexed matchId, uint16 teamAId, uint16 teamBId, uint256 kickoffTime);
    event VAROpened(uint256 indexed matchId);
    event MatchStarted(uint256 indexed matchId);
    event ResultPosted(uint256 indexed matchId, uint8 winner, uint8 firstGoal, bool redCard, bool extraTime);
    event TeamEliminated(uint16 indexed teamId, string name);
    event ChampionAnnounced(uint16 indexed teamId, string name);

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(address initialOwner, address _treasury) Ownable(initialOwner) {
        require(_treasury != address(0), "Oracle: zero treasury");
        treasury = _treasury;
    }

    // ─────────────────────────────── Admin: wiring ───────────────────────────────

    function setAddresses(
        address _vault,
        address _varMarket,
        address _champPool
    ) external onlyOwner {
        require(_vault      != address(0), "Oracle: zero vault");
        require(_varMarket  != address(0), "Oracle: zero varMarket");
        require(_champPool  != address(0), "Oracle: zero champPool");
        convictionVault = _vault;
        varMarket       = _varMarket;
        championPool    = _champPool;
    }

    // ─────────────────────────────── Admin: team registry ───────────────────────────────

    /// @notice Register a team on-chain. Propagates to ConvictionVault so users can deposit.
    function registerTeam(uint16 teamId, string calldata name) external onlyOwner {
        require(!teams[teamId].registered, "Oracle: team already registered");
        require(bytes(name).length > 0,    "Oracle: empty name");

        teams[teamId] = Team({
            teamId:     teamId,
            name:       name,
            registered: true,
            eliminated: false,
            champion:   false
        });
        teamCount++;

        if (convictionVault != address(0)) {
            IConvictionVault(convictionVault).registerTeam(teamId, name);
        }

        emit TeamRegistered(teamId, name);
    }

    // ─────────────────────────────── Admin: match lifecycle ───────────────────────────────

    /// @notice Create a match entry. Both teams must be registered and kickoff must be in the future.
    function createMatch(
        uint256 matchId,
        uint16  teamAId,
        uint16  teamBId,
        uint256 kickoffTime
    ) external onlyOwner {
        _createMatch(matchId, teamAId, teamBId, kickoffTime, Stage.GROUP, 0);
    }

    /// @notice Create a match with an explicit stage.
    function createMatch(
        uint256 matchId,
        uint16  teamAId,
        uint16  teamBId,
        uint256 kickoffTime,
        Stage   stage
    ) external onlyOwner {
        _createMatch(matchId, teamAId, teamBId, kickoffTime, stage, 0);
    }

    /// @notice Create or update a match using an external fixture ID.
    ///         If matchId already exists, updates kickoffTime and stage only.
    ///         If matchId does not exist, creates it.
    function createOrUpdateMatch(
        uint256 externalFixtureId,
        uint256 matchId,
        uint16  teamAId,
        uint16  teamBId,
        uint256 kickoffTime,
        Stage   stage
    ) external onlyOwner {
        require(matchId != 0, "Oracle: matchId zero");

        if (matchExists[matchId]) {
            // Update mutable fields only — do not change teams or settled state
            Match storage m = _matches[matchId];
            m.kickoffTime        = kickoffTime;
            m.stage              = stage;
            m.externalFixtureId  = externalFixtureId;
        } else {
            _createMatch(matchId, teamAId, teamBId, kickoffTime, stage, externalFixtureId);
        }
    }

    /// @dev Internal: create a new match record.
    function _createMatch(
        uint256 matchId,
        uint16  teamAId,
        uint16  teamBId,
        uint256 kickoffTime,
        Stage   stage,
        uint256 externalFixtureId
    ) internal {
        require(matchId != 0,                    "Oracle: matchId zero");
        require(!matchExists[matchId],           "Oracle: match exists");
        require(teams[teamAId].registered,       "Oracle: teamA not registered");
        require(teams[teamBId].registered,       "Oracle: teamB not registered");
        require(kickoffTime > block.timestamp,   "Oracle: kickoff in the past");

        matchExists[matchId] = true;
        _matches[matchId] = Match({
            matchId:           matchId,
            teamAId:           teamAId,
            teamBId:           teamBId,
            teamAName:         teams[teamAId].name,
            teamBName:         teams[teamBId].name,
            kickoffTime:       kickoffTime,
            varOpen:           false,
            varClosed:         false,
            settled:           false,
            winner:            0,
            firstGoal:         0,
            redCard:           false,
            extraTime:         false,
            stage:             stage,
            externalFixtureId: externalFixtureId
        });
        matchIds.push(matchId);

        emit MatchCreated(matchId, teamAId, teamBId, kickoffTime);
    }

    /// @notice Open the VAR betting window for a match.
    function openVARWindow(uint256 matchId) external onlyOwner {
        require(matchExists[matchId],    "Oracle: match not found");
        Match storage m = _matches[matchId];
        require(!m.varOpen,              "Oracle: already open");
        require(!m.varClosed,            "Oracle: already started");

        m.varOpen = true;

        if (varMarket != address(0)) {
            IVARMarket(varMarket).openMarketsWithTeams(matchId, m.teamAId, m.teamBId);
        }

        emit VAROpened(matchId);
    }

    /// @notice Close the VAR betting window (match kicks off).
    function startMatch(uint256 matchId) external onlyOwner {
        require(matchExists[matchId],    "Oracle: match not found");
        Match storage m = _matches[matchId];
        require(m.varOpen,               "Oracle: VAR not open");
        require(!m.varClosed,            "Oracle: already started");

        m.varOpen   = false;
        m.varClosed = true;

        if (varMarket != address(0)) {
            IVARMarket(varMarket).closeMarkets(matchId);
        }

        emit MatchStarted(matchId);
    }

    /// @notice Post final match results and settle all 4 VAR markets.
    ///         winner / firstGoal are passed as uint8 outcome codes:
    ///           winner:    1=TEAM_A, 2=TEAM_B, 3=DRAW
    ///           firstGoal: 1=TEAM_A, 2=TEAM_B, 6=NO_GOAL
    ///         redCard / extraTime → YES(4) if true, NO(5) if false
    function postResult(
        uint256 matchId,
        uint8   winner,
        uint8   firstGoal,
        bool    redCard,
        bool    extraTime
    ) external onlyOwner {
        require(matchExists[matchId],    "Oracle: match not found");
        Match storage m = _matches[matchId];
        require(m.varClosed,             "Oracle: match not started yet");
        require(!m.settled,              "Oracle: already settled");

        m.winner    = winner;
        m.firstGoal = firstGoal;
        m.redCard   = redCard;
        m.extraTime = extraTime;
        m.settled   = true;

        if (varMarket != address(0)) {
            IVARMarket(varMarket).settleMarket(matchId, 0, winner);
            IVARMarket(varMarket).settleMarket(matchId, 1, firstGoal);
            IVARMarket(varMarket).settleMarket(matchId, 2, redCard   ? 4 : 5); // 4=YES, 5=NO
            IVARMarket(varMarket).settleMarket(matchId, 3, extraTime ? 4 : 5); // 4=YES, 5=NO
        }

        emit ResultPosted(matchId, winner, firstGoal, redCard, extraTime);
    }

    /// @notice Mark a team as eliminated and trigger CONVICTION vault settlement.
    function postElimination(uint16 teamId) external onlyOwner {
        require(teams[teamId].registered,  "Oracle: team not registered");
        require(!teams[teamId].eliminated, "Oracle: already eliminated");

        teams[teamId].eliminated = true;

        if (convictionVault != address(0)) {
            IConvictionVault(convictionVault).settleElimination(teamId);
        }

        emit TeamEliminated(teamId, teams[teamId].name);
    }

    /// @notice Announce the tournament champion.
    ///         CRITICAL ORDER: ChampionPool.setChampion() FIRST (reads deposits),
    ///         then ConvictionVault.setChampion() SECOND (enables principal claims).
    function postChampion(uint16 teamId) external onlyOwner {
        require(teams[teamId].registered,  "Oracle: team not registered");
        require(!teams[teamId].eliminated, "Oracle: team is eliminated");
        require(!teams[teamId].champion,   "Oracle: already champion");

        teams[teamId].champion = true;

        // Step 1: snapshot pool BEFORE vault allows principal claims
        if (championPool != address(0)) {
            IChampionPool(championPool).setChampion(teamId);
        }

        // Step 2: enable conviction principal claims for champion backers
        if (convictionVault != address(0)) {
            IConvictionVault(convictionVault).setChampion(teamId);
        }

        emit ChampionAnnounced(teamId, teams[teamId].name);
    }

    // ─────────────────────────────── View functions ───────────────────────────────

    function getMatch(uint256 matchId) external view returns (Match memory) {
        require(matchExists[matchId], "Oracle: match not found");
        return _matches[matchId];
    }

    function getTeam(uint16 teamId) external view returns (Team memory) {
        return teams[teamId];
    }

    function getAllMatchIds() external view returns (uint256[] memory) {
        return matchIds;
    }

    function getMatchCount() external view returns (uint256) {
        return matchIds.length;
    }

    /// @notice Convenience accessor for a team's display name.
    function teamNameOf(uint16 teamId) external view returns (string memory) {
        return teams[teamId].name;
    }

    /// @notice Returns whether a team has been eliminated. Used by StadiumHook.
    function isTeamEliminated(uint16 teamId) external view returns (bool) {
        return teams[teamId].eliminated;
    }

    /// @notice Returns the tournament stage for a team (stubbed: returns 0 = GROUP for now).
    ///         Future versions will track per-team stage progression.
    function getTeamStage(uint16 teamId) external view returns (uint8) {
        // Stage is stored per-match. This stub returns GROUP (0) for all teams.
        // Production: derive from latest match involving this team.
        teamId; // suppress unused warning
        return 0;
    }
}
