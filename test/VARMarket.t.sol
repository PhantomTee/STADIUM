// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {VARMarket}      from "../src/VARMarket.sol";
import {MockUSDC}       from "../src/MockUSDC.sol";

/// @notice 6 tests covering VAR market mechanics with uint8 outcomes and pull-based claims
contract VARMarketTest is Test {
    MockUSDC   usdc;
    VARMarket  varMarket;

    address deployer     = address(this);
    address treasury     = makeAddr("treasury");
    address oracle       = makeAddr("oracle");
    address vault        = makeAddr("vault");
    address championPool = makeAddr("champPool");

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    uint256 constant MATCH_ID    = 1001;
    uint8   constant MARKET_WIN  = 0;   // MatchWinner
    uint8   constant OUTCOME_A   = 1;   // TEAM_A wins
    uint8   constant OUTCOME_B   = 2;   // TEAM_B wins
    uint8   constant OUTCOME_DRAW = 3;

    function setUp() public {
        usdc     = new MockUSDC();
        varMarket = new VARMarket(
            address(usdc),
            oracle,
            vault,
            treasury,
            championPool
        );

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob,   1_000e6);

        vm.prank(alice); usdc.approve(address(varMarket), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(varMarket), type(uint256).max);

        // Open markets for match 1001
        vm.prank(oracle);
        varMarket.openMarketsWithTeams(MATCH_ID, 1, 2);
    }

    // ── Test 1: placeBet records correct pools ────────────────────────────────

    function test_PlaceBet_RecordsPool() public {
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);

        assertEq(varMarket.outcomePool(MATCH_ID, MARKET_WIN, OUTCOME_A), 100e6);
        assertEq(varMarket.betAmount(MATCH_ID, MARKET_WIN, alice, OUTCOME_A), 100e6);
    }

    // ── Test 2: placeBet reverts when market is closed ───────────────────────

    function test_PlaceBet_RevertsWhenClosed() public {
        vm.prank(oracle);
        varMarket.closeMarkets(MATCH_ID);

        vm.prank(alice);
        vm.expectRevert();
        varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
    }

    // ── Test 3: settleMarket — correct split ─────────────────────────────────

    function test_SettleMarket_CorrectSplit() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);  // winner
        vm.prank(bob);   varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);  // loser

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);

        uint256 champBefore    = usdc.balanceOf(championPool);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(oracle);
        varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        // losingPool = 200e6
        // loserRefund = 20e6 (10%)
        // remaining = 180e6
        // toWinners = 90e6 (50%)
        // toChamp = 45e6 (25%)
        // toTreasury = 45e6 (remaining - toWinners - toChamp)
        assertEq(usdc.balanceOf(championPool) - champBefore, 45e6, "ChampPool share mismatch");
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 45e6,  "Treasury share mismatch");

        // toWinnersPool stored in market state
        (,, , bool settled,, uint256 toWinnersPool,) = varMarket.markets(MATCH_ID, MARKET_WIN);
        assertTrue(settled);
        assertEq(toWinnersPool, 90e6);
    }

    // ── Test 4: Winner claims bet + proportional share ────────────────────────

    function test_Winner_ClaimVAR() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(bob);   varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        varMarket.claimVAR(MATCH_ID, MARKET_WIN);
        uint256 balAfter = usdc.balanceOf(alice);

        // Alice is the only winner: gets bet (100e6) + entire toWinnersPool (90e6)
        assertApproxEqAbs(balAfter - balBefore, 190e6, 1, "Alice payout mismatch");
    }

    // ── Test 5: Loser gets 10% refund on claimVAR ────────────────────────────

    function test_Loser_Gets10PctRefund() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(bob);   varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        uint256 balBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        varMarket.claimVAR(MATCH_ID, MARKET_WIN);
        uint256 balAfter = usdc.balanceOf(bob);

        // Bob loses 200e6. Refund = 200e6 * 10% = 20e6
        assertApproxEqAbs(balAfter - balBefore, 20e6, 1, "Bob refund mismatch");
    }

    // ── Test 6: Double claim reverts ─────────────────────────────────────────

    function test_DoubleClaim_Reverts() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        vm.prank(alice); varMarket.claimVAR(MATCH_ID, MARKET_WIN);

        vm.prank(alice);
        vm.expectRevert();
        varMarket.claimVAR(MATCH_ID, MARKET_WIN);
    }
}
