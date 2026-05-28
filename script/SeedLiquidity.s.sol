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

/// @notice Seeds initial full-range liquidity for every registered team pool.
///
/// Required env vars:
///   PRIVATE_KEY            — deployer key (factory owner)
///   POOL_MANAGER_ADDRESS
///   TEAM_FACTORY_ADDRESS   — the NEW factory from RedeployTeams.s.sol
///   MOCK_USDC_ADDRESS
///   STADIUM_HOOK_ADDRESS
///
/// Optional:
///   USDC_PER_POOL          — USDC display amount per pool (default 1000)
///   TOKENS_PER_POOL        — Team tokens display amount per pool (default 1000)
///
/// Usage:
///   forge script script/SeedLiquidity.s.sol \
///     --rpc-url $XLAYER_RPC_URL --broadcast
contract SeedLiquidity is Script {
    int24 constant TICK_SPACING = 60;
    int24 constant TICK_LOWER   = -887220;  // floor(MAX_TICK / tickSpacing) * tickSpacing
    int24 constant TICK_UPPER   =  887220;

    // liquidityDelta for initial position — generous amount so small swaps work cleanly
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

        // ── Deploy liquidity router ─────────────────────────────────────────
        StadiumLiquidityRouter liqRouter = new StadiumLiquidityRouter(poolMgr);
        console.log("StadiumLiquidityRouter deployed at:", address(liqRouter));

        // ── Mint USDC to deployer (testnet mint) ────────────────────────────
        // Mint enough for all pools; MockUSDC has mint(address,uint256).
        uint16[] memory ids = factory.getAllTeams();
        uint256 usdcNeeded  = 2_000_000e6; // 2M USDC total buffer
        IMockUSDC(usdcAddr).mint(deployer, usdcNeeded);
        IERC20(usdcAddr).approve(address(liqRouter), type(uint256).max);
        console.log("Minted USDC and approved router");

        // ── Seed each team pool ─────────────────────────────────────────────
        uint256 seeded = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            uint16  teamId = ids[i];
            address token  = factory.teamToken(teamId);
            if (token == address(0) || factory.teamPoolId(teamId) == bytes32(0)) continue;

            // Transfer team tokens from factory to deployer
            factory.distributeToken(teamId, deployer, 1_000_000e18);
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

            try liqRouter.addLiquidity(
                key,
                TICK_LOWER,
                TICK_UPPER,
                LIQUIDITY_DELTA,
                block.timestamp + 3600
            ) {
                seeded++;
                console.log("Seeded liquidity for team", teamId);
            } catch (bytes memory err) {
                console.log("Failed for team", teamId);
                console.logBytes(err);
            }
        }

        vm.stopBroadcast();

        console.log("Pools seeded:", seeded, "/", ids.length);
        console.log("\nUpdate frontend/.env:");
        console.log("VITE_STADIUM_LIQUIDITY_ROUTER_ADDRESS=%s", address(liqRouter));
    }
}
