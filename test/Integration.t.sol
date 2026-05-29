// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ConvictionVault} from "../src/ConvictionVault.sol";
import {VARMarket}       from "../src/VARMarket.sol";
import {ChampionPool}    from "../src/ChampionPool.sol";
import {MatchOracle}     from "../src/MatchOracle.sol";
import {MockUSDC}        from "../src/MockUSDC.sol";
import {Treasury}        from "../src/Treasury.sol";

/// @notice Full protocol integration tests — connect all contracts
contract IntegrationTest is Test {
    MockUSDC        usdc;
    ConvictionVault vault;
    VARMarket       varMarket;
    ChampionPool    champPool;
    MatchOracle     oracle;

    address deployer  = address(this);
    address treasury  = makeAddr("treasury");

    address alice = makeAddr("alice"); // backs Argentina (id 37)
    address bob   = makeAddr("bob");   // backs France (id 33)

    uint16 constant ARG  = 37;
    uint16 constant FRA  = 33;
    uint16 constant BRA  = 9;

    uint256 constant MATCH_1 = 1001;

    function setUp() public {
        usdc      = new MockUSDC();
        champPool = new ChampionPool(address(usdc), deployer);
        oracle    = new MatchOracle(deployer, treasury);
        vault     = new ConvictionVault(address(usdc), treasury, deployer);
        varMarket = new VARMarket(
            address(usdc),
            address(oracle),
            address(vault),
            treasury,
            address(champPool)
        );

        // Wire addresses
        vault.setOracle(address(oracle));
        vault.setChampionPool(address(champPool));

        oracle.setAddresses(address(vault), address(varMarket), address(champPool));

        champPool.setAddresses(address(vault), address(varMarket), address(oracle));

        // Mint and approve
        usdc.mint(alice, 5_000e6);
        usdc.mint(bob,   5_000e6);

        vm.prank(alice); usdc.approve(address(vault),     type(uint256).max);
        vm.prank(alice); usdc.approve(address(varMarket), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(vault),     type(uint256).max);
        vm.prank(bob);   usdc.approve(address(varMarket), type(uint256).max);

        // Register teams
        oracle.registerTeam(ARG, "Argentina");
        oracle.registerTeam(FRA, "France");
        oracle.registerTeam(BRA, "Brazil");
    }

    // ── Test 1: Full elimination flow ─────────────────────────────────────────

    function test_EliminationFlow_EndToEnd() public {
        // Alice backs Argentina 1000, Bob backs France 1000
        vm.prank(alice); vault.depositConviction(ARG, 1_000e6);
        vm.prank(bob);   vault.depositConviction(FRA, 1_000e6);

        uint256 champBefore = usdc.balanceOf(address(champPool));

        // Argentina is eliminated
        oracle.postElimination(ARG);

        // forfeited = 500e6, champShare = 250e6 (50% of forfeited)
        assertEq(usdc.balanceOf(address(champPool)) - champBefore, 250e6, "Champ pool must receive 250e6");

        // Bob (France, alive) earned survivor yield: 500 * 20% = 100e6
        uint256 bobPending = vault.pendingYield(bob);
        assertApproxEqAbs(bobPending, 100e6, 1, "Bob survivor yield mismatch");

        // Alice can claim 50% refund
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.claimEliminatedPosition(ARG);
        assertApproxEqAbs(usdc.balanceOf(alice) - aliceBefore, 500e6, 1, "Alice 50% refund mismatch");
    }

    // ── Test 2: VAR bet → settle → claim flows through all contracts ─────────

    function test_VAR_PlaceBetSettleClaim() public {
        vm.prank(alice); vault.depositConviction(ARG, 500e6);

        // Create and open match
        oracle.createMatch(MATCH_1, ARG, FRA, block.timestamp + 3600);
        oracle.openVARWindow(MATCH_1);

        // Alice bets on Argentina (outcome 1)
        vm.prank(alice);
        varMarket.placeBet(MATCH_1, 0, 1, 100e6); // OUTCOME_TEAM_A = 1

        // Bob bets on France (outcome 2)
        vm.prank(bob);
        varMarket.placeBet(MATCH_1, 0, 2, 200e6); // OUTCOME_TEAM_B = 2

        oracle.startMatch(MATCH_1);

        // Post result: Argentina wins (winner=1, firstGoal=1, redCard=false, extraTime=false)
        oracle.postResult(MATCH_1, 1, 1, false, false);

        // Alice claims payout — should get bet back + winners pool share
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        varMarket.claimPayout(MATCH_1, 0);
        uint256 aliceGain = usdc.balanceOf(alice) - aliceBefore;

        // losingPool = 200e6, loserRefund = 20e6, remaining = 180e6
        // toWinners = 90e6, alice is only winner → total = 100 + 90 = 190e6
        assertApproxEqAbs(aliceGain, 190e6, 1, "Alice VAR payout mismatch");

        // Bob claims 10% refund
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        varMarket.claimPayout(MATCH_1, 0);
        assertApproxEqAbs(usdc.balanceOf(bob) - bobBefore, 20e6, 1, "Bob VAR refund mismatch");
    }

    // ── Test 3: Champion pool flow ────────────────────────────────────────────

    function test_ChampionPool_FlowEndToEnd() public {
        // Alice and Bob both back Argentina
        vm.prank(alice); vault.depositConviction(ARG, 1_000e6);
        vm.prank(bob);   vault.depositConviction(ARG, 1_000e6);

        // Fund champPool directly to simulate accumulated USDC
        champPool.addAuthorized(deployer);
        usdc.mint(address(champPool), 500e6);
        champPool.recordDeposit(500e6);

        // Declare champion — ChampionPool.setChampion first, then vault
        oracle.postChampion(ARG);

        // Snapshot = 500e6, totalStake = 2000e6 (alice + bob both 1000)
        assertEq(champPool.championPoolSnapshot(), 500e6);
        assertEq(champPool.totalChampionStake(),   2_000e6);

        // Alice claims half the pool (500e6 * 1000/2000 = 250e6)
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        champPool.claimChampionPool(ARG);
        assertApproxEqAbs(usdc.balanceOf(alice) - aliceBefore, 250e6, 1, "Alice champion pool share mismatch");

        // Alice also claims principal (using new claimChampionPosition alias)
        vm.prank(alice);
        vault.claimChampionPosition(ARG);
        assertApproxEqAbs(usdc.balanceOf(alice) - aliceBefore, 1_250e6, 1, "Alice champion total mismatch");
    }

    // ── Test 4: Treasury receives correct share on elimination ───────────────

    function test_Treasury_ReceivesShare() public {
        vm.prank(alice); vault.depositConviction(ARG, 1_000e6);
        vm.prank(bob);   vault.depositConviction(FRA, 1_000e6);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        oracle.postElimination(ARG);

        // forfeited = 500e6
        // survivorYield = 100e6 (20%) — stays in vault for bob to pull
        // champShare = 250e6 (50%) — to champPool
        // treasuryShare = 150e6 (30%)
        assertApproxEqAbs(usdc.balanceOf(treasury) - treasuryBefore, 150e6, 1, "Treasury share mismatch");
    }

    // ── Test 5: Treasury contract accounting ──────────────────────────────────

    function test_TreasuryContract_ReceiveFor() public {
        Treasury treasuryContract = new Treasury(deployer, address(usdc));
        treasuryContract.setAuthorized(deployer, true);

        usdc.mint(address(treasuryContract), 500e6);
        treasuryContract.receiveFor("elimination", 300e6);
        treasuryContract.receiveFor("var", 200e6);

        assertEq(treasuryContract.totalReceived(), 500e6);
        assertEq(treasuryContract.sourceTotal("elimination"), 300e6);
        assertEq(treasuryContract.sourceTotal("var"), 200e6);

        // Owner can withdraw
        uint256 before = usdc.balanceOf(treasury);
        treasuryContract.withdraw(address(usdc), treasury, 100e6);
        assertEq(usdc.balanceOf(treasury) - before, 100e6);
    }

    // ── Test 6: ChampionPool recordFor tracks source ──────────────────────────

    function test_ChampionPool_RecordFor_TracksSource() public {
        // Authorize deployer (test contract) as caller
        champPool.addAuthorized(deployer);

        usdc.mint(address(champPool), 300e6);

        champPool.recordFor(200e6, "hook");
        champPool.recordFor(100e6, "var");

        assertEq(champPool.totalAccumulated(), 300e6);
        assertEq(champPool.sourceTotal("hook"), 200e6);
        assertEq(champPool.sourceTotal("var"), 100e6);
    }

    // ── Test 7: getConvictionMultiplier two-team works in VAR context ─────────

    function test_ConvictionMultiplier_TwoTeam_VARContext() public {
        // Alice backs Argentina
        vm.prank(alice); vault.depositConviction(ARG, 500e6);

        // When checking for a match between ARG and FRA, alice should get 150
        assertEq(vault.getConvictionMultiplier(alice, ARG, FRA), 150, "Alice should get 150 (backs ARG)");
        // Bob who backs FRA should also get 150 in a ARG vs FRA match
        vm.prank(bob); vault.depositConviction(FRA, 100e6);
        assertEq(vault.getConvictionMultiplier(bob, ARG, FRA), 150, "Bob should get 150 (backs FRA)");
        // Carol with no conviction gets 100
        address carol = makeAddr("carol");
        assertEq(vault.getConvictionMultiplier(carol, ARG, FRA), 100, "Carol should get 100");
    }

    // ── Test 8: MatchOracle isTeamEliminated and getTeamStage ─────────────────

    function test_Oracle_IsTeamEliminated() public {
        assertFalse(oracle.isTeamEliminated(ARG), "Argentina not yet eliminated");

        oracle.postElimination(ARG);

        assertTrue(oracle.isTeamEliminated(ARG), "Argentina should be eliminated");

        // getTeamStage stub returns 0 for all teams
        assertEq(oracle.getTeamStage(ARG), 0, "Stage stub should return 0");
        assertEq(oracle.getTeamStage(FRA), 0, "Stage stub should return 0");
    }
}
