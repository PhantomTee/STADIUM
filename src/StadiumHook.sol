// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "./vendor/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─────────────────────────────── External interfaces ───────────────────────────────

interface IMatchOracle {
    function isTeamEliminated(uint16 teamId) external view returns (bool);
    function getTeamStage(uint16 teamId) external view returns (uint8);
}

interface IConvictionVault {
    function getActiveConviction(address user, uint16 teamId) external view returns (bool);
}

// ChampionPool is funded by ConvictionVault.settleElimination() — not the hook.
// Hook only tracks notional fees for display (feeRoutedToChampPool accumulator).

/// @notice Core Uniswap V4 hook for the STADIUM protocol.
///
/// Permissions:
///   beforeSwap, afterSwap, beforeAddLiquidity, afterAddLiquidity
///
/// Hook logic:
///   - beforeSwap: blocks eliminated teams and paused trading; returns dynamic fee
///   - afterSwap:  routes a protocol fee to ChampionPool and updates team momentum
///   - beforeAddLiquidity: blocks adding liquidity to eliminated team pools
///   - afterAddLiquidity:  records liquidity additions
///
/// Hook address must be mined so its address bits encode the Hooks flags.
/// Use DeployHook.s.sol (HookMiner.find) for correct CREATE2 salt.
contract StadiumHook is BaseHook, Ownable, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using SafeERC20 for IERC20;

    // ─────────────────────────────── Custom errors ───────────────────────────────

    error PoolNotRegistered();
    error TeamEliminated();
    error TradingPaused();
    error NotOwner();
    error ZeroAddress();
    error PoolAlreadyRegistered();
    error InvalidUSDCPool();
    error InvalidFee();

    // ─────────────────────────────── Structs ───────────────────────────────

    struct FeeConfig {
        uint24 groupStageFee;      // e.g. 3000 = 0.3%
        uint24 knockoutFee;        // e.g. 5000
        uint24 finalFee;           // e.g. 10000
        uint24 convictionDiscount; // bps reduction for conviction holders
    }

    struct PoolState {
        uint16  teamId;
        bool    registered;
        bool    active;
        uint256 totalVolumeUSDC;
        uint256 feeRoutedToChampPool;
    }

    // ─────────────────────────────── State ───────────────────────────────

    mapping(bytes32 => PoolState) public poolState;   // poolId bytes32 => state
    mapping(uint16 => uint256)   public teamMomentum; // teamId => momentum score
    mapping(uint16 => bytes32)   public teamPoolId;   // teamId => poolId

    address public oracle;
    address public championPool;
    address public convictionVault;
    address public treasury;
    address public usdc;

    uint24 public protocolFeeBps; // basis points of swap volume routed to champion pool (max 1000)
    FeeConfig public feeConfig;
    bool public paused;

    // ─────────────────────────────── Events ───────────────────────────────

    event PoolRegistered(bytes32 indexed poolId, uint16 indexed teamId);
    event TeamSwap(address indexed user, uint16 indexed teamId, int256 amount0, int256 amount1);
    event TeamMomentumUpdated(uint16 indexed teamId, uint256 newMomentum);
    event ChampionFeeRouted(uint16 indexed teamId, uint256 amount);
    event SwapBlocked(uint16 indexed teamId, uint8 reason);
    event TeamLiquidityAdded(address indexed user, uint16 indexed teamId, uint256 amount);

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(IPoolManager _poolManager, address _owner)
        BaseHook(_poolManager)
        Ownable(_owner)
    {
        // Default fee config
        feeConfig = FeeConfig({
            groupStageFee:      3000,
            knockoutFee:        5000,
            finalFee:           10000,
            convictionDiscount: 500
        });
        protocolFeeBps = 30; // 0.3%
    }

    // ─────────────────────────────── Hook permissions ───────────────────────────────

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize:               false,
            afterInitialize:                false,
            beforeAddLiquidity:             true,
            afterAddLiquidity:              true,
            beforeRemoveLiquidity:          false,
            afterRemoveLiquidity:           false,
            beforeSwap:                     true,
            afterSwap:                      true,
            beforeDonate:                   false,
            afterDonate:                    false,
            beforeSwapReturnDelta:          false,
            afterSwapReturnDelta:           false,
            afterAddLiquidityReturnDelta:   false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ─────────────────────────────── Admin setters ───────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = _oracle;
    }

    function setChampionPool(address _championPool) external onlyOwner {
        if (_championPool == address(0)) revert ZeroAddress();
        championPool = _championPool;
    }

    function setConvictionVault(address _convictionVault) external onlyOwner {
        if (_convictionVault == address(0)) revert ZeroAddress();
        convictionVault = _convictionVault;
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setUsdc(address _usdc) external onlyOwner {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = _usdc;
    }

    function setProtocolFeeBps(uint24 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "StadiumHook: fee > 10%");
        protocolFeeBps = _feeBps;
    }

    function setFeeConfig(FeeConfig calldata _cfg) external onlyOwner {
        _validateLpFee(_cfg.groupStageFee);
        _validateLpFee(_cfg.knockoutFee);
        _validateLpFee(_cfg.finalFee);
        if (_cfg.convictionDiscount > _cfg.groupStageFee) revert InvalidFee();
        feeConfig = _cfg;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    /// @notice Register a V4 pool to a team. Pool must already be initialized via PoolManager.
    ///         When usdc is configured the pool must contain USDC as currency0 or currency1.
    function registerPool(PoolKey calldata key, uint16 teamId) external onlyOwner {
        bytes32 pid = PoolId.unwrap(key.toId());
        if (poolState[pid].registered) revert PoolAlreadyRegistered();
        if (usdc != address(0) &&
            Currency.unwrap(key.currency0) != usdc &&
            Currency.unwrap(key.currency1) != usdc) revert InvalidUSDCPool();

        poolState[pid] = PoolState({
            teamId:               teamId,
            registered:           true,
            active:               true,
            totalVolumeUSDC:      0,
            feeRoutedToChampPool: 0
        });
        teamPoolId[teamId] = pid;

        emit PoolRegistered(pid, teamId);
    }

    // ─────────────────────────────── Hook callbacks ───────────────────────────────

    /// @dev Called before every swap. Validates pool registration, pause state, team elimination,
    ///      and returns a dynamic fee.
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        bytes32 pid = PoolId.unwrap(key.toId());
        PoolState storage ps = poolState[pid];

        if (!ps.registered) revert PoolNotRegistered();

        if (paused) {
            emit SwapBlocked(ps.teamId, 0);
            revert TradingPaused();
        }

        // Check oracle for team elimination
        if (oracle != address(0)) {
            try IMatchOracle(oracle).isTeamEliminated(ps.teamId) returns (bool elim) {
                if (elim) {
                    emit SwapBlocked(ps.teamId, 1);
                    revert TeamEliminated();
                }
            } catch {}
        }

        uint24 dynamicFee = _getDynamicFee(ps.teamId, sender);
        uint24 overrideFee = dynamicFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, overrideFee);
    }

    /// @dev Called after every swap. Routes protocol fee to ChampionPool and updates team momentum.
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, int128)
    {
        bytes32 pid = PoolId.unwrap(key.toId());
        PoolState storage ps = poolState[pid];

        if (!ps.registered) {
            return (BaseHook.afterSwap.selector, 0);
        }

        // Compute USDC volume from the correct side of the pool.
        // When usdc is not configured, fall back to amount0 (demo mode only).
        int256 amt0 = delta.amount0();
        int256 amt1 = delta.amount1();
        int256 usdcAmt;
        if (usdc == address(0)) {
            usdcAmt = amt0; // demo fallback
        } else if (Currency.unwrap(key.currency0) == usdc) {
            usdcAmt = amt0;
        } else if (Currency.unwrap(key.currency1) == usdc) {
            usdcAmt = amt1;
        } else {
            revert InvalidUSDCPool();
        }
        uint256 absVol = usdcAmt < 0 ? uint256(-usdcAmt) : uint256(usdcAmt);

        // Update momentum and volume
        ps.totalVolumeUSDC += absVol;
        teamMomentum[ps.teamId] += absVol;

        // Notional fee accumulator — display only; NO real USDC transfer from the hook.
        // ChampionPool is funded by ConvictionVault.settleElimination(), not here.
        if (protocolFeeBps > 0) {
            uint256 fee = absVol * protocolFeeBps / 10000;
            if (fee > 0) {
                ps.feeRoutedToChampPool += fee;
                emit ChampionFeeRouted(ps.teamId, fee);
            }
        }

        emit TeamSwap(sender, ps.teamId, amt0, amt1);
        emit TeamMomentumUpdated(ps.teamId, teamMomentum[ps.teamId]);

        return (BaseHook.afterSwap.selector, 0);
    }

    /// @dev Block adding liquidity to eliminated team pools.
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4)
    {
        bytes32 pid = PoolId.unwrap(key.toId());
        PoolState storage ps = poolState[pid];

        if (!ps.registered) revert PoolNotRegistered();

        if (oracle != address(0)) {
            try IMatchOracle(oracle).isTeamEliminated(ps.teamId) returns (bool elim) {
                if (elim) {
                    emit SwapBlocked(ps.teamId, 1);
                    revert TeamEliminated();
                }
            } catch {}
        }

        emit TeamLiquidityAdded(sender, ps.teamId, 0);

        return BaseHook.beforeAddLiquidity.selector;
    }

    /// @dev Update stats after liquidity is added.
    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, BalanceDelta)
    {
        // No additional logic needed; stats are updated in beforeAddLiquidity
        return (BaseHook.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    // ─────────────────────────────── Internal helpers ───────────────────────────────

    function _validateLpFee(uint24 fee) internal pure {
        if (!LPFeeLibrary.isValid(fee)) revert InvalidFee();
    }

    /// @dev Determine dynamic fee based on tournament stage and conviction status.
    ///      Stage 0 = GROUP, 1-2 = KNOCKOUT, 3+ = FINAL bracket.
    function _getDynamicFee(uint16 teamId, address swapper) internal view returns (uint24) {
        uint24 baseFee = feeConfig.groupStageFee; // default: group stage

        if (oracle != address(0)) {
            try IMatchOracle(oracle).getTeamStage(teamId) returns (uint8 stage) {
                if (stage == 0) {
                    baseFee = feeConfig.groupStageFee;
                } else if (stage >= 1 && stage <= 4) {
                    baseFee = feeConfig.knockoutFee;
                } else {
                    baseFee = feeConfig.finalFee;
                }
            } catch {}
        }

        // Apply conviction discount if user has active conviction on this team
        if (convictionVault != address(0) && feeConfig.convictionDiscount > 0) {
            try IConvictionVault(convictionVault).getActiveConviction(swapper, teamId) returns (bool active) {
                if (active && baseFee > feeConfig.convictionDiscount) {
                    baseFee -= feeConfig.convictionDiscount;
                }
            } catch {}
        }

        _validateLpFee(baseFee);
        return baseFee;
    }
}
