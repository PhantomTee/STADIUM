// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IConvictionVault {
    function teamTotalDeposit(uint16 teamId) external view returns (uint256);
    function getUserDeposit(address user, uint16 teamId) external view returns (uint256);
}

/// @notice Pull-based champion pool. Accumulates USDC from eliminations and VAR market losses,
///         then allows champion backers to pull their proportional share once the champion is set.
///
/// Share math:
///   share = userDeposit * championPoolSnapshot / totalChampionStake
///
/// CRITICAL ORDER (enforced by MatchOracle):
///   1. ChampionPool.setChampion() must be called FIRST — reads vault.teamTotalDeposit() before
///      any champion principal claims could drain deposits.
///   2. ConvictionVault.setChampion() is called SECOND — allows principal claims.
contract ChampionPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────── State ───────────────────────────────

    IERC20 public immutable usdc;

    IConvictionVault public vault;
    address public varMarket;
    address public oracle;

    /// @notice Which addresses can call recordDeposit (convictionVault + varMarket)
    mapping(address => bool) public authorized;

    /// @notice Cumulative USDC recorded via recordDeposit
    uint256 public totalAccumulated;

    uint16  public championTeamId;
    /// @notice USDC balance of this contract at the moment setChampion was called
    uint256 public championPoolSnapshot;
    /// @notice vault.teamTotalDeposit(championTeamId) at the moment setChampion was called
    uint256 public totalChampionStake;
    bool    public championSet;

    /// @notice Per-user-team claim guard
    mapping(address => mapping(uint16 => bool)) public champClaimed;

    // ─────────────────────────────── Events ───────────────────────────────

    /// @notice Per-source accumulated totals (for recordFor)
    mapping(string => uint256) public sourceTotal;

    event Deposited(address indexed from, uint256 amount);
    event DepositedFrom(address indexed from, uint256 amount, string source);
    event ChampionDeclared(uint16 indexed teamId, uint256 poolSnapshot, uint256 totalStake);
    event ChampionShareClaimed(address indexed user, uint16 indexed teamId, uint256 share);

    // ─────────────────────────────── Modifiers ───────────────────────────────

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "ChampionPool: not authorized");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "ChampionPool: not oracle");
        _;
    }

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "ChampionPool: zero usdc");
        usdc = IERC20(_usdc);
    }

    // ─────────────────────────────── Admin ───────────────────────────────

    /// @notice Wire up vault, varMarket, and oracle. Can be called by owner; updates addresses.
    function setAddresses(
        address _vault,
        address _varMarket,
        address _oracle
    ) external onlyOwner {
        require(_vault    != address(0), "ChampionPool: zero vault");
        require(_varMarket != address(0), "ChampionPool: zero varMarket");
        require(_oracle   != address(0), "ChampionPool: zero oracle");

        // Revoke old authorizations
        if (address(vault) != address(0)) authorized[address(vault)]    = false;
        if (varMarket      != address(0)) authorized[varMarket]         = false;

        vault    = IConvictionVault(_vault);
        varMarket = _varMarket;
        oracle   = _oracle;

        // Grant new authorizations
        authorized[_vault]    = true;
        authorized[_varMarket] = true;
    }

    // ─────────────────────────────── Authorized inflow ───────────────────────────────

    /// @notice Record an inbound USDC deposit (tokens must already be transferred to this contract).
    ///         Called by ConvictionVault and VARMarket after safeTransfer.
    function recordDeposit(uint256 amount) external onlyAuthorized {
        totalAccumulated += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Record a sourced deposit (tokens must already be transferred to this contract).
    ///         Called by StadiumHook with source = "hook". Tracks per-source totals.
    function recordFor(uint256 amount, string calldata source) external onlyAuthorized {
        totalAccumulated += amount;
        sourceTotal[source] += amount;
        emit DepositedFrom(msg.sender, amount, source);
    }

    /// @notice Grant authorization to an additional address (e.g. StadiumHook).
    function addAuthorized(address _addr) external onlyOwner {
        require(_addr != address(0), "ChampionPool: zero address");
        authorized[_addr] = true;
    }

    /// @notice Revoke authorization from an address.
    function removeAuthorized(address _addr) external onlyOwner {
        authorized[_addr] = false;
    }

    // ─────────────────────────────── Oracle ───────────────────────────────

    /// @notice Snapshot the pool balance and champion stake. Must be called BEFORE
    ///         ConvictionVault.setChampion() so teamTotalDeposit is still intact.
    function setChampion(uint16 teamId) external onlyOracle {
        require(!championSet, "ChampionPool: champion already set");

        // Snapshot total champion stake from vault (read before any claims can drain it)
        totalChampionStake   = vault.teamTotalDeposit(teamId);
        // Snapshot current USDC balance of this contract
        championPoolSnapshot = usdc.balanceOf(address(this));
        championTeamId       = teamId;
        championSet          = true;

        emit ChampionDeclared(teamId, championPoolSnapshot, totalChampionStake);
    }

    // ─────────────────────────────── User: claim ───────────────────────────────

    /// @notice Pull proportional share of the champion pool.
    ///         share = userDeposit * championPoolSnapshot / totalChampionStake
    function claimChampionPool(uint16 teamId) external nonReentrant {
        require(championSet,                "ChampionPool: champion not set");
        require(teamId == championTeamId,   "ChampionPool: wrong team");
        require(!champClaimed[msg.sender][teamId], "ChampionPool: already claimed");

        uint256 dep = vault.getUserDeposit(msg.sender, teamId);
        require(dep > 0,                    "ChampionPool: no deposit");
        require(totalChampionStake > 0,     "ChampionPool: zero stake");

        champClaimed[msg.sender][teamId] = true;

        uint256 share = dep * championPoolSnapshot / totalChampionStake;
        if (share > 0) {
            usdc.safeTransfer(msg.sender, share);
        }

        emit ChampionShareClaimed(msg.sender, teamId, share);
    }

    // ─────────────────────────────── View ───────────────────────────────

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
