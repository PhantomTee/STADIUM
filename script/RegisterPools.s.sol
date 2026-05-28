// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

interface ITeamFactory {
    function teamToken(uint16 teamId) external view returns (address);
    function teamPoolId(uint16 teamId) external view returns (bytes32);
    function usdc() external view returns (address);
    function hook() external view returns (address);
    function getAllTeams() external view returns (uint16[] memory);
}

interface IStadiumHook {
    function registerPool(PoolKey calldata key, uint16 teamId) external;
}

/// @notice Registers already-initialized V4 pools in StadiumHook.
///
/// Must be run by the StadiumHook owner. Needed because CreatePools.s.sol
/// only calls PoolManager.initialize() — it never calls hook.registerPool().
///
/// Usage:
///   forge script script/RegisterPools.s.sol \
///     --rpc-url $XLAYER_RPC_URL --broadcast
contract RegisterPools is Script {
    int24 constant TICK_SPACING = 60;

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        address factoryAddr   = vm.envAddress("TEAM_FACTORY_ADDRESS");
        address hookAddr      = vm.envAddress("STADIUM_HOOK_ADDRESS");

        ITeamFactory factory = ITeamFactory(factoryAddr);
        IStadiumHook hook    = IStadiumHook(hookAddr);

        address usdc = factory.usdc();
        uint16[] memory ids = factory.getAllTeams();

        vm.startBroadcast(deployerKey);

        uint256 registered = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            uint16 teamId   = ids[i];
            address token   = factory.teamToken(teamId);
            if (token == address(0)) continue;
            if (factory.teamPoolId(teamId) == bytes32(0)) continue;

            (Currency c0, Currency c1) = usdc < token
                ? (Currency.wrap(usdc), Currency.wrap(token))
                : (Currency.wrap(token), Currency.wrap(usdc));

            PoolKey memory key = PoolKey({
                currency0:   c0,
                currency1:   c1,
                fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
                tickSpacing: TICK_SPACING,
                hooks:       IHooks(hookAddr)
            });

            try hook.registerPool(key, teamId) {
                registered++;
                console.log("Registered pool for team", teamId);
            } catch {
                console.log("Skip (already registered?) team", teamId);
            }
        }

        vm.stopBroadcast();
        console.log("Done. Pools registered:", registered);
    }
}
