// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MatchOracle} from "../src/MatchOracle.sol";

/// @notice Creates demo matches in MatchOracle using createOrUpdateMatch.
///         Run after SeedTeams.s.sol.
///
/// Required env vars:
///   PRIVATE_KEY            - deployer private key
///   MATCH_ORACLE_ADDRESS   - deployed MatchOracle address
///
/// Usage:
///   forge script script/SeedMatches.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract SeedMatches is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracleAddr  = vm.envAddress("MATCH_ORACLE_ADDRESS");
        require(oracleAddr != address(0), "SeedMatches: set MATCH_ORACLE_ADDRESS");

        MatchOracle oracle = MatchOracle(oracleAddr);

        vm.startBroadcast(deployerKey);

        uint256 now_ = block.timestamp;

        // Match 1: Mexico (1) vs Argentina (37) - Group stage - 1h from now
        // externalFixtureId = 1001 (placeholder for API sync)
        oracle.createOrUpdateMatch(
            1001,           // externalFixtureId
            1,              // matchId
            1,              // teamAId: Mexico
            37,             // teamBId: Argentina
            now_ + 1 hours,
            MatchOracle.Stage.GROUP
        );
        console.log("Match 1: Mexico vs Argentina - VAR window can open now");

        // Match 2: South Korea (3) vs Austria (39) - Group stage - 2h from now
        oracle.createOrUpdateMatch(
            1002,
            2,
            3,              // teamAId: South Korea
            39,             // teamBId: Austria
            now_ + 2 hours,
            MatchOracle.Stage.GROUP
        );
        console.log("Match 2: South Korea vs Austria");

        // Match 3: France (33) vs Brazil (9) - Round of 16 - 4h from now
        oracle.createOrUpdateMatch(
            1003,
            3,
            33,             // teamAId: France
            9,              // teamBId: Brazil
            now_ + 4 hours,
            MatchOracle.Stage.ROUND_OF_16
        );
        console.log("Match 3: France vs Brazil (Round of 16)");

        // Open VAR window for match 1 — guard against re-run revert ("already open")
        if (oracle.matchExists(1)) {
            MatchOracle.Match memory m1 = oracle.getMatch(1);
            if (!m1.varOpen && !m1.varClosed && !m1.settled) {
                oracle.openVARWindow(1);
                console.log("VAR window opened for Match 1");
            } else {
                console.log("VAR window already open/closed for Match 1 - skipping");
            }
        }

        vm.stopBroadcast();

        console.log("\n=== MATCH SEED COMPLETE ===");
        console.log("Match 1: Mexico(1) vs Argentina(37) - VAR OPEN");
        console.log("Match 2: S.Korea(3) vs Austria(39)  - upcoming");
        console.log("Match 3: France(33) vs Brazil(9)    - upcoming (Round of 16)");
        console.log("\nDemo flow:");
        console.log("1. Faucet USDC:     mockUSDC.faucet()");
        console.log("2. Approve vault:   usdc.approve(vaultAddr, amount)");
        console.log("3. Back a team:     vault.depositConviction(37, amount) [Argentina]");
        console.log("4. Place VAR bet:   varMarket.placeBet(1, 0, 1, amount) [Argentina wins]");
        console.log("5. Close betting:   oracle.startMatch(1)");
        console.log("6. Post result:     oracle.postResult(1, 1, 1, false, false)");
        console.log("7. Claim payout:    varMarket.claimPayout(1, 0)");
        console.log("8. Eliminate team:  oracle.postElimination(1) [Mexico out]");
        console.log("9. Claim yield:     vault.claimYield()");
    }
}
