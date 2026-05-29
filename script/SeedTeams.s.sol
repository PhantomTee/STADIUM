// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MatchOracle} from "../src/MatchOracle.sol";

/// @notice Registers all 48 World Cup 2026 teams in MatchOracle,
///         which propagates to ConvictionVault via oracle.registerTeam().
///
/// Required env vars:
///   PRIVATE_KEY            — deployer private key
///   MATCH_ORACLE_ADDRESS   — deployed MatchOracle address
///
/// Usage:
///   forge script script/SeedTeams.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract SeedTeams is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracleAddr  = vm.envAddress("MATCH_ORACLE_ADDRESS");
        require(oracleAddr != address(0), "SeedTeams: set MATCH_ORACLE_ADDRESS");

        MatchOracle oracle = MatchOracle(oracleAddr);

        vm.startBroadcast(deployerKey);

        // Group A
        _register(oracle, 1,  "Mexico");
        _register(oracle, 2,  "South Africa");
        _register(oracle, 3,  "South Korea");
        _register(oracle, 4,  "Czechia");

        // Group B
        _register(oracle, 5,  "Canada");
        _register(oracle, 6,  "Bosnia");
        _register(oracle, 7,  "Qatar");
        _register(oracle, 8,  "Switzerland");

        // Group C
        _register(oracle, 9,  "Brazil");
        _register(oracle, 10, "Morocco");
        _register(oracle, 11, "Haiti");
        _register(oracle, 12, "Scotland");

        // Group D
        _register(oracle, 13, "USA");
        _register(oracle, 14, "Paraguay");
        _register(oracle, 15, "Australia");
        _register(oracle, 16, "Turkiye");

        // Group E
        _register(oracle, 17, "Germany");
        _register(oracle, 18, "Curacao");
        _register(oracle, 19, "Ivory Coast");
        _register(oracle, 20, "Ecuador");

        // Group F
        _register(oracle, 21, "Netherlands");
        _register(oracle, 22, "Japan");
        _register(oracle, 23, "Sweden");
        _register(oracle, 24, "Tunisia");

        // Group G
        _register(oracle, 25, "Belgium");
        _register(oracle, 26, "Egypt");
        _register(oracle, 27, "Iran");
        _register(oracle, 28, "New Zealand");

        // Group H
        _register(oracle, 29, "Spain");
        _register(oracle, 30, "Cape Verde");
        _register(oracle, 31, "Saudi Arabia");
        _register(oracle, 32, "Uruguay");

        // Group I
        _register(oracle, 33, "France");
        _register(oracle, 34, "Senegal");
        _register(oracle, 35, "Iraq");
        _register(oracle, 36, "Norway");

        // Group J
        _register(oracle, 37, "Argentina");
        _register(oracle, 38, "Algeria");
        _register(oracle, 39, "Austria");
        _register(oracle, 40, "Jordan");

        // Group K
        _register(oracle, 41, "Portugal");
        _register(oracle, 42, "Congo DR");
        _register(oracle, 43, "Uzbekistan");
        _register(oracle, 44, "Colombia");

        // Group L
        _register(oracle, 45, "England");
        _register(oracle, 46, "Croatia");
        _register(oracle, 47, "Ghana");
        _register(oracle, 48, "Panama");

        vm.stopBroadcast();

        console.log("\n=== TEAM SEED COMPLETE ===");
        console.log("Registered all 48 WC 2026 teams in MatchOracle:", oracleAddr);
        console.log("Teams propagated to ConvictionVault via onlyOracle.");
    }

    function _register(MatchOracle oracle, uint16 teamId, string memory name) internal {
        // Skip teams that are already registered to avoid reverting broadcast transactions.
        // Forge's simulation fails if any broadcast transaction reverts, even inside try/catch.
        if (oracle.getTeam(teamId).registered) {
            console.log(string.concat("Skipped (already registered): ", name));
            return;
        }
        oracle.registerTeam(teamId, name);
        console.log(string.concat("Registered: ", name, " (id=", vm.toString(uint256(teamId)), ")"));
    }
}
