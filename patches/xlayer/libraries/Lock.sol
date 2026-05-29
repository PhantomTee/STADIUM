// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/// @notice X Layer patch: replaces tstore/tload with sstore/sload.
/// X Layer zkEVM (Polygon CDK) does not clear EIP-1153 transient storage
/// between transactions. A failed unlock() call would leave IS_UNLOCKED_SLOT=1
/// permanently, causing every subsequent swap to revert with AlreadyUnlocked().
/// Using sstore/sload gives identical semantics on all EVM-compatible chains
/// because sstore changes are reverted on transaction failure, preventing the
/// lock from ever getting stuck.
library Lock {
    // The slot holding the unlocked state. bytes32(uint256(keccak256("Unlocked")) - 1)
    bytes32 internal constant IS_UNLOCKED_SLOT = 0xc090fc4683624cfc3884e9d8de5eca132f2d0ec062aff75d43c0465d5ceeab23;

    function unlock() internal {
        assembly ("memory-safe") {
            sstore(IS_UNLOCKED_SLOT, true)
        }
    }

    function lock() internal {
        assembly ("memory-safe") {
            sstore(IS_UNLOCKED_SLOT, false)
        }
    }

    function isUnlocked() internal view returns (bool unlocked) {
        assembly ("memory-safe") {
            unlocked := sload(IS_UNLOCKED_SLOT)
        }
    }
}
