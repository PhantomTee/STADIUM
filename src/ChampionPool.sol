// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IConvictionHook {
    function getTeamBackers(string memory team) external view returns (address[] memory);
    function convictionDeposit(address user, string memory team) external view returns (uint256);
    function totalConvictionLocked(string memory team) external view returns (uint256);
}

/// @notice Accumulates USDC losses and distributes to World Cup champion backers
contract ChampionPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    constructor(address _usdc, address initialOwner) Ownable(initialOwner) {
        require(_usdc != address(0), "ChampionPool: zero usdc");
        usdc = IERC20(_usdc);
    }

    /// @notice One-time address wiring, owner only
    function setAddresses(address _convictionHook, address _varMarket, address _oracle) external onlyOwner {
        require(oracle == address(0), "ChampionPool: already set");
        require(_convictionHook != address(0), "ChampionPool: zero hook");
        require(_varMarket != address(0), "ChampionPool: zero market");
        require(_oracle != address(0), "ChampionPool: zero oracle");
        convictionHook = _convictionHook;
        varMarket = _varMarket;
        oracle = _oracle;
    }

    /// @notice Tokens are transferred directly; this call just updates the accounting counter
    function recordDeposit(uint256 amount) external onlyAuthorized {
        totalAccumulated += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Oracle triggers proportional distribution to champion backers.
    ///         Must be called BEFORE ConvictionHook.settleChampion() so deposits are still non-zero.
    function distribute(string memory winningTeam) external onlyOracle nonReentrant {
        require(!distributionComplete, "ChampionPool: already distributed");

        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) {
            distributionComplete = true;
            champion = winningTeam;
            emit Distributed(winningTeam, 0);
            return;
        }

        address[] memory backers = IConvictionHook(convictionHook).getTeamBackers(winningTeam);
        uint256 teamTotal = IConvictionHook(convictionHook).totalConvictionLocked(winningTeam);

        if (backers.length == 0 || teamTotal == 0) {
            distributionComplete = true;
            champion = winningTeam;
            emit Distributed(winningTeam, 0);
            return;
        }

        uint256 distributed = 0;
        for (uint256 i = 0; i < backers.length; i++) {
            address backer = backers[i];
            uint256 backerDeposit = IConvictionHook(convictionHook).convictionDeposit(backer, winningTeam);
            if (backerDeposit == 0) continue;
            uint256 share = (backerDeposit * balance) / teamTotal;
            if (share > 0) {
                usdc.safeTransfer(backer, share);
                distributed += share;
                emit BackerPaid(backer, share);
            }
        }

        // Mark complete only after all transfers succeed
        distributionComplete = true;
        champion = winningTeam;
        emit Distributed(winningTeam, distributed);
    }

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
