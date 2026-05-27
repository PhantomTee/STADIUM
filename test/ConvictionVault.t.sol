// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ConvictionVault} from "../src/ConvictionVault.sol";
import {MockUSDC}        from "../src/MockUSDC.sol";

/// @notice 9 tests covering the MasterChef accumulator logic for ConvictionVault
contract ConvictionVaultTest is Test {
    MockUSDC        usdc;
    ConvictionVault vault;

    address deployer  = address(this);
    address treasury  = makeAddr("treasury");
    address oracle    = makeAddr("oracle");

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");
    address carol = makeAddr("carol");

    uint16 constant TEAM_A = 1;
    uint16 constant TEAM_B = 2;
    uint16 constant TEAM_C = 3;

    function setUp() public {
        usdc  = new MockUSDC();
        vault = new ConvictionVault(address(usdc), treasury, deployer);
        vault.setOracle(oracle);

        // Fund users
        usdc.mint(alice, 1_000e6);
        usdc.mint(bob,   1_000e6);
        usdc.mint(carol, 1_000e6);

        // Register teams
        vm.startPrank(oracle);
        vault.registerTeam(TEAM_A, "Team A");
        vault.registerTeam(TEAM_B, "Team B");
        vault.registerTeam(TEAM_C, "Team C");
        vm.stopPrank();

        // Approve vault
        vm.prank(alice); usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(vault), type(uint256).max);
        vm.prank(carol); usdc.approve(address(vault), type(uint256).max);
    }

    // ── Test 1: Deposit updates teamTotalDeposit and totalAliveDeposits ──────

    function test_DepositUpdatesState() public {
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 100e6);

        assertEq(vault.teamTotalDeposit(TEAM_A), 100e6);
        assertEq(vault.totalAliveDeposits(),     100e6);
        assertEq(vault.deposits(alice, TEAM_A),  100e6);
        assertEq(vault.backerCount(TEAM_A),      1);
    }

    // ── Test 2: Second deposit from same user doesn't double-count backerCount ─

    function test_TopUpDoesNotDoubleBacker() public {
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 100e6);
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 50e6);

        assertEq(vault.backerCount(TEAM_A), 1);
        assertEq(vault.deposits(alice, TEAM_A), 150e6);
    }

    // ── Test 3: Accumulator increases after elimination ───────────────────────

    function test_AccYieldPerShareIncreasesOnElimination() public {
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 200e6);  // alive team
        vm.prank(bob);
        vault.depositConviction(TEAM_B, 100e6);  // team to eliminate

        uint256 accBefore = vault.accYieldPerShare();

        vm.prank(oracle);
        vault.settleElimination(TEAM_B);

        uint256 accAfter = vault.accYieldPerShare();
        assertGt(accAfter, accBefore, "accYieldPerShare must increase after elimination");
    }

    // ── Test 4: Eliminated-team backers get snapshot (stop earning) ──────────

    function test_EliminatedTeamBackersStopEarning() public {
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 200e6); // alive
        vm.prank(bob);
        vault.depositConviction(TEAM_B, 200e6); // will be eliminated

        // Eliminate Team B (bob's team) — alice earns, bob doesn't
        vm.prank(oracle);
        vault.settleElimination(TEAM_B);

        uint256 snapshot = vault.teamEliminationSnapshot(TEAM_B);
        assertEq(snapshot, vault.accYieldPerShare(), "Snapshot must equal current accYieldPerShare");

        // Eliminate Team C with zero stake — accumulator still changes if any alive deposits
        vm.prank(oracle);
        vault.registerTeam(4, "Team D");
        // Nothing to settle on Team D since it has no deposits

        // Bob's pending yield should NOT increase after Team B elimination
        uint256 pendingBob = vault.pendingYield(bob);
        // Bob had 200e6 deposit. At elimination, snapshot freezes bob's yield.
        // accYieldPerShare didn't change after snapshot, so pendingBob should be 0 (rewardDebt == earned)
        assertLe(pendingBob, 1, "Bob should have near-zero pending after snapshot");
    }

    // ── Test 5: Alive backers earn yield proportionally ───────────────────────

    function test_AliveBacker_EarnsProportionalYield() public {
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 200e6); // 2/3 of alive pool
        vm.prank(carol);
        vault.depositConviction(TEAM_A, 100e6); // 1/3 of alive pool

        vm.prank(bob);
        vault.depositConviction(TEAM_B, 300e6); // eliminated team

        vm.prank(oracle);
        vault.settleElimination(TEAM_B);

        // forfeited = 300e6 / 2 = 150e6
        // survivorYield = 150e6 * 20 / 100 = 30e6
        // Alice earns 2/3 of 30e6 = 20e6; Carol earns 1/3 = 10e6
        uint256 alicePending = vault.pendingYield(alice);
        uint256 carolPending = vault.pendingYield(carol);

        assertApproxEqAbs(alicePending, 20e6, 1, "Alice yield mismatch");
        assertApproxEqAbs(carolPending, 10e6, 1, "Carol yield mismatch");
    }

    // ── Test 6: claimYield transfers USDC ─────────────────────────────────────

    function test_ClaimYieldTransfersUSDC() public {
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 200e6);
        vm.prank(bob);
        vault.depositConviction(TEAM_B, 300e6);

        vm.prank(oracle);
        vault.settleElimination(TEAM_B);

        uint256 pending = vault.pendingYield(alice);
        assertGt(pending, 0);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.claimYield();
        uint256 balAfter = usdc.balanceOf(alice);

        assertApproxEqAbs(balAfter - balBefore, pending, 1);
    }

    // ── Test 7: claimEliminatedPosition returns 50% refund ───────────────────

    function test_ClaimEliminatedPosition_50PercentRefund() public {
        vm.prank(bob);
        vault.depositConviction(TEAM_B, 200e6);

        vm.prank(oracle);
        vault.settleElimination(TEAM_B);

        uint256 balBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        vault.claimEliminatedPosition(TEAM_B);
        uint256 balAfter = usdc.balanceOf(bob);

        assertEq(balAfter - balBefore, 100e6, "Should get 50% back");
        assertTrue(vault.principalClaimed(bob, TEAM_B));
    }

    // ── Test 8: Double-claim of eliminated position reverts ───────────────────

    function test_DoubleClaimEliminated_Reverts() public {
        vm.prank(bob);
        vault.depositConviction(TEAM_B, 200e6);

        vm.prank(oracle);
        vault.settleElimination(TEAM_B);

        vm.prank(bob);
        vault.claimEliminatedPosition(TEAM_B);

        vm.prank(bob);
        vm.expectRevert();
        vault.claimEliminatedPosition(TEAM_B);
    }

    // ── Test 9: No-loop verify — settleElimination runs in O(1) gas ──────────

    function test_SettleElimination_O1_NoBacker_Loops() public {
        // Deposit from 10 different users to Team B
        for (uint160 i = 1; i <= 10; i++) {
            address user = address(i + 0x1000);
            usdc.mint(user, 100e6);
            vm.prank(user);
            usdc.approve(address(vault), type(uint256).max);
            vm.prank(user);
            vault.depositConviction(TEAM_B, 100e6);
        }
        vm.prank(alice);
        vault.depositConviction(TEAM_A, 100e6);

        uint256 gasBefore = gasleft();
        vm.prank(oracle);
        vault.settleElimination(TEAM_B);
        uint256 gasUsed = gasBefore - gasleft();

        // settleElimination must use < 100k gas regardless of backer count
        assertLt(gasUsed, 100_000, "settleElimination should not loop over backers");
    }
}
