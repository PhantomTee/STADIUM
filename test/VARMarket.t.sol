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
    address alice = address(0x3);
    address bob = address(0x4);

    uint256 constant MATCH_ID = 1;

    function setUp() public {
        vm.startPrank(deployer);

        poolManager = new PoolManager(deployer);
        usdc = new MockUSDC();
        champPool = new ChampionPool(address(usdc));
        nft = new StadiumNFT(deployer);
        oracle = new MatchOracle(deployer, treasury);
        hook = new ConvictionHook(IPoolManager(address(poolManager)), address(usdc), treasury, deployer);
        varMarket = new VARMarket(address(usdc), address(oracle), address(hook), treasury, address(champPool));

        hook.setOracle(address(oracle));
        hook.setChampionPool(address(champPool));
        hook.setVarMarket(address(varMarket));
        hook.setStadiumNFT(address(nft));

        oracle.setAddresses(address(hook), address(varMarket), address(champPool));
        champPool.setAddresses(address(hook), address(varMarket), address(oracle));
        nft.setConvictionHook(address(hook));

        // Register teams
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(usdc)),
            currency1: Currency.wrap(address(usdc)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        hook.registerTeam("Argentina", key);
        hook.registerTeam("France", key);

        // Create and open match
        oracle.createMatch(MATCH_ID, "Argentina", "France", block.timestamp + 1 hours);
        oracle.openVARWindow(MATCH_ID);

        // Mint USDC
        usdc.mint(alice, 10_000 * 1e6);
        usdc.mint(bob, 10_000 * 1e6);

        vm.stopPrank();
    }

    function test_placeBet_matchWinner() public {
        vm.startPrank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);
        vm.stopPrank();

        (uint256 yes, uint256 no) = varMarket.getUserBet(MATCH_ID, 0, alice);
        assertEq(yes, 100 * 1e6);
        assertEq(no, 0);
    }

    function test_placeBet_redCard_yes() public {
        vm.startPrank(alice);
        usdc.approve(address(varMarket), 50 * 1e6);
        varMarket.placeBet(MATCH_ID, 2, "YES", 50 * 1e6);
        vm.stopPrank();

        (uint256 yes, uint256 no) = varMarket.getUserBet(MATCH_ID, 2, alice);
        assertEq(yes, 50 * 1e6);
        assertEq(no, 0);
    }

    function test_placeBet_invalid_outcome_reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(varMarket), 50 * 1e6);
        vm.expectRevert("VARMarket: invalid outcome");
        varMarket.placeBet(MATCH_ID, 2, "MAYBE", 50 * 1e6);
        vm.stopPrank();
    }

    function test_settle_winner_gets_payout() public {
        // Alice bets on teamA (Argentina wins), Bob bets on teamB (France wins)
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        vm.prank(bob);
        usdc.approve(address(varMarket), 200 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 200 * 1e6);

        // Close market
        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        uint256 bobBalanceBefore = usdc.balanceOf(bob);

        // Post result: Argentina wins (teamA)
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);

        uint256 aliceBalance = usdc.balanceOf(alice);
        uint256 bobBalance = usdc.balanceOf(bob);

        // Alice won: she should have more than before
        assertGt(aliceBalance, aliceBalanceBefore);

        // Bob lost: he should get 10% refund = 20 USDC
        // Bob had 10000 - 200 = 9800. After refund: 9800 + 20 = 9820
        assertEq(bobBalance, bobBalanceBefore + 20 * 1e6);
    }

    function test_conviction_multiplier_applied() public {
        // Alice has conviction on Argentina
        vm.prank(alice);
        usdc.approve(address(hook), 500 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 500 * 1e6);

        // Multiplier should be 1.5x
        assertEq(hook.getConvictionMultiplier(alice, "Argentina"), 150);

        // Alice bets on Argentina in VAR
        vm.prank(alice);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6);

        // Bob bets on France
        vm.prank(bob);
        usdc.approve(address(varMarket), 200 * 1e6);
        vm.prank(bob);
        varMarket.placeBet(MATCH_ID, 0, "teamB", 200 * 1e6);

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        uint256 aliceBalanceBefore = usdc.balanceOf(alice);

        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", false, false);

        uint256 aliceGain = usdc.balanceOf(alice) - aliceBalanceBefore;
        console.log("Alice gain with multiplier:", aliceGain);
        assertGt(aliceGain, 0, "Alice should have gained");
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
        // Place bets on all 4 markets
        vm.startPrank(alice);
        usdc.approve(address(varMarket), 400 * 1e6);
        varMarket.placeBet(MATCH_ID, 0, "teamA", 100 * 1e6); // match winner
        varMarket.placeBet(MATCH_ID, 1, "teamA", 100 * 1e6); // first goal
        varMarket.placeBet(MATCH_ID, 2, "YES", 100 * 1e6);   // red card
        varMarket.placeBet(MATCH_ID, 3, "NO", 100 * 1e6);    // extra time
        vm.stopPrank();

        vm.prank(deployer);
        oracle.startMatch(MATCH_ID);

        // Settle all 4 markets via postResult
        vm.prank(deployer);
        oracle.postResult(MATCH_ID, "teamA", "teamA", true, false);

        // Check all 4 markets are settled
        for (uint8 i = 0; i < 4; i++) {
            VARMarket.MarketInfo memory m = varMarket.getMarket(MATCH_ID, i);
            assertTrue(m.settled, "Market should be settled");
        }
    }
}
