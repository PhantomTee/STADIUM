// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MatchOracle} from "../src/MatchOracle.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

/// @notice Seeds initial World Cup 2026 match data and registers all 32 teams
contract SetupMatches is Script {
    // World Cup 2026 Group Stage teams (all 32)
    string[32] teams = [
        "Argentina", "France", "Brazil", "England",
        "Germany", "Spain", "Portugal", "Netherlands",
        "Belgium", "Croatia", "Uruguay", "Mexico",
        "USA", "Canada", "Morocco", "Senegal",
        "Japan", "South Korea", "Australia", "Switzerland",
        "Denmark", "Poland", "Ecuador", "Cameroon",
        "Ghana", "Serbia", "Wales", "Qatar",
        "Saudi Arabia", "Iran", "Tunisia", "Costa Rica"
    ];

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Load deployed addresses
        string memory json = vm.readFile("./deployments.json");
        address oracleAddr = vm.parseJsonAddress(json, ".matchOracle");
        address hookAddr = vm.parseJsonAddress(json, ".convictionHook");
        address usdcAddr = vm.parseJsonAddress(json, ".mockUSDC");

        MatchOracle oracle = MatchOracle(oracleAddr);
        ConvictionHook hook = ConvictionHook(hookAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Register all 32 teams with dummy pool keys
        // (In production, actual V4 pool keys would be initialized)
        for (uint256 i = 0; i < 32; i++) {
            PoolKey memory key = PoolKey({
                currency0: Currency.wrap(usdcAddr),
                currency1: Currency.wrap(usdcAddr),
                fee: 3000,
                tickSpacing: 60,
                hooks: IHooks(hookAddr)
            });
            hook.registerTeam(teams[i], key);
            console.log("Registered team:", teams[i]);
        }

        // Seed Group Stage matches (first 8 representative matches)
        // Match IDs: 1-48 = Group Stage
        uint256 baseTime = block.timestamp + 1 days;

        oracle.createMatch(1, "Argentina", "Saudi Arabia", baseTime);
        oracle.createMatch(2, "France", "Australia", baseTime + 3 hours);
        oracle.createMatch(3, "Brazil", "Serbia", baseTime + 6 hours);
        oracle.createMatch(4, "England", "Iran", baseTime + 9 hours);
        oracle.createMatch(5, "Germany", "Japan", baseTime + 12 hours);
        oracle.createMatch(6, "Spain", "Costa Rica", baseTime + 15 hours);
        oracle.createMatch(7, "Portugal", "Ghana", baseTime + 18 hours);
        oracle.createMatch(8, "Netherlands", "Senegal", baseTime + 21 hours);
        oracle.createMatch(9, "Belgium", "Canada", baseTime + 1 days);
        oracle.createMatch(10, "Croatia", "Morocco", baseTime + 1 days + 3 hours);
        oracle.createMatch(11, "Uruguay", "South Korea", baseTime + 1 days + 6 hours);
        oracle.createMatch(12, "Mexico", "Poland", baseTime + 1 days + 9 hours);
        oracle.createMatch(13, "USA", "Wales", baseTime + 1 days + 12 hours);
        oracle.createMatch(14, "Qatar", "Ecuador", baseTime + 1 days + 15 hours);
        oracle.createMatch(15, "Tunisia", "Denmark", baseTime + 1 days + 18 hours);
        oracle.createMatch(16, "Switzerland", "Cameroon", baseTime + 1 days + 21 hours);

        console.log("\nGroup Stage matches created (IDs 1-16)");

        // Open VAR windows for first 2 matches (for demo)
        oracle.openVARWindow(1);
        oracle.openVARWindow(2);
        console.log("VAR windows opened for matches 1 and 2");

        vm.stopBroadcast();

        console.log("\n=== SETUP COMPLETE ===");
        console.log("32 teams registered");
        console.log("16 group stage matches created");
        console.log("VAR windows open for matches 1 & 2");
    }
}
