// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Uniswap V4 interfaces
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
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
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    // ────────────────────────────── Admin ──────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setChampionPool(address _championPool) external onlyOwner {
        championPool = _championPool;
    }

    function setVarMarket(address _varMarket) external onlyOwner {
        varMarket = _varMarket;
    }

    function setStadiumNFT(address _stadiumNFT) external onlyOwner {
        stadiumNFT = _stadiumNFT;
    }

    function registerTeam(string memory team, PoolKey calldata key) external onlyOwner {
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

        usdc.transferFrom(msg.sender, address(this), amount);

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

    // ────────────────────────────── Settlement ──────────────────────────────

    function settleElimination(string memory team) external nonReentrant {
        require(msg.sender == oracle, "ConvictionHook: not oracle");
        require(teamRegistered[team], "ConvictionHook: team not registered");
        require(!teamEliminated[team], "ConvictionHook: already eliminated");

        teamEliminated[team] = true;
        _removeFromAliveTeams(team);

        uint256 totalLocked = totalConvictionLocked[team];
        totalAliveConvictionLocked -= totalLocked;

        if (totalLocked == 0) {
            emit TeamSettled(team, 0);
            return;
        }

        uint256 halfLost = totalLocked / 2;
        uint256 survivorYield = halfLost * 10 / 100;
        uint256 champPoolAmount = halfLost * 25 / 100;
        uint256 treasuryAmount = halfLost - survivorYield - champPoolAmount; // 15% + rounding remainder

        // Distribute survivor yield to all alive backers
        if (survivorYield > 0 && totalAliveConvictionLocked > 0) {
            for (uint256 i = 0; i < aliveTeams.length; i++) {
                string memory aliveTeam = aliveTeams[i];
                address[] memory backers = teamBackers[aliveTeam];
                for (uint256 j = 0; j < backers.length; j++) {
                    address backer = backers[j];
                    uint256 deposit_ = convictionDeposit[backer][aliveTeam];
                    if (deposit_ == 0) continue;
                    uint256 userShare = (deposit_ * survivorYield) / totalAliveConvictionLocked;
                    accruedYield[backer] += userShare;
                }
            }
        }

        emit SurvivorYieldDistributed(team, survivorYield, block.timestamp);

        // Send champion pool share
        if (champPoolAmount > 0) {
            usdc.transfer(championPool, champPoolAmount);
        }

        // Send treasury share
        if (treasuryAmount > 0) {
            usdc.transfer(treasury, treasuryAmount);
        }

        // Settle each backer of the eliminated team
        address[] memory eliminatedBackers = teamBackers[team];
        for (uint256 i = 0; i < eliminatedBackers.length; i++) {
            address backer = eliminatedBackers[i];
            uint256 deposit_ = convictionDeposit[backer][team];
            if (deposit_ == 0) continue;

            uint256 returnAmount = deposit_ / 2;
            uint256 pendingYield = accruedYield[backer];
            accruedYield[backer] = 0;
            convictionDeposit[backer][team] = 0;

            uint256 totalPayout = returnAmount + pendingYield;
            if (totalPayout > 0) {
                usdc.transfer(backer, totalPayout);
            }

            if (stadiumNFT != address(0)) {
                IStadiumNFT(stadiumNFT).mintEliminationBadge(backer, team, deposit_, "Group Stage");
            }

            emit BackerSettled(backer, team, returnAmount, pendingYield);
        }

        emit TeamSettled(team, totalLocked);
    }

    function settleChampion(string memory team) external nonReentrant {
        require(msg.sender == oracle, "ConvictionHook: not oracle");
        require(teamRegistered[team], "ConvictionHook: team not registered");
        require(!teamChampion[team], "ConvictionHook: already settled");

        teamChampion[team] = true;

        address[] memory backers = teamBackers[team];
        for (uint256 i = 0; i < backers.length; i++) {
            address backer = backers[i];
            uint256 principal = convictionDeposit[backer][team];
            if (principal == 0) continue;

            uint256 pendingYield = accruedYield[backer];
            accruedYield[backer] = 0;
            convictionDeposit[backer][team] = 0;

            uint256 totalPayout = principal + pendingYield;
            if (totalPayout > 0) {
                usdc.transfer(backer, totalPayout);
            }

            if (stadiumNFT != address(0)) {
                IStadiumNFT(stadiumNFT).mintChampionNFT(backer, team, principal, pendingYield);
            }

            emit ChampionBacker(backer, team, principal, pendingYield);
        }

        emit ChampionSettled(team);
    }

    // ────────────────────────────── Yield Claim ──────────────────────────────

    function claimYield() external nonReentrant {
        uint256 amount = accruedYield[msg.sender];
        require(amount > 0, "ConvictionHook: no yield");
        accruedYield[msg.sender] = 0;
        usdc.transfer(msg.sender, amount);
        emit YieldClaimed(msg.sender, amount);
    }

    // ────────────────────────────── View Functions ──────────────────────────────

    function getConvictionMultiplier(address user, string memory team) external view returns (uint256) {
        if (hasConviction[user][team] && !teamEliminated[team]) {
            return 150; // 1.5x scaled by 100
        }
        return 100; // 1.0x
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
