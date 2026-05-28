// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StadiumLiquidityRouter} from "../src/StadiumLiquidityRouter.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITeamFactory {
    function teamToken(uint16 teamId) external view returns (address);
    function teamPoolId(uint16 teamId) external view returns (bytes32);
    function usdc() external view returns (address);
    function hook() external view returns (address);
    function getAllTeams() external view returns (uint16[] memory);
    function distributeToken(uint16 teamId, address to, uint256 amount) external;
}

interface IMockUSDC {
    function mint(address to, uint256 amount) external;
}

interface IStadiumHook {
    function registerPool(PoolKey calldata key, uint16 teamId) external;
}

/// @notice Seeds initial full-range liquidity for every registered team pool.
///
/// Required env vars:
///   PRIVATE_KEY            - deployer key (factory owner and hook owner)
///   POOL_MANAGER_ADDRESS
///   TEAM_FACTORY_ADDRESS
///   MOCK_USDC_ADDRESS
///   STADIUM_HOOK_ADDRESS
///
/// Usage:
///   forge script script/SeedLiquidity.s.sol \
///     --rpc-url $XLAYER_RPC_URL --broadcast
contract SeedLiquidity is Script {
    int24 constant TICK_SPACING = 60;
    int24 constant TICK_LOWER   = -887220;  // floor(MAX_TICK / tickSpacing) * tickSpacing
    int24 constant TICK_UPPER   =  887220;

    // liquidityDelta for initial position - generous amount so small swaps work cleanly
    int256 constant LIQUIDITY_DELTA = 1e24;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address poolMgr     = vm.envAddress("POOL_MANAGER_ADDRESS");
        address factoryAddr = vm.envAddress("TEAM_FACTORY_ADDRESS");
        address usdcAddr    = vm.envAddress("MOCK_USDC_ADDRESS");
        address hookAddr    = vm.envAddress("STADIUM_HOOK_ADDRESS");

        ITeamFactory factory = ITeamFactory(factoryAddr);
        address deployer     = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // -- Deploy liquidity router --------------------------------------------------
        StadiumLiquidityRouter liqRouter = new StadiumLiquidityRouter(poolMgr);
        console.log("StadiumLiquidityRouter deployed at:", address(liqRouter));

        // -- Mint USDC to deployer (testnet mint) ------------------------------------
        uint16[] memory ids = factory.getAllTeams();
        uint256 usdcNeeded  = 2_000_000e6; // 2M USDC total buffer
        IMockUSDC(usdcAddr).mint(deployer, usdcNeeded);
        IERC20(usdcAddr).approve(address(liqRouter), type(uint256).max);
        console.log("Minted USDC and approved router");

        // -- Seed each team pool ------------------------------------------------------
        uint256 seeded     = 0;
        uint256 registered = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            uint16  teamId = ids[i];
            address token  = factory.teamToken(teamId);
            if (token == address(0) || factory.teamPoolId(teamId) == bytes32(0)) continue;

            // Try to get team tokens from factory. distributeToken may not exist in older
            // deployments - catch the revert silently and continue with whatever balance
            // the deployer already holds.
            uint256 factoryBal = IERC20(token).balanceOf(address(factory));
            if (factoryBal > 0) {
                uint256 toDistribute = factoryBal < 1_000_000e18 ? factoryBal : 1_000_000e18;
                (bool ok,) = address(factory).call(
                    abi.encodeWithSignature("distributeToken(uint16,address,uint256)", teamId, deployer, toDistribute)
                );
                if (!ok) {
                    console.log("distributeToken unavailable for team", teamId, "(older factory) - skipping");
                }
            }
            IERC20(token).approve(address(liqRouter), type(uint256).max);

            (Currency c0, Currency c1) = usdcAddr < token
                ? (Currency.wrap(usdcAddr), Currency.wrap(token))
                : (Currency.wrap(token),    Currency.wrap(usdcAddr));

            PoolKey memory key = PoolKey({
                currency0:   c0,
                currency1:   c1,
                fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
                tickSpacing: TICK_SPACING,
                hooks:       IHooks(hookAddr)
            });

            // Register pool in hook so beforeAddLiquidity/beforeSwap don't revert
            // PoolNotRegistered. Silently skip if already registered or access denied.
            try IStadiumHook(hookAddr).registerPool(key, teamId) {
                registered++;
                console.log("Registered pool in hook for team", teamId);
            } catch {
                // Already registered or not owner - continue
            }

            // Skip addLiquidity when deployer has no team tokens to provide.
            // This happens with older factory deployments that lack distributeToken.
            if (IERC20(token).balanceOf(deployer) == 0) {
                console.log("No team tokens for team", teamId, "- skipping addLiquidity");
                continue;
            }

            try liqRouter.addLiquidity(
                key,
                TICK_LOWER,
                TICK_UPPER,
                LIQUIDITY_DELTA,
                block.timestamp + 3600
            ) {
                seeded++;
                console.log("Seeded liquidity for team", teamId);
            } catch {
                console.log("addLiquidity failed for team", teamId);
            }
        }

        vm.stopBroadcast();

        console.log("Pools registered in hook:", registered, "/", ids.length);
        console.log("Pools seeded:", seeded, "/", ids.length);
        if (seeded == 0) {
            console.log("NOTE: 0 pools seeded. Re-run with force_redeploy=true after");
            console.log("      redeploying TeamFactory so distributeToken is available.");
        }

        // Write address to JSON for CI merge step
        string memory json = string.concat(
            '{\n  "stadiumLiquidityRouter": "', vm.toString(address(liqRouter)), '"\n}'
        );
        vm.writeFile("./liquidity-deployment.json", json);
        console.log("Liquidity router address written to liquidity-deployment.json");
        console.log("\nUpdate frontend/.env:");
        console.log("VITE_STADIUM_LIQUIDITY_ROUTER_ADDRESS=%s", address(liqRouter));
    }
}
