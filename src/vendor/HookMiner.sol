// SPDX-License-Identifier: GPL-2.0-or-later
// Vendored from Uniswap v4-periphery. Mines a CREATE2 salt whose resulting address
// encodes the required Uniswap V4 hook permission bits in its lower 14 bits.
pragma solidity ^0.8.0;

library HookMiner {
    // The bottom 14 bits of a hook address encode its permissions.
    uint160 internal constant FLAG_MASK = (1 << 14) - 1;

    /// @notice Find a salt such that CREATE2(deployer, salt, keccak256(initCode)) has
    ///         the required flag bits set in its address.
    /// @param deployer       The CREATE2 deployer address (typically address(this) in a script)
    /// @param flags          Required permission bits (bottom 14 bits of the address)
    /// @param creationCode   type(Contract).creationCode
    /// @param constructorArgs abi.encode(...) of constructor arguments
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal view returns (address hookAddress, bytes32 salt) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));
        uint160 targetFlags  = flags & FLAG_MASK;

        for (uint256 i = 0; ; i++) {
            salt = bytes32(i);
            hookAddress = computeAddress(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & FLAG_MASK == targetFlags) {
                return (hookAddress, salt);
            }
        }
    }

    /// @notice Compute the CREATE2 address without deploying.
    function computeAddress(address deployer, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        return address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)
        ))));
    }
}
