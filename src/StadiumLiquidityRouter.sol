// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Minimal liquidity-provision router for STADIUM V4 pools.
///
/// Users must approve this router for BOTH tokens before calling addLiquidity.
/// The router settles the exact amounts required by PoolManager (can be
/// asymmetric for single-sided positions or if current tick is at range edge).
contract StadiumLiquidityRouter {
    using SafeERC20 for IERC20;

    IPoolManager public immutable manager;

    struct CallbackData {
        address sender;
        PoolKey key;
        IPoolManager.ModifyLiquidityParams params;
    }

    error NotManager();
    error Expired();

    event LiquidityAdded(
        address indexed sender,
        int24  tickLower,
        int24  tickUpper,
        int256 liquidityDelta,
        int128 delta0,
        int128 delta1
    );

    constructor(address _manager) {
        manager = IPoolManager(_manager);
    }

    /// @notice Add liquidity to a V4 pool.
    /// @param key            PoolKey (must be registered in StadiumHook).
    /// @param tickLower      Lower tick of position (must be multiple of tickSpacing).
    /// @param tickUpper      Upper tick of position (must be multiple of tickSpacing).
    /// @param liquidityDelta Amount of liquidity to add (positive).
    /// @param deadline       Unix timestamp — reverts if exceeded.
    function addLiquidity(
        PoolKey calldata key,
        int24  tickLower,
        int24  tickUpper,
        int256 liquidityDelta,
        uint256 deadline
    ) external returns (BalanceDelta delta) {
        if (block.timestamp > deadline) revert Expired();
        bytes memory result = manager.unlock(
            abi.encode(CallbackData({
                sender: msg.sender,
                key:    key,
                params: IPoolManager.ModifyLiquidityParams({
                    tickLower:      tickLower,
                    tickUpper:      tickUpper,
                    liquidityDelta: liquidityDelta,
                    salt:           bytes32(0)
                })
            }))
        );
        delta = abi.decode(result, (BalanceDelta));
    }

    /// @dev Called by PoolManager inside unlock(). Modifies liquidity and settles deltas.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotManager();

        CallbackData memory d = abi.decode(data, (CallbackData));
        (BalanceDelta delta, ) = manager.modifyLiquidity(d.key, d.params, "");

        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();

        // Negative delta = tokens owed to PoolManager (user pays)
        if (d0 < 0) _settle(d.key.currency0, d.sender, uint128(-d0));
        if (d1 < 0) _settle(d.key.currency1, d.sender, uint128(-d1));

        // Positive delta = tokens owed to user (surplus from removing/closing)
        if (d0 > 0) manager.take(d.key.currency0, d.sender, uint128(d0));
        if (d1 > 0) manager.take(d.key.currency1, d.sender, uint128(d1));

        emit LiquidityAdded(d.sender, d.params.tickLower, d.params.tickUpper,
                            d.params.liquidityDelta, d0, d1);
        return abi.encode(delta);
    }

    function _settle(Currency currency, address from, uint128 amount) internal {
        manager.sync(currency);
        IERC20(Currency.unwrap(currency)).safeTransferFrom(from, address(manager), amount);
        manager.settle();
    }
}
