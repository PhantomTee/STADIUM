// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Minimal single-hop swap router for STADIUM V4 pools.
///
/// Flow:
///   1. User approves this router for their input token.
///   2. User calls swap() with the PoolKey and SwapParams.
///   3. Router calls PoolManager.unlock() which triggers unlockCallback().
///   4. Callback: calls manager.swap(), settles input, takes output.
///
/// Price limits: pass MIN_SQRT_PRICE+1 (zeroForOne) or MAX_SQRT_PRICE-1 (!zeroForOne)
/// for no price cap (demo use). Add frontend slippage check before calling.
contract StadiumRouter {
    using SafeERC20 for IERC20;

    IPoolManager public immutable manager;

    // Uniswap V4 TickMath price bounds
    uint160 internal constant MIN_SQRT_PRICE_LIMIT = 4295128740;
    uint160 internal constant MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341;

    struct CallbackData {
        address sender;
        PoolKey key;
        IPoolManager.SwapParams params;
    }

    error NotManager();
    error Expired();

    event Swapped(
        address indexed sender,
        uint16  indexed teamId,
        bool    zeroForOne,
        int128  delta0,
        int128  delta1
    );

    constructor(address _manager) {
        manager = IPoolManager(_manager);
    }

    /// @notice Execute an exact-input swap through a V4 StadiumHook pool.
    /// @param key      PoolKey identifying the pool (currency0/1 sorted by address).
    /// @param params   zeroForOne, amountSpecified (negative = exact-in), sqrtPriceLimitX96.
    /// @param deadline Unix timestamp — reverts if block.timestamp exceeds it.
    /// @return delta   Packed BalanceDelta: amount0 in lower 128 bits, amount1 in upper 128 bits.
    function swap(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        uint256 deadline
    ) external returns (BalanceDelta delta) {
        if (block.timestamp > deadline) revert Expired();
        bytes memory result = manager.unlock(
            abi.encode(CallbackData({sender: msg.sender, key: key, params: params}))
        );
        delta = abi.decode(result, (BalanceDelta));
    }

    /// @dev Called by PoolManager inside unlock(). Performs swap + settle + take.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotManager();

        CallbackData memory d = abi.decode(data, (CallbackData));
        BalanceDelta delta = manager.swap(d.key, d.params, "");

        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();

        // Negative delta = tokens owed to PoolManager → user must pay
        if (d0 < 0) _settle(d.key.currency0, d.sender, uint128(-d0));
        if (d1 < 0) _settle(d.key.currency1, d.sender, uint128(-d1));

        // Positive delta = tokens owed to user → take from PoolManager
        if (d0 > 0) manager.take(d.key.currency0, d.sender, uint128(d0));
        if (d1 > 0) manager.take(d.key.currency1, d.sender, uint128(d1));

        return abi.encode(delta);
    }

    /// @dev Transfer ERC20 from payer to PoolManager, then record the deposit via settle().
    function _settle(Currency currency, address from, uint128 amount) internal {
        IERC20(Currency.unwrap(currency)).safeTransferFrom(from, address(manager), amount);
        manager.settle(currency);
    }
}
