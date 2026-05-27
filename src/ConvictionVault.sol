// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IChampionPool {
    function recordDeposit(uint256 amount) external;
}

interface IStadiumNFT {
    function mintChampionNFT(
        address to,
        string memory team,
        uint256 depositAmount,
        uint256 totalEarned
    ) external returns (uint256);

    function mintEliminationBadge(
        address to,
        string memory team,
        uint256 depositAmount,
        string memory round
    ) external returns (uint256);
}

/// @notice MasterChef-style CONVICTION accumulator for survivor yield.
///         No loops over all users at settlement — uses a global accYieldPerShare accumulator.
///         No Uniswap V4 imports — this is a standalone vault.
///
/// Yield accumulator math:
///   accYieldPerShare (scaled 1e18) increases each time a team is eliminated.
///   teamEliminationSnapshot[teamId] = value of accYieldPerShare at the moment that team is
///   eliminated. This caps eliminated-team backers' yield — they stop earning after their team falls.
///
/// Forfeited funds breakdown per elimination (applied to 50% of teamTotalDeposit):
///   20% of forfeited → survivorYield  (increases accYieldPerShare for all alive depositors)
///   50% of forfeited → championPool   (accumulated for champion backers)
///   30% of forfeited → treasury       (= forfeited - survivorYield - champShare, absorbs dust)
///   ────────────────────────────────────────────────────────────────────────────────
///   Total = 20 + 50 + 30 = 100% of forfeited ✓
contract ConvictionVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────── Core state ───────────────────────────────

    IERC20 public immutable usdc;

    address public oracle;
    address public treasury;
    address public championPool;
    address public stadiumNFT;

    /// @notice Global MasterChef accumulator (scaled 1e18). Increases on each elimination.
    uint256 public accYieldPerShare;

    /// @notice Sum of all USDC deposits whose team is still alive (not eliminated, not champion).
    uint256 public totalAliveDeposits;

    // ─────────────────────────────── Per-team mappings (key = uint16 teamId) ───────────────────────────────

    mapping(uint16 => bool)    public teamActive;
    mapping(uint16 => bool)    public teamEliminated;
    mapping(uint16 => bool)    public teamChampion;
    /// @notice Total USDC deposited by all backers of this team (NEVER zeroed — used by ChampionPool)
    mapping(uint16 => uint256) public teamTotalDeposit;
    /// @notice Value of accYieldPerShare at the moment of elimination — caps yield for eliminated backers
    mapping(uint16 => uint256) public teamEliminationSnapshot;
    /// @notice Display name for this team (used for NFT minting)
    mapping(uint16 => string)  public teamName;
    /// @notice Number of distinct depositors per team
    mapping(uint16 => uint256) public backerCount;

    // ─────────────────────────────── Per-user mappings ───────────────────────────────

    /// @notice Which teamIds a user has deposited into (for iteration in claimYield / pendingYield)
    mapping(address => uint16[]) public userTeamIds;
    /// @notice Dedup guard — true if user already tracked in userTeamIds for this team
    mapping(address => mapping(uint16 => bool)) public userHasTeam;
    /// @notice Buffered yield that has been flushed from positions but not yet transferred
    mapping(address => uint256) public claimableYield;

    // ─────────────────────────────── Per-user-team mappings ───────────────────────────────

    /// @notice USDC deposited by user for teamId. NEVER zeroed after claim — kept for ChampionPool queries.
    mapping(address => mapping(uint16 => uint256)) public deposits;
    /// @notice Standard MasterChef reward debt (scaled 1e18 denominator)
    mapping(address => mapping(uint16 => uint256)) public rewardDebt;
    /// @notice True once the user has claimed their principal (50% refund or full champion return)
    mapping(address => mapping(uint16 => bool)) public principalClaimed;

    // ─────────────────────────────── Events ───────────────────────────────

    event TeamRegistered(uint16 indexed teamId, string name);
    event TeamEliminated(uint16 indexed teamId, uint256 survivorYield, uint256 champShare, uint256 treasuryShare);
    event ChampionSet(uint16 indexed teamId);
    event ConvictionDeposited(address indexed user, uint16 indexed teamId, uint256 amount);
    event YieldClaimed(address indexed user, uint256 amount);
    event EliminationClaimed(address indexed user, uint16 indexed teamId, uint256 refund);
    event ChampionClaimed(address indexed user, uint16 indexed teamId, uint256 principal);

    // ─────────────────────────────── Modifiers ───────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "ConvictionVault: not oracle");
        _;
    }

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(
        address _usdc,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        require(_usdc     != address(0), "ConvictionVault: zero usdc");
        require(_treasury != address(0), "ConvictionVault: zero treasury");
        usdc     = IERC20(_usdc);
        treasury = _treasury;
    }

    // ─────────────────────────────── Admin setters ───────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "ConvictionVault: zero oracle");
        oracle = _oracle;
    }

    function setChampionPool(address _championPool) external onlyOwner {
        require(_championPool != address(0), "ConvictionVault: zero champPool");
        championPool = _championPool;
    }

    function setStadiumNFT(address _stadiumNFT) external onlyOwner {
        require(_stadiumNFT != address(0), "ConvictionVault: zero nft");
        stadiumNFT = _stadiumNFT;
    }

    // ─────────────────────────────── Oracle-only functions ───────────────────────────────

    /// @notice Register a new team so users can deposit conviction against it.
    function registerTeam(uint16 teamId, string calldata name) external onlyOracle {
        require(
            !teamActive[teamId] && !teamEliminated[teamId] && !teamChampion[teamId],
            "ConvictionVault: team already registered"
        );
        require(bytes(name).length > 0, "ConvictionVault: empty name");
        teamActive[teamId] = true;
        teamName[teamId]   = name;
        emit TeamRegistered(teamId, name);
    }

    /// @notice Settle an elimination. Forfeits 50% of the team's locked deposits and distributes:
    ///   - 20% of forfeited → survivor yield (via accYieldPerShare accumulator — no user loops)
    ///   - 50% of forfeited → championPool
    ///   - 30% of forfeited → treasury (remainder, absorbs integer dust)
    function settleElimination(uint16 teamId) external onlyOracle {
        require(teamActive[teamId],      "ConvictionVault: team not active");
        require(!teamEliminated[teamId], "ConvictionVault: already eliminated");

        uint256 totalLocked = teamTotalDeposit[teamId];

        // ── Step 1: Remove eliminated team's deposits from alive total ──
        totalAliveDeposits -= teamTotalDeposit[teamId];

        // ── Step 2: Mark eliminated (state changes before any external calls — CEI) ──
        teamActive[teamId]     = false;
        teamEliminated[teamId] = true;

        // ── Step 3: Snapshot accYieldPerShare BEFORE adding new yield ──
        //    This freezes the yield accrual for this team's backers at the current accumulator value.
        teamEliminationSnapshot[teamId] = accYieldPerShare;

        if (totalLocked == 0) {
            emit TeamEliminated(teamId, 0, 0, 0);
            return;
        }

        // ── Steps 4–7: Compute distribution from the forfeited 50% ──
        uint256 forfeited     = totalLocked / 2;                        // 50% of totalLocked is forfeited
        uint256 survivorYield = forfeited * 20 / 100;                   // 20% of forfeited → alive depositors
        uint256 champShare    = forfeited * 50 / 100;                   // 50% of forfeited → champion pool
        uint256 treasuryShare = forfeited - survivorYield - champShare; // 30% of forfeited (remainder absorbs dust)

        // ── Step 8: Distribute survivor yield via accumulator (no loops) ──
        if (survivorYield > 0) {
            if (totalAliveDeposits > 0) {
                // MasterChef-style: increase global per-share, users pull lazily
                accYieldPerShare += survivorYield * 1e18 / totalAliveDeposits;
            } else {
                // No alive teams left — route unclaimed survivor yield to treasury
                treasuryShare += survivorYield;
            }
        }

        // ── Step 9: Transfer to champion pool and record ──
        if (champShare > 0 && championPool != address(0)) {
            usdc.safeTransfer(championPool, champShare);
            IChampionPool(championPool).recordDeposit(champShare);
        }

        // ── Step 10: Transfer to treasury ──
        if (treasuryShare > 0) {
            usdc.safeTransfer(treasury, treasuryShare);
        }

        emit TeamEliminated(teamId, survivorYield, champShare, treasuryShare);
    }

    /// @notice Mark a team as the tournament champion so backers can claim their full principal.
    function setChampion(uint16 teamId) external onlyOracle {
        // Team must be registered (active) to be declared champion
        require(teamActive[teamId], "ConvictionVault: team not active or not registered");
        require(!teamChampion[teamId], "ConvictionVault: already champion");

        // Remove from alive tracking
        totalAliveDeposits -= teamTotalDeposit[teamId];
        teamActive[teamId]   = false;
        teamChampion[teamId] = true;

        emit ChampionSet(teamId);
    }

    // ─────────────────────────────── User functions (nonReentrant) ───────────────────────────────

    /// @notice Deposit USDC conviction behind a team.
    ///         Flushes pending yield first so rewardDebt is recalculated against the updated deposit.
    function depositConviction(uint16 teamId, uint256 amount) external nonReentrant {
        require(teamActive[teamId], "ConvictionVault: team not active");
        require(amount > 0,         "ConvictionVault: zero amount");

        // Step 1: flush pending yield before changing the deposit (MasterChef pattern)
        _flushYield(msg.sender, teamId);

        // Step 2: pull USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Step 3: update deposits, team total, global alive total; track backer count
        if (!userHasTeam[msg.sender][teamId]) {
            userHasTeam[msg.sender][teamId] = true;
            userTeamIds[msg.sender].push(teamId);
            backerCount[teamId]++;
        }

        deposits[msg.sender][teamId] += amount;
        teamTotalDeposit[teamId]     += amount;
        totalAliveDeposits           += amount;

        // Step 4: update reward debt to current accumulator (no phantom yield on new/top-up deposits)
        rewardDebt[msg.sender][teamId] = deposits[msg.sender][teamId] * accYieldPerShare / 1e18;

        emit ConvictionDeposited(msg.sender, teamId, amount);
    }

    /// @notice Claim all accrued yield across every team the caller has deposited into.
    function claimYield() external nonReentrant {
        // Step 1: flush each team position into claimableYield
        uint16[] memory teams = userTeamIds[msg.sender];
        for (uint256 i = 0; i < teams.length; i++) {
            _flushYield(msg.sender, teams[i]);
        }

        // Steps 2–5: transfer buffered yield
        uint256 amount = claimableYield[msg.sender];
        require(amount > 0, "ConvictionVault: no yield");
        claimableYield[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit YieldClaimed(msg.sender, amount);
    }

    /// @notice Claim the 50% principal refund for an eliminated team position.
    ///         Mints an EliminationBadge NFT (non-reverting on failure).
    function claimEliminatedPosition(uint16 teamId) external nonReentrant {
        require(teamEliminated[teamId],                "ConvictionVault: team not eliminated");
        require(!principalClaimed[msg.sender][teamId], "ConvictionVault: already claimed");
        require(deposits[msg.sender][teamId] > 0,      "ConvictionVault: no deposit");

        // CEI: mark claimed before transfer
        principalClaimed[msg.sender][teamId] = true;

        // 50% refund — the other 50% was forfeited at elimination time
        uint256 refund = deposits[msg.sender][teamId] / 2;
        if (refund > 0) {
            usdc.safeTransfer(msg.sender, refund);
        }

        // Non-reverting: NFT badge failure must NOT block the refund
        if (stadiumNFT != address(0)) {
            try IStadiumNFT(stadiumNFT).mintEliminationBadge(
                msg.sender,
                teamName[teamId],
                deposits[msg.sender][teamId],
                "Tournament"
            ) {} catch {}
        }

        emit EliminationClaimed(msg.sender, teamId, refund);
    }

    /// @notice Claim full principal for champion team backers.
    ///         Mints a ChampionNFT (non-reverting on failure).
    function claimChampionPrincipal(uint16 teamId) external nonReentrant {
        require(teamChampion[teamId],                  "ConvictionVault: team not champion");
        require(!principalClaimed[msg.sender][teamId], "ConvictionVault: already claimed");
        require(deposits[msg.sender][teamId] > 0,      "ConvictionVault: no deposit");

        // CEI: mark claimed before transfer
        principalClaimed[msg.sender][teamId] = true;

        uint256 principal = deposits[msg.sender][teamId];
        usdc.safeTransfer(msg.sender, principal);

        // Non-reverting: NFT failure must NOT block the principal return
        if (stadiumNFT != address(0)) {
            try IStadiumNFT(stadiumNFT).mintChampionNFT(
                msg.sender,
                teamName[teamId],
                principal,
                0  // totalEarned passed as 0; yield is claimed separately via claimYield()
            ) {} catch {}
        }

        emit ChampionClaimed(msg.sender, teamId, principal);
    }

    /// @notice Alias for claimChampionPrincipal (preferred name going forward).
    function claimChampionPosition(uint16 teamId) external nonReentrant {
        require(teamChampion[teamId],                  "ConvictionVault: team not champion");
        require(!principalClaimed[msg.sender][teamId], "ConvictionVault: already claimed");
        require(deposits[msg.sender][teamId] > 0,      "ConvictionVault: no deposit");

        principalClaimed[msg.sender][teamId] = true;

        uint256 principal = deposits[msg.sender][teamId];
        usdc.safeTransfer(msg.sender, principal);

        if (stadiumNFT != address(0)) {
            try IStadiumNFT(stadiumNFT).mintChampionNFT(
                msg.sender,
                teamName[teamId],
                principal,
                0
            ) {} catch {}
        }

        emit ChampionClaimed(msg.sender, teamId, principal);
    }

    // ─────────────────────────────── View functions ───────────────────────────────

    /// @notice Total pending yield for a user across all their teams, including already-buffered amount.
    function pendingYield(address user) external view returns (uint256 total) {
        uint16[] memory teams = userTeamIds[user];
        for (uint256 i = 0; i < teams.length; i++) {
            total += _computePending(user, teams[i]);
        }
        total += claimableYield[user];
    }

    /// @notice Returns true if the user has an active (non-zero, team-alive) conviction deposit.
    ///         Used by StadiumHook to apply conviction fee discount.
    function getActiveConviction(address user, uint16 teamId) external view returns (bool) {
        return deposits[user][teamId] > 0 && teamActive[teamId];
    }

    /// @notice Returns 150 (1.5×) if user has an active conviction deposit on teamId, else 100 (1×).
    ///         Used by VARMarket to compute the conviction multiplier on bets (single-team version).
    function getConvictionMultiplier(address user, uint16 teamId) external view returns (uint256) {
        if (deposits[user][teamId] > 0 && teamActive[teamId]) {
            return 150;
        }
        return 100;
    }

    /// @notice Returns 150 if user has active conviction on EITHER teamA or teamB, else 100.
    ///         Used by VARMarket when both teams are relevant (match-level multiplier).
    function getConvictionMultiplier(address user, uint16 teamA, uint16 teamB) external view returns (uint256) {
        if ((deposits[user][teamA] > 0 && teamActive[teamA]) ||
            (deposits[user][teamB] > 0 && teamActive[teamB])) {
            return 150;
        }
        return 100;
    }

    /// @notice Returns the raw USDC deposit amount for (user, teamId).
    ///         deposits are never zeroed after claim, so this reflects the original deposit.
    function getUserDeposit(address user, uint16 teamId) external view returns (uint256) {
        return deposits[user][teamId];
    }

    // ─────────────────────────────── Composite view ───────────────────────────────

    struct UserPosition {
        uint256 deposited;
        uint256 pendingYield;
        bool    principalClaimed;
        bool    teamActive;
        bool    teamEliminated;
        bool    teamChampion;
    }

    /// @notice Returns a combined view of a user's position for a given team.
    function getUserPosition(address user, uint16 teamId) external view returns (UserPosition memory pos) {
        pos.deposited       = deposits[user][teamId];
        pos.pendingYield    = _computePending(user, teamId) + claimableYield[user];
        pos.principalClaimed = principalClaimed[user][teamId];
        pos.teamActive      = teamActive[teamId];
        pos.teamEliminated  = teamEliminated[teamId];
        pos.teamChampion    = teamChampion[teamId];
    }

    // ─────────────────────────────── Internal helpers ───────────────────────────────

    /// @dev Compute unflushed pending yield for a single (user, teamId) position.
    ///      For eliminated teams, uses the elimination snapshot so yield stops at elimination time.
    function _computePending(address user, uint16 teamId) internal view returns (uint256) {
        uint256 dep = deposits[user][teamId];
        if (dep == 0) return 0;

        // Eliminated team: use snapshot (yield frozen); alive team: use live accumulator
        uint256 perShare = teamEliminated[teamId]
            ? teamEliminationSnapshot[teamId]
            : accYieldPerShare;

        uint256 earned = dep * perShare / 1e18;
        uint256 debt   = rewardDebt[user][teamId];
        return earned > debt ? earned - debt : 0;
    }

    /// @dev Move any pending yield into claimableYield and advance rewardDebt.
    function _flushYield(address user, uint16 teamId) internal {
        uint256 pending = _computePending(user, teamId);
        if (pending > 0) {
            claimableYield[user] += pending;
        }

        // Advance debt to the current effective per-share (snapshot or live)
        uint256 perShare = teamEliminated[teamId]
            ? teamEliminationSnapshot[teamId]
            : accYieldPerShare;
        rewardDebt[user][teamId] = deposits[user][teamId] * perShare / 1e18;
    }
}
