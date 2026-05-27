// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {TeamToken} from "./TeamToken.sol";

/// @notice Deploys TeamToken ERC20s and registers them as Uniswap V4 pools.
///         One factory per tournament. Owner configures the hook address after deployment.
contract TeamFactory is Ownable {
    using PoolIdLibrary for PoolKey;

    // ─────────────────────────────── Custom errors ───────────────────────────────

    error TeamAlreadyRegistered(uint16 teamId);
    error TeamNotRegistered(uint16 teamId);
    error PoolAlreadyCreated(uint16 teamId);
    error ZeroAddress();

    // ─────────────────────────────── Structs ───────────────────────────────

    struct TeamInfo {
        uint16  teamId;
        address token;
        bytes32 poolId;
        bool    active;
    }

    // ─────────────────────────────── State ───────────────────────────────

    IPoolManager public immutable poolManager;
    address      public immutable usdc;
    address      public hook;

    mapping(uint16 => address)  public teamToken;
    mapping(uint16 => bytes32)  public teamPoolId;
    uint16[]                    public registeredTeamIds;

    // ─────────────────────────────── Events ───────────────────────────────

    event TeamRegistered(uint16 indexed teamId, address token);
    event TeamPoolCreated(uint16 indexed teamId, bytes32 indexed poolId);
    event HookUpdated(address hook);

    // ─────────────────────────────── Constructor ───────────────────────────────

    constructor(
        address _poolManager,
        address _usdc,
        address _hook,
        address _owner
    ) Ownable(_owner) {
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();
        poolManager = IPoolManager(_poolManager);
        usdc        = _usdc;
        hook        = _hook; // may be address(0) until hook is mined and deployed
    }

    // ─────────────────────────────── Admin ───────────────────────────────

    /// @notice Set or update the hook address (needed before creating pools).
    function setHook(address _hook) external onlyOwner {
        hook = _hook;
        emit HookUpdated(_hook);
    }

    // ─────────────────────────────── Owner: team & pool management ───────────────────────────────

    /// @notice Deploy a new TeamToken and register the team.
    ///         Mints 1_000_000e18 tokens to this factory.
    function registerTeam(
        uint16 teamId,
        string calldata name,
        string calldata symbol
    ) external onlyOwner {
        if (teamToken[teamId] != address(0)) revert TeamAlreadyRegistered(teamId);

        TeamToken token = new TeamToken(
            teamId,
            name,
            symbol,
            address(this),
            1_000_000e18
        );

        teamToken[teamId] = address(token);
        registeredTeamIds.push(teamId);

        emit TeamRegistered(teamId, address(token));
    }

    /// @notice Initialize a Uniswap V4 pool for a registered team token vs USDC.
    ///         Uses DYNAMIC_FEE_FLAG so the StadiumHook controls fees.
    function createTeamPool(
        uint16  teamId,
        int24   tickSpacing,
        uint160 sqrtPriceX96
    ) external onlyOwner {
        address token = teamToken[teamId];
        if (token == address(0)) revert TeamNotRegistered(teamId);
        if (teamPoolId[teamId] != bytes32(0)) revert PoolAlreadyCreated(teamId);

        // Sort: Currency.wrap sorts by address value; lower address is currency0
        (Currency currency0, Currency currency1) = usdc < token
            ? (Currency.wrap(usdc), Currency.wrap(token))
            : (Currency.wrap(token), Currency.wrap(usdc));

        PoolKey memory key = PoolKey({
            currency0:   currency0,
            currency1:   currency1,
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks:       IHooks(hook)
        });

        PoolId pid = key.toId();
        poolManager.initialize(key, sqrtPriceX96);

        teamPoolId[teamId] = PoolId.unwrap(pid);

        emit TeamPoolCreated(teamId, PoolId.unwrap(pid));
    }

    // ─────────────────────────────── View ───────────────────────────────

    function getTeamInfo(uint16 teamId) external view returns (TeamInfo memory info) {
        info.teamId = teamId;
        info.token  = teamToken[teamId];
        info.poolId = teamPoolId[teamId];
        info.active = info.token != address(0);
    }

    function getAllTeams() external view returns (uint16[] memory) {
        return registeredTeamIds;
    }

    function registeredTeamCount() external view returns (uint256) {
        return registeredTeamIds.length;
    }
}
