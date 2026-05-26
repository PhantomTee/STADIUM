// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IConvictionHook {
    function getTeamBackers(string memory team) external view returns (address[] memory);
    function convictionDeposit(address user, string memory team) external view returns (uint256);
    function totalConvictionLocked(string memory team) external view returns (uint256);
}

/// @notice Accumulates losses and distributes to champion backers at tournament end
contract ChampionPool is ReentrancyGuard {
    IERC20 public immutable usdc;

    address public convictionHook;
    address public varMarket;
    address public oracle;

    uint256 public totalAccumulated;
    bool public distributionComplete;
    string public champion;

    event Deposited(address indexed from, uint256 amount);
    event Distributed(string winningTeam, uint256 totalDistributed);
    event BackerPaid(address indexed backer, uint256 amount);

    modifier onlyAuthorized() {
        require(
            msg.sender == convictionHook || msg.sender == varMarket,
            "ChampionPool: unauthorized"
        );
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "ChampionPool: not oracle");
        _;
    }

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function setAddresses(address _convictionHook, address _varMarket, address _oracle) external {
        require(oracle == address(0), "ChampionPool: already set");
        convictionHook = _convictionHook;
        varMarket = _varMarket;
        oracle = _oracle;
    }

    /// @notice Called by ConvictionHook or VARMarket to accumulate funds
    function deposit(uint256 amount) external onlyAuthorized {
        require(usdc.transferFrom(msg.sender, address(this), amount), "ChampionPool: transfer failed");
        totalAccumulated += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Internal deposit that assumes tokens are already sent
    function recordDeposit(uint256 amount) external onlyAuthorized {
        totalAccumulated += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Oracle triggers distribution to champion backers
    function distribute(string memory winningTeam) external onlyOracle nonReentrant {
        require(!distributionComplete, "ChampionPool: already distributed");
        distributionComplete = true;
        champion = winningTeam;

        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) {
            emit Distributed(winningTeam, 0);
            return;
        }

        address[] memory backers = IConvictionHook(convictionHook).getTeamBackers(winningTeam);
        uint256 teamTotal = IConvictionHook(convictionHook).totalConvictionLocked(winningTeam);

        if (backers.length == 0 || teamTotal == 0) {
            emit Distributed(winningTeam, 0);
            return;
        }

        uint256 distributed = 0;
        for (uint256 i = 0; i < backers.length; i++) {
            address backer = backers[i];
            uint256 deposit_ = IConvictionHook(convictionHook).convictionDeposit(backer, winningTeam);
            if (deposit_ == 0) continue;
            uint256 share = (deposit_ * balance) / teamTotal;
            if (share > 0) {
                usdc.transfer(backer, share);
                distributed += share;
                emit BackerPaid(backer, share);
            }
        }

        emit Distributed(winningTeam, distributed);
    }

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
