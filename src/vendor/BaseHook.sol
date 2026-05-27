// SPDX-License-Identifier: MIT
// Vendored from Uniswap v4-periphery. Constructor validation removed so tests can
// deploy at arbitrary addresses; production safety comes from HookMiner + deploy
// script address check, and from PoolManager.initialize validating hook bits.
pragma solidity ^0.8.0;

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/types/PoolOperation.sol";

abstract contract BaseHook is IHooks {
    error NotPoolManager();
    error HookNotImplemented();

    IPoolManager public immutable poolManager;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    function getHookPermissions() public pure virtual returns (Hooks.Permissions memory);

    function beforeInitialize(address, PoolKey calldata, uint160)
        external virtual returns (bytes4) { revert HookNotImplemented(); }

    function afterInitialize(address, PoolKey calldata, uint160, int24)
        external virtual returns (bytes4) { revert HookNotImplemented(); }

    function beforeAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata
    ) external virtual returns (bytes4) { revert HookNotImplemented(); }

    function afterAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external virtual returns (bytes4, BalanceDelta) { revert HookNotImplemented(); }

    function beforeRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata
    ) external virtual returns (bytes4) { revert HookNotImplemented(); }

    function afterRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external virtual returns (bytes4, BalanceDelta) { revert HookNotImplemented(); }

    function beforeSwap(
        address, PoolKey calldata, SwapParams calldata, bytes calldata
    ) external virtual returns (bytes4, BeforeSwapDelta, uint24) { revert HookNotImplemented(); }

    function afterSwap(
        address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata
    ) external virtual returns (bytes4, int128) { revert HookNotImplemented(); }

    function beforeDonate(
        address, PoolKey calldata, uint256, uint256, bytes calldata
    ) external virtual returns (bytes4) { revert HookNotImplemented(); }

    function afterDonate(
        address, PoolKey calldata, uint256, uint256, bytes calldata
    ) external virtual returns (bytes4) { revert HookNotImplemented(); }
}
