// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Simple protocol treasury. Accepts inbound USDC from protocol contracts
///         and allows the owner to withdraw to any destination.
contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────── State ───────────────────────────────

    IERC20 public immutable usdc;

    /// @notice Total USDC recorded via receiveFor across all sources
    uint256 public totalReceived;

    /// @notice Per-source accumulated total
    mapping(string => uint256) public sourceTotal;

    /// @notice Addresses authorized to call receiveFor (protocol contracts only)
    mapping(address => bool) public authorized;

    // ─────────────────────────────── Events ───────────────────────────────

    event TreasuryReceived(address indexed from, uint256 amount, string source);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event AuthorizationUpdated(address indexed addr, bool status);

    // ─────────────────────────────── Constructor ───────────────────────────────

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Treasury: not authorized");
        _;
    }

    constructor(address _owner, address _usdc) Ownable(_owner) {
        require(_usdc != address(0), "Treasury: zero usdc");
        usdc = IERC20(_usdc);
    }

    // ─────────────────────────────── Authorization ───────────────────────────────

    /// @notice Grant or revoke authorization to call receiveFor.
    function setAuthorized(address _addr, bool _status) external onlyOwner {
        require(_addr != address(0), "Treasury: zero address");
        authorized[_addr] = _status;
        emit AuthorizationUpdated(_addr, _status);
    }

    // ─────────────────────────────── Inbound recording ───────────────────────────────

    /// @notice Called by authorized protocol contracts to record an inbound deposit
    ///         (tokens must already be here). Emits TreasuryReceived and updates cumulative totals.
    function receiveFor(string calldata source, uint256 amount) external onlyAuthorized {
        totalReceived += amount;
        sourceTotal[source] += amount;
        emit TreasuryReceived(msg.sender, amount, source);
    }

    // ─────────────────────────────── Withdrawal ───────────────────────────────

    /// @notice Owner withdraws any ERC20 token (including USDC) from this contract.
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Treasury: zero to");
        require(amount > 0, "Treasury: zero amount");
        IERC20(token).safeTransfer(to, amount);
        emit TreasuryWithdrawn(to, amount);
    }
}
