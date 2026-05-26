// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Uniswap V4 interfaces
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {BaseHook} from "@uniswap/v4-periphery/base/hooks/BaseHook.sol";

interface IStadiumNFT {
    function mintChampionNFT(address to, string memory team, uint256 depositAmount, uint256 totalEarned)
        external
        returns (uint256);
    function mintEliminationBadge(address to, string memory team, uint256 depositAmount, string memory round)
        external
        returns (uint256);
}

interface IChampionPool {
    function recordDeposit(uint256 amount) external;
}

/// @notice Core Uniswap V4 Hook implementing all CONVICTION logic
contract ConvictionHook is BaseHook, ReentrancyGuard, Ownable {
    using PoolIdLibrary for PoolKey;
    using SafeERC20 for IERC20;

    // ────────────────────────────── State ──────────────────────────────

    IERC20 public immutable usdc;

    address public oracle;
    address public treasury;
    address public championPool;
    address public varMarket;
    address public stadiumNFT;

    mapping(string => PoolKey) public teamPool;
    mapping(string => bool) public teamEliminated;
    mapping(string => bool) public teamChampion;
    mapping(string => bool) public teamRegistered;

    mapping(address => mapping(string => uint256)) public convictionDeposit;
    mapping(address => mapping(string => uint256)) public depositTimestamp;
    mapping(address => uint256) public accruedYield;
    mapping(address => mapping(string => bool)) public hasConviction;

    mapping(string => uint256) public totalConvictionLocked;
    mapping(string => uint256) public backerCount;
    mapping(string => address[]) public teamBackers;

    string[] public aliveTeams;
    uint256 public totalAliveConvictionLocked;

    // ────────────────────────────── Events ──────────────────────────────

    event TeamRegistered(string teamName);
    event ConvictionDeposited(address indexed user, string team, uint256 amount);
    event SurvivorYieldDistributed(string eliminatedTeam, uint256 yieldTotal, uint256 timestamp);
    event YieldClaimed(address indexed user, uint256 amount);
    event BackerSettled(address indexed user, string team, uint256 principalReturned, uint256 yieldPaid);
    event TeamSettled(string team, uint256 totalLocked);
    event ChampionBacker(address indexed user, string team, uint256 principal, uint256 yieldPaid);
    event ChampionSettled(string team);

    // ────────────────────────────── Constructor ──────────────────────────────

    constructor(
        IPoolManager _poolManager,
        address _usdc,
        address _treasury,
        address initialOwner
    ) BaseHook(_poolManager) Ownable(initialOwner) {
        require(_usdc != address(0), "ConvictionHook: zero usdc");
        require(_treasury != address(0), "ConvictionHook: zero treasury");
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    // ────────────────────────────── Admin ──────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "ConvictionHook: zero oracle");
        oracle = _oracle;
    }

    function setChampionPool(address _championPool) external onlyOwner {
        require(_championPool != address(0), "ConvictionHook: zero champPool");
        championPool = _championPool;
    }

    function setVarMarket(address _varMarket) external onlyOwner {
        require(_varMarket != address(0), "ConvictionHook: zero varMarket");
        varMarket = _varMarket;
    }

    function setStadiumNFT(address _stadiumNFT) external onlyOwner {
        require(_stadiumNFT != address(0), "ConvictionHook: zero nft");
        stadiumNFT = _stadiumNFT;
    }

    function registerTeam(string memory team, PoolKey calldata key) external onlyOwner {
        require(bytes(team).length > 0, "ConvictionHook: empty team name");
        require(!teamRegistered[team], "ConvictionHook: team already registered");
        teamRegistered[team] = true;
        teamPool[team] = key;
        aliveTeams.push(team);
        emit TeamRegistered(team);
    }

    // ────────────────────────────── Hook Flags ──────────────────────────────

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ────────────────────────────── Hook Callbacks ──────────────────────────────

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        revert("Use depositConviction");
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert("Use protocol settlement only");
    }

    // ────────────────────────────── CONVICTION Deposit ──────────────────────────────

    function depositConviction(string memory team, uint256 amount) external nonReentrant {
        require(teamRegistered[team], "ConvictionHook: team not registered");
        require(!teamEliminated[team], "ConvictionHook: team eliminated");
        require(amount > 0, "ConvictionHook: zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (!hasConviction[msg.sender][team]) {
            hasConviction[msg.sender][team] = true;
            teamBackers[team].push(msg.sender);
            backerCount[team]++;
        }

        convictionDeposit[msg.sender][team] += amount;
        depositTimestamp[msg.sender][team] = block.timestamp;
        totalConvictionLocked[team] += amount;
        totalAliveConvictionLocked += amount;

        emit ConvictionDeposited(msg.sender, team, amount);
    }

    // ────────────────────────────── Elimination Settlement ──────────────────────────────

    function settleElimination(string memory team) external nonReentrant {
        require(msg.sender == oracle, "ConvictionHook: not oracle");
        require(teamRegistered[team], "ConvictionHook: team not registered");
        require(!teamEliminated[team], "ConvictionHook: already eliminated");

        // Mark eliminated and update alive tracking first (CEI)
        teamEliminated[team] = true;
        _removeFromAliveTeams(team);

        uint256 totalLocked = totalConvictionLocked[team];
        totalAliveConvictionLocked -= totalLocked;

        if (totalLocked == 0) {
            emit TeamSettled(team, 0);
            return;
        }

        // ── Distribution of the forfeited 50% ──
        // Formula from spec 2A: survivorYield = halfLost * 0.10
        // champPool = halfLost * 0.25 ; treasury = halfLost * 0.15
        // (10+25+15 = 50% of halfLost accounted; remainder also sent to treasury per spec)
        uint256 halfLost = totalLocked / 2;
        uint256 survivorYield  = halfLost * 10 / 100;  // 5% of totalLocked
        uint256 champPoolShare = halfLost * 25 / 100;  // 12.5% of totalLocked
        // Treasury absorbs the remainder (including rounding dust) — ~32.5% of totalLocked
        uint256 treasuryShare  = halfLost - survivorYield - champPoolShare;

        // Credit survivor yield to all alive backers proportionally
        if (survivorYield > 0 && totalAliveConvictionLocked > 0) {
            for (uint256 i = 0; i < aliveTeams.length; i++) {
                address[] memory backers = teamBackers[aliveTeams[i]];
                for (uint256 j = 0; j < backers.length; j++) {
                    address backer = backers[j];
                    uint256 dep = convictionDeposit[backer][aliveTeams[i]];
                    if (dep == 0) continue;
                    accruedYield[backer] += (dep * survivorYield) / totalAliveConvictionLocked;
                }
            }
        }

        emit SurvivorYieldDistributed(team, survivorYield, block.timestamp);

        // Transfer champion pool share then update its counter
        if (champPoolShare > 0 && championPool != address(0)) {
            usdc.safeTransfer(championPool, champPoolShare);
            IChampionPool(championPool).recordDeposit(champPoolShare);
        }

        // Transfer treasury share
        if (treasuryShare > 0) {
            usdc.safeTransfer(treasury, treasuryShare);
        }

        // Settle each backer of the eliminated team (50% return + accrued yield)
        address[] memory eliminatedBackers = teamBackers[team];
        for (uint256 i = 0; i < eliminatedBackers.length; i++) {
            address backer = eliminatedBackers[i];
            uint256 dep = convictionDeposit[backer][team];
            if (dep == 0) continue;

            uint256 returnAmount = dep / 2;
            uint256 pendingYield = accruedYield[backer];

            // CEI: clear storage before external transfer
            convictionDeposit[backer][team] = 0;
            accruedYield[backer] = 0;

            uint256 totalPayout = returnAmount + pendingYield;
            if (totalPayout > 0) {
                usdc.safeTransfer(backer, totalPayout);
            }

            if (stadiumNFT != address(0)) {
                // Non-reverting: NFT mint failure should not block settlement
                try IStadiumNFT(stadiumNFT).mintEliminationBadge(backer, team, dep, "Group Stage") {} catch {}
            }

            emit BackerSettled(backer, team, returnAmount, pendingYield);
        }

        emit TeamSettled(team, totalLocked);
    }

    // ────────────────────────────── Champion Settlement ──────────────────────────────

    function settleChampion(string memory team) external nonReentrant {
        require(msg.sender == oracle, "ConvictionHook: not oracle");
        require(teamRegistered[team], "ConvictionHook: team not registered");
        require(!teamChampion[team], "ConvictionHook: already settled");

        // Mark champion before external calls (CEI)
        teamChampion[team] = true;

        address[] memory backers = teamBackers[team];
        for (uint256 i = 0; i < backers.length; i++) {
            address backer = backers[i];
            uint256 principal = convictionDeposit[backer][team];
            if (principal == 0) continue;

            uint256 pendingYield = accruedYield[backer];

            // CEI: clear storage before external transfer
            convictionDeposit[backer][team] = 0;
            accruedYield[backer] = 0;

            uint256 totalPayout = principal + pendingYield;
            if (totalPayout > 0) {
                usdc.safeTransfer(backer, totalPayout);
            }

            if (stadiumNFT != address(0)) {
                try IStadiumNFT(stadiumNFT).mintChampionNFT(backer, team, principal, pendingYield) {} catch {}
            }

            emit ChampionBacker(backer, team, principal, pendingYield);
        }

        emit ChampionSettled(team);
    }

    // ────────────────────────────── Yield Claim ──────────────────────────────

    function claimYield() external nonReentrant {
        uint256 amount = accruedYield[msg.sender];
        require(amount > 0, "ConvictionHook: no yield");
        // CEI: clear before transfer
        accruedYield[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit YieldClaimed(msg.sender, amount);
    }

    // ────────────────────────────── View Functions ──────────────────────────────

    /// @notice Returns 150 (1.5×) if user has active conviction on team, else 100 (1×)
    function getConvictionMultiplier(address user, string memory team) external view returns (uint256) {
        if (hasConviction[user][team] && !teamEliminated[team]) {
            return 150;
        }
        return 100;
    }

    function getTeamBackers(string memory team) external view returns (address[] memory) {
        return teamBackers[team];
    }

    function getAliveTeams() external view returns (string[] memory) {
        return aliveTeams;
    }

    function getTeamCount() external view returns (uint256) {
        return aliveTeams.length;
    }

    // ────────────────────────────── Internal ──────────────────────────────

    function _removeFromAliveTeams(string memory team) internal {
        uint256 len = aliveTeams.length;
        for (uint256 i = 0; i < len; i++) {
            if (keccak256(bytes(aliveTeams[i])) == keccak256(bytes(team))) {
                aliveTeams[i] = aliveTeams[len - 1];
                aliveTeams.pop();
                return;
            }
        }
    }
}
