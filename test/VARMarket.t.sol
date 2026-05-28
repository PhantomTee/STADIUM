// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {VARMarket}      from "../src/VARMarket.sol";
import {MockUSDC}       from "../src/MockUSDC.sol";

/// @notice Tests covering VAR market mechanics with uint8 outcomes and pull-based claims
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

    // ── Test 4: Winner claims bet + proportional share via claimPayout ───────

    function test_Winner_ClaimPayout() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(bob);   varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        varMarket.claimPayout(MATCH_ID, MARKET_WIN);
        uint256 balAfter = usdc.balanceOf(alice);

        // Alice is the only winner: gets bet (100e6) + entire toWinnersPool (90e6)
        assertApproxEqAbs(balAfter - balBefore, 190e6, 1, "Alice payout mismatch");
    }

    // ── Test 4b: claimVAR backwards-compat alias still works ─────────────────

    function test_Winner_ClaimVAR_Alias() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(bob);   varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        varMarket.claimVAR(MATCH_ID, MARKET_WIN);
        uint256 balAfter = usdc.balanceOf(alice);

        assertApproxEqAbs(balAfter - balBefore, 190e6, 1, "Alice payout via claimVAR mismatch");
    }

    // ── Test 5: Loser gets 10% refund on claimPayout ─────────────────────────

    function test_Loser_Gets10PctRefund() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(bob);   varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        uint256 balBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        varMarket.claimPayout(MATCH_ID, MARKET_WIN);
        uint256 balAfter = usdc.balanceOf(bob);

        // Bob loses 200e6. Refund = 200e6 * 10% = 20e6
        assertApproxEqAbs(balAfter - balBefore, 20e6, 1, "Bob refund mismatch");
    }

    // ── Test 6: Double claim via claimPayout reverts ──────────────────────────

    function test_DoubleClaim_Reverts() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        vm.prank(alice); varMarket.claimPayout(MATCH_ID, MARKET_WIN);

        vm.prank(alice);
        vm.expectRevert();
        varMarket.claimPayout(MATCH_ID, MARKET_WIN);
    }

    // ── Test 7: Cannot claim both claimVAR and claimPayout ───────────────────

    function test_CannotClaimBothAliases() public {
        vm.prank(alice); varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);
        vm.prank(oracle); varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        vm.prank(alice); varMarket.claimVAR(MATCH_ID, MARKET_WIN);

        vm.prank(alice);
        vm.expectRevert();
        varMarket.claimPayout(MATCH_ID, MARKET_WIN);
    }

    // ── Test 8: Multiplier affects winner's proportional share ────────────────
    //    Verify the multiplier boosts share of toWinnersPool (net winnings), not the principal.

    function test_Multiplier_AffectsNetWinnings() public {
        // Deploy a vault mock that returns 150 for alice, 100 for bob
        MockConvictionVault cvault = new MockConvictionVault();
        cvault.setMultiplier(alice, 1, 2, 150); // alice has conviction
        // bob gets 100 by default

        VARMarket market2 = new VARMarket(
            address(usdc),
            oracle,
            address(cvault),
            treasury,
            championPool
        );

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob,   1_000e6);
        vm.prank(alice); usdc.approve(address(market2), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(market2), type(uint256).max);

        uint256 matchId2 = 2002;
        vm.prank(oracle); market2.openMarketsWithTeams(matchId2, 1, 2);

        vm.prank(alice); market2.placeBet(matchId2, MARKET_WIN, OUTCOME_A, 100e6);
        vm.prank(bob);   market2.placeBet(matchId2, MARKET_WIN, OUTCOME_A, 100e6);

        // Add a loser so there's a pool to distribute
        address loser = makeAddr("loser");
        usdc.mint(loser, 200e6);
        vm.prank(loser); usdc.approve(address(market2), type(uint256).max);
        vm.prank(loser); market2.placeBet(matchId2, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); market2.closeMarkets(matchId2);
        vm.prank(oracle); market2.settleMarket(matchId2, MARKET_WIN, OUTCOME_A);

        // toWinnersPool: losingPool=200e6, loserRefund=20e6, remaining=180e6, toWinners=90e6
        // Alice weighted = 100e6 * 150/100 = 150e6
        // Bob   weighted = 100e6 * 100/100 = 100e6
        // Total weighted = 250e6
        // Alice earnedShare = 150/250 * 90e6 = 54e6
        // Bob   earnedShare = 100/250 * 90e6 = 36e6

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice); market2.claimPayout(matchId2, MARKET_WIN);
        uint256 aliceGain = usdc.balanceOf(alice) - aliceBefore;
        // Alice: principal 100e6 + earnedShare 54e6 = 154e6
        assertApproxEqAbs(aliceGain, 154e6, 1, "Alice multiplier gain mismatch");

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob); market2.claimPayout(matchId2, MARKET_WIN);
        uint256 bobGain = usdc.balanceOf(bob) - bobBefore;
        // Bob: principal 100e6 + earnedShare 36e6 = 136e6
        assertApproxEqAbs(bobGain, 136e6, 1, "Bob non-multiplier gain mismatch");
    }
}

    // ── Test 9: No-winner settlement routes toWinnersPool to championPool ────

    function test_NoWinner_FundsRoutedToChampPool() public {
        // Only bob bets; outcome B loses — nobody bets on outcome A (the winner)
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, MARKET_WIN, OUTCOME_B, 200e6);

        vm.prank(oracle); varMarket.closeMarkets(MATCH_ID);

        uint256 champBefore = usdc.balanceOf(championPool);
        vm.prank(oracle);
        varMarket.settleMarket(MATCH_ID, MARKET_WIN, OUTCOME_A);

        // losingPool = 200e6 (all on OUTCOME_B, which lost)
        // loserRefund = 20e6, remaining = 180e6
        // toWinnersPool = 90e6, toChamp = 45e6, toTreasury = 45e6
        // Nobody bet on OUTCOME_A → toWinnersPool redirected to championPool
        uint256 champGain = usdc.balanceOf(championPool) - champBefore;
        // champGain = normal toChampPool (45e6) + redirected toWinnersPool (90e6) = 135e6
        assertEq(champGain, 135e6, "No-winner toWinnersPool must flow to championPool");

        // The stored toWinnersPool must be 0 (no claimable winners pool)
        VARMarket.MarketState memory m = varMarket.getMarket(MATCH_ID, MARKET_WIN);
        assertEq(m.toWinnersPool, 0, "toWinnersPool must be 0 after no-winner redirect");

        // Bob (loser) still gets 10% refund
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob); varMarket.claimPayout(MATCH_ID, MARKET_WIN);
        assertApproxEqAbs(usdc.balanceOf(bob) - bobBefore, 20e6, 1, "Bob still gets 10% refund");
    }
}

/// @notice Minimal mock for IConvictionVault (two-team signature).
contract MockConvictionVault {
    // mapping: user => teamA => teamB => multiplier
    mapping(address => mapping(uint16 => mapping(uint16 => uint256))) public mult;

    function setMultiplier(address user, uint16 a, uint16 b, uint256 m) external {
        mult[user][a][b] = m;
        mult[user][b][a] = m; // symmetric
    }

    function getConvictionMultiplier(address user, uint16 teamA, uint16 teamB) external view returns (uint256) {
        uint256 m = mult[user][teamA][teamB];
        return m == 0 ? 100 : m;
    }
}
