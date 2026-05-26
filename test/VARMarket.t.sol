// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ChampionPool} from "../src/ChampionPool.sol";
import {MatchOracle} from "../src/MatchOracle.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";
import {VARMarket} from "../src/VARMarket.sol";
import {StadiumNFT} from "../src/StadiumNFT.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

contract VARMarketTest is Test {
    MockUSDC usdc;
    ChampionPool champPool;
    StadiumNFT nft;
    MatchOracle oracle;
    ConvictionHook hook;
    VARMarket varMarket;
    PoolManager poolManager;

    address deployer = address(0x1);
    address treasury = address(0x2);
    address alice    = address(0x3);
    address bob      = address(0x4);
    address charlie  = address(0x5);

    uint256 constant MATCH_ID = 1;

    function setUp() public {
        vm.startPrank(deployer);

        poolManager = new PoolManager(deployer);
        usdc        = new MockUSDC();
        champPool   = new ChampionPool(address(usdc), deployer);
        nft         = new StadiumNFT(deployer);
        oracle      = new MatchOracle(deployer, treasury);
        hook        = new ConvictionHook(
                            IPoolManager(address(poolManager)),
                            address(usdc), treasury, deployer
                        );
        varMarket   = new VARMarket(
                            address(usdc), address(oracle),
                            address(hook), treasury, address(champPool)
                        );

        hook.setOracle(address(oracle));
        hook.setChampionPool(address(champPool));
        hook.setVarMarket(address(varMarket));
        hook.setStadiumNFT(address(nft));
        oracle.setAddresses(address(hook), address(varMarket), address(champPool));
        champPool.setAddresses(address(hook), address(varMarket), address(oracle));
        nft.setConvictionHook(address(hook));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(usdc)),
            currency1: Currency.wrap(address(usdc)),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        hook.registerTeam("Argentina", key);
        hook.registerTeam("France", key);

        // Create match in the future so kickoff check passes
        oracle.createMatch(MATCH_ID, "Argentina", "France", block.timestamp + 2 hours);
        oracle.openVARWindow(MATCH_ID);

        usdc.mint(alice,   10_000 * 1e6);
        usdc.mint(bob,     10_000 * 1e6);
        usdc.mint(charlie, 10_000 * 1e6);

        vm.stopPrank();
    }

    // ────────────────────────────── placeBet ──────────────────────────────

    function test_placeBet_teamA() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        (uint256 yes, uint256 no, uint256 draw) = varMarket.getUserBet(MATCH_ID, 0, alice);
        assertEq(yes, 100 * 1e6);
        assertEq(no, 0);
        assertEq(draw, 0);
    }

    function test_placeBet_draw_goes_to_draw_pool() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 50 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "draw", 50 * 1e6);

        (uint256 yes, uint256 no, uint256 draw) = varMarket.getUserBet(MATCH_ID, 0, alice);
        assertEq(yes, 0);
        assertEq(no, 0);
        assertEq(draw, 50 * 1e6, "Draw bet should go to draw pool");

        VARMarket.MarketInfo memory m = varMarket.getMarket(MATCH_ID, 0);
        assertEq(m.totalDrawPool, 50 * 1e6);
    }

    function test_placeBet_none_goes_to_draw_pool() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 30 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 1, "none", 30 * 1e6); // FIRST_GOAL

        (, , uint256 draw) = varMarket.getUserBet(MATCH_ID, 1, alice);
        assertEq(draw, 30 * 1e6);
    }

    function test_placeBet_YES_NO() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 60 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 2, "YES", 60 * 1e6); // RED_CARD

        (uint256 yes,,) = varMarket.getUserBet(MATCH_ID, 2, alice);
        assertEq(yes, 60 * 1e6);
    }

    function test_placeBet_invalid_outcome_reverts() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 50 * 1e6);
        vm.prank(alice);
        vm.expectRevert("VARMarket: invalid outcome");
        varMarket.placeBet(MATCH_ID, 2, "MAYBE", 50 * 1e6);
    }

    function test_placeBet_draw_invalid_for_binary_market() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 50 * 1e6);
        vm.prank(alice);
        vm.expectRevert("VARMarket: invalid outcome");
        varMarket.placeBet(MATCH_ID, 2, "draw", 50 * 1e6); // RED_CARD only takes YES/NO
    }

    // ────────────────────────────── Settlement ──────────────────────────────

    function test_winner_gets_payout_loser_gets_refund() public {
        // Alice: 100 USDC on teamA; Bob: 200 USDC on teamB
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        vm.prank(bob);
        usdc.approve(address(varMarket), 200 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 200 * 1e6);

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);

        // Alice won: 100 bet + 45% of 200 losingPool = 100 + 90 = 190
        assertEq(usdc.balanceOf(alice), aliceBefore + 100 * 1e6 + 90 * 1e6, "Alice payout wrong");

        // Bob lost: 10% refund of 200 = 20
        assertEq(usdc.balanceOf(bob), bobBefore + 20 * 1e6, "Bob refund wrong");
    }

    function test_draw_winner_paid_correctly() public {
        // Alice: 100 on teamA, Bob: 100 on teamB, Charlie: 50 on draw
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        vm.prank(bob);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 100 * 1e6);

        vm.prank(charlie);
        usdc.approve(address(varMarket), 50 * 1e6);
        vm.prank(charlie);
        varMarket.placeBet(MATCH_ID, 0, "draw", 50 * 1e6);

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 charlieBefore = usdc.balanceOf(charlie);
        uint256 aliceBefore   = usdc.balanceOf(alice);
        uint256 bobBefore     = usdc.balanceOf(bob);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "draw", "none", false, false);

        // Charlie wins: losingPool = 100 + 100 = 200; toWinnersPool = 45% of 200 = 90
        // Charlie gets 50 (bet) + 90 (share of winners pool) = 140
        assertEq(usdc.balanceOf(charlie), charlieBefore + 50 * 1e6 + 90 * 1e6, "Charlie draw win wrong");

        // Alice and Bob get 10% refunds: 10 each
        assertEq(usdc.balanceOf(alice), aliceBefore + 10 * 1e6, "Alice refund wrong");
        assertEq(usdc.balanceOf(bob),   bobBefore   + 10 * 1e6, "Bob refund wrong");
    }

    function test_conviction_multiplier_gives_larger_share() public {
        // Alice has conviction on Argentina, bets on Argentina in VAR
        vm.prank(alice);
        usdc.approve(address(hook), 500 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 500 * 1e6);

        // Alice and Bob each bet 100 on teamA; both qualify for winners pool
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        vm.prank(bob);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        // Charlie bets on teamB (loser)
        vm.prank(charlie);
        usdc.approve(address(varMarket), 300 * 1e6);
        vm.prank(charlie);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 300 * 1e6);

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);

        uint256 aliceGain = usdc.balanceOf(alice) - aliceBefore;
        uint256 bobGain   = usdc.balanceOf(bob)   - bobBefore;

        // Alice has 1.5× weight (150), Bob has 1× weight (100)
        // Total weighted = 100*150/100 + 100*100/100 = 150 + 100 = 250
        // losers pool = 300; toWinnersPool = 45% of 300 = 135
        // Alice share = 150/250 * 135 = 81; payout = 100 + 81 = 181
        // Bob   share = 100/250 * 135 = 54; payout = 100 + 54 = 154

        assertGt(aliceGain, bobGain, "Conviction holder should get larger share");
        // Alice gets 181, Bob gets 154
        assertEq(aliceGain, 100 * 1e6 + 81 * 1e6, "Alice payout with 1.5x wrong");
        assertEq(bobGain,   100 * 1e6 + 54 * 1e6, "Bob payout without multiplier wrong");
    }

    function test_settle_while_open_reverts() public {
        // Market is still open — settlement must revert
        vm.prank(deployer);
        vm.expectRevert("VARMarket: market still open");
        varMarket.settleMarket(MATCH_ID, 0, "teamA");
    }

    function test_settle_after_open_without_closing_via_oracle() public {
        // postResult requires varClosed — startMatch must come first
        vm.prank(deployer);
        vm.expectRevert("Oracle: match not started yet");
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);
    }

    function test_double_open_reverts() public {
        vm.prank(deployer);
        vm.expectRevert("VARMarket: already open");
        varMarket.openMarketsWithTeams(MATCH_ID, "Argentina", "France");
    }

    function test_market_closed_rejects_bets() public {
        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        vm.expectRevert("VARMarket: market not open");
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);
    }

    function test_all_four_markets_settle() public {
        vm.startPrank(alice);
        usdc.approve(address(varMarket), 400 * 1e6);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);
        varMarket.placeBet(MATCH_ID, 1, "teamA", 100 * 1e6);
        varMarket.placeBet(MATCH_ID, 2, "YES",   100 * 1e6);
        varMarket.placeBet(MATCH_ID, 3, "NO",    100 * 1e6);
        vm.stopPrank();

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", true, false);

        for (uint8 i = 0; i < 4; i++) {
            VARMarket.MarketInfo memory m = varMarket.getMarket(MATCH_ID, i);
            assertTrue(m.settled, "Market should be settled");
        }
    }

    function test_champion_pool_receives_funds() public {
        // Bob loses 200 USDC; 25% of 200 = 50 to champion pool
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        vm.prank(bob);
        usdc.approve(address(varMarket), 200 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 200 * 1e6);

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 champBefore = champPool.getBalance();

        vm.warp(block.timestamp + 3 hours);
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);

        assertGt(champPool.getBalance(), champBefore, "ChampionPool should have received funds");
        assertEq(champPool.getBalance() - champBefore, 50 * 1e6, "ChampionPool should receive 25% of losingPool");
    }

    function test_treasury_receives_funds() public {
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        vm.prank(bob);
        usdc.approve(address(varMarket), 200 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 200 * 1e6);

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);

        // losingPool = 200; treasury = 200 - 45%(90) - 25%(50) - 10%(20) = 40
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 40 * 1e6, "Treasury wrong amount");
    }
}
