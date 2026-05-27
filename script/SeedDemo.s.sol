// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MatchOracle} from "../src/MatchOracle.sol";

/// @notice Seeds demo teams and matches for hackathon testing.
/// Run after Deploy.s.sol. Reads MatchOracle address from deployments.json
/// or from env var MATCH_ORACLE_ADDRESS.
///
/// Usage:
///   forge script script/SeedDemo.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract SeedDemo is Script {
    // Outcome constants (must match VARMarket)
    uint8 constant OUTCOME_NONE    = 0;
    uint8 constant OUTCOME_TEAM_A  = 1;
    uint8 constant OUTCOME_TEAM_B  = 2;
    uint8 constant OUTCOME_DRAW    = 3;
    uint8 constant OUTCOME_YES     = 4;
    uint8 constant OUTCOME_NO      = 5;
    uint8 constant OUTCOME_NO_GOAL = 6;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracleAddr  = vm.envAddress("MATCH_ORACLE_ADDRESS");
        require(oracleAddr != address(0), "SeedDemo: set MATCH_ORACLE_ADDRESS");

        MatchOracle oracle = MatchOracle(oracleAddr);

        vm.startBroadcast(deployerKey);

        // ── Register 8 demo teams (World Cup 2026 groups A & J) ──────────────
        // Group A
        oracle.registerTeam(1,  "Mexico");
        oracle.registerTeam(2,  "South Africa");
        oracle.registerTeam(3,  "South Korea");
        oracle.registerTeam(4,  "Czechia");
        // Group J (has Argentina)
        oracle.registerTeam(37, "Argentina");
        oracle.registerTeam(38, "Algeria");
        oracle.registerTeam(39, "Austria");
        oracle.registerTeam(40, "Jordan");

        console.log("Registered 8 demo teams");

        // ── Create 2 demo matches ────────────────────────────────────────────
        uint256 kickoff1 = block.timestamp + 1 hours;
        uint256 kickoff2 = block.timestamp + 2 hours;

        oracle.createMatch(1, 1,  37, kickoff1); // Mexico vs Argentina
        oracle.createMatch(2, 3,  39, kickoff2); // South Korea vs Austria

        console.log("Created 2 demo matches");

        // ── Open VAR window for match 1 ──────────────────────────────────────
        oracle.openVARWindow(1);
        console.log("VAR window opened for match 1 (Mexico vs Argentina)");

        vm.stopBroadcast();

        console.log("\n=== DEMO SEED COMPLETE ===");
        console.log("Match 1: Mexico (teamId=1) vs Argentina (teamId=37) — VAR OPEN");
        console.log("Match 2: South Korea (teamId=3) vs Austria (teamId=39) — upcoming");
        console.log("\nDemo flow:");
        console.log("1. Faucet USDC:     mockUSDC.faucet()");
        console.log("2. Approve vault:   usdc.approve(convictionVault, amount)");
        console.log("3. Back a team:     convictionVault.depositConviction(1, amount)");
        console.log("4. Place VAR bet:   varMarket.placeBet(1, 0, OUTCOME_TEAM_A, amount)");
        console.log("5. Start match:     oracle.startMatch(1)");
        console.log("6. Post result:     oracle.postResult(1, TEAM_A, TEAM_A, false, false)");
        console.log("7. Claim VAR:       varMarket.claimVAR(1, 0)");
        console.log("8. Eliminate team:  oracle.postElimination(2) [South Africa]");
        console.log("9. Claim yield:     convictionVault.claimYield()");
    }
}
