// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/base/hooks/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IConvictionVaultHook {
    function teamActive(uint16 teamId) external view returns (bool);
    function teamEliminated(uint16 teamId) external view returns (bool);
}

interface IChampionPoolHook {
    function recordDeposit(uint256 amount) external;
}

/// @notice Minimal Uniswap V4 hook for STADIUM.
///         Contains ONLY V4 hook logic — all CONVICTION accounting lives in ConvictionVault.
///
/// NOTE: For testnet demo, deploy with a MockPoolManager if no official v4 exists.
///       Hook address must be mined so its bits encode the required permissions
///       (beforeSwap, afterSwap, beforeAddLiquidity).
contract StadiumHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;
    using SafeERC20 for IERC20;

    // ─────────────────────────────── State ───────────────────────────────

    IConvictionVaultHook public vault;
    IChampionPoolHook    public champPool;
    IERC20 public usdc;

    /// @notice Which teamId is associated with each registered pool
    mapping(PoolId => uint16) public poolTeamId;
    mapping(PoolId => bool)   public poolRegistered;

    /// @notice Basis points (out of 10_000) of the USDC hook balance to forward to ChampionPool per swap
    uint256 public swapFeeBps; // default 30 = 0.3%

    // ─────────────────────────────── Events ───────────────────────────────

    event PoolRegistered(PoolId indexed poolId, uint16 teamId);
    event ChampionFeeRouted(PoolId indexed poolId, uint256 amount);

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(
        IPoolManager _poolManager,
        address _vault,
        address _champPool,
        address _usdc,
        address _owner
    ) BaseHook(_poolManager) Ownable(_owner) {
        vault     = IConvictionVaultHook(_vault);
        champPool = IChampionPoolHook(_champPool);
        usdc      = IERC20(_usdc);
        swapFeeBps = 30; // 0.3%
    }

    // ─────────────────────────────── Hook permissions ───────────────────────────────

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize:              false,
            afterInitialize:               false,
            beforeAddLiquidity:            true,
            afterAddLiquidity:             false,
            beforeRemoveLiquidity:         false,
            afterRemoveLiquidity:          false,
            beforeSwap:                    true,
            afterSwap:                     true,
            beforeDonate:                  false,
            afterDonate:                   false,
            beforeSwapReturnDelta:         false,
            afterSwapReturnDelta:          false,
            afterAddLiquidityReturnDelta:  false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ─────────────────────────────── Admin ───────────────────────────────

    /// @notice Associate a pool with a team ID so hook logic can look up team status.
    function registerPool(PoolKey calldata key, uint16 teamId) external onlyOwner {
        PoolId pid = key.toId();
        require(!poolRegistered[pid], "Hook: pool already registered");
        poolRegistered[pid] = true;
        poolTeamId[pid]     = teamId;
        emit PoolRegistered(pid, teamId);
    }

    /// @notice Update the protocol fee forwarded to ChampionPool on each swap (max 10%).
    function setSwapFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Hook: fee too high"); // max 10%
        swapFeeBps = _bps;
    }

    // ─────────────────────────────── Hook callbacks ───────────────────────────────

    /// @dev Block swaps on pools where the team has been eliminated.
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId pid = key.toId();
        if (poolRegistered[pid]) {
            uint16 tid = poolTeamId[pid];
            require(!vault.teamEliminated(tid), "Hook: team eliminated");
        }
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /// @dev After each swap, forward a protocol fee slice of any USDC held by the hook to ChampionPool.
    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        PoolId pid = key.toId();
        if (poolRegistered[pid] && swapFeeBps > 0) {
            uint256 bal = usdc.balanceOf(address(this));
            if (bal > 0) {
                uint256 fee = bal * swapFeeBps / 10000;
                if (fee > 0 && address(champPool) != address(0)) {
                    usdc.safeTransfer(address(champPool), fee);
                    champPool.recordDeposit(fee);
                    emit ChampionFeeRouted(pid, fee);
                }
            }
        }
        return (BaseHook.afterSwap.selector, 0);
    }

    /// @dev Only allow adding liquidity to pools with active (non-eliminated) teams.
    function beforeAddLiquidity(
        address,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4) {
        PoolId pid = key.toId();
        if (poolRegistered[pid]) {
            uint16 tid = poolTeamId[pid];
            require(vault.teamActive(tid) && !vault.teamEliminated(tid), "Hook: team not active");
        }
        return BaseHook.beforeAddLiquidity.selector;
    }
}
