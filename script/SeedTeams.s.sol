// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MatchOracle} from "../src/MatchOracle.sol";

/// @notice Seeds all 8 demo teams in MatchOracle (which propagates to ConvictionVault).
///         Replaces the team-registration portion of the old SeedDemo.s.sol.
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

        // Notable teams
        _register(oracle, 9,  "Brazil");
        _register(oracle, 10, "Spain");
        _register(oracle, 26, "Germany");
        _register(oracle, 33, "France");
        _register(oracle, 37, "Argentina");
        _register(oracle, 38, "Algeria");
        _register(oracle, 39, "Austria");
        _register(oracle, 40, "Jordan");
        _register(oracle, 45, "England");

        vm.stopBroadcast();

        console.log("\n=== TEAM SEED COMPLETE ===");
        console.log("Registered teams in MatchOracle:", oracleAddr);
        console.log("Teams: Mexico(1), South Africa(2), South Korea(3), Czechia(4)");
        console.log("       Brazil(9), Spain(10), Germany(26), France(33)");
        console.log("       Argentina(37), Algeria(38), Austria(39), Jordan(40), England(45)");
        console.log("\nRun SeedMatches.s.sol next to create demo matches.");
    }

    function _register(MatchOracle oracle, uint16 teamId, string memory name) internal {
        try oracle.registerTeam(teamId, name) {
            console.log(string.concat("Registered: ", name, " (id=", vm.toString(uint256(teamId)), ")"));
        } catch {
            console.log(string.concat("Skipped (already registered): ", name));
        }
    }
}
