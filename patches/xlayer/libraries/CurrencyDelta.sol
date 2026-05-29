// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import {Currency} from "../types/Currency.sol";

/// @notice X Layer patch: replaces tstore/tload with sstore/sload.
/// @title a library to store callers' currency deltas in regular storage
library CurrencyDelta {
    /// @notice calculates which storage slot a delta should be stored in for a given account and currency
    function _computeSlot(address target, Currency currency) internal pure returns (bytes32 hashSlot) {
        assembly ("memory-safe") {
            mstore(0, and(target, 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(32, and(currency, 0xffffffffffffffffffffffffffffffffffffffff))
            hashSlot := keccak256(0, 64)
        }
    }

    function getDelta(Currency currency, address target) internal view returns (int256 delta) {
        bytes32 hashSlot = _computeSlot(target, currency);
        assembly ("memory-safe") {
            delta := sload(hashSlot)
        }
    }

    /// @notice applies a new currency delta for a given account and currency
    /// @return previous The prior value
    /// @return next The modified result
    function applyDelta(Currency currency, address target, int128 delta)
        internal
        returns (int256 previous, int256 next)
    {
        bytes32 hashSlot = _computeSlot(target, currency);

        assembly ("memory-safe") {
            previous := sload(hashSlot)
        }
        next = previous + delta;
        assembly ("memory-safe") {
            sstore(hashSlot, next)
        }
    }
}
