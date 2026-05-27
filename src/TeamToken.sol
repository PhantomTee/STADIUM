// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 token representing a team in the STADIUM protocol.
///         Deployed by TeamFactory. Initial supply minted to the factory.
contract TeamToken is ERC20 {
    /// @notice The ID of the team this token represents (matches MatchOracle teamId)
    uint16 public immutable teamId;

    /// @notice The factory that deployed this token
    address public immutable factory;

    constructor(
        uint16 teamId_,
        string memory name_,
        string memory symbol_,
        address factory_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) {
        require(factory_ != address(0), "TeamToken: zero factory");
        teamId  = teamId_;
        factory = factory_;
        _mint(factory_, initialSupply);
    }
}
