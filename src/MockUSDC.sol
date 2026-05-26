// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet USDC with public mint and daily faucet
contract MockUSDC is ERC20 {
    uint8 private constant _DECIMALS = 6;
    uint256 private constant FAUCET_AMOUNT = 1000 * 10 ** 6; // 1000 USDC
    uint256 private constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucetTime;

    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Anyone can mint any amount — testnet only
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Mints 1000 USDC to caller, once per day
    function faucet() external {
        require(block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN, "Faucet: cooldown active");
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
