// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ChampionPool} from "../src/ChampionPool.sol";
import {StadiumNFT} from "../src/StadiumNFT.sol";
import {MatchOracle} from "../src/MatchOracle.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";
import {VARMarket} from "../src/VARMarket.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

contract ConvictionHookTest is Test {
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

    function setUp() public {
        vm.startPrank(deployer);

        poolManager = new PoolManager(deployer);
        usdc        = new MockUSDC();
        champPool   = new ChampionPool(address(usdc), deployer);
        nft         = new StadiumNFT(deployer);
        oracle      = new MatchOracle(deployer, treasury);
        hook        = new ConvictionHook(
                            IPoolManager(address(poolManager)),
                            address(usdc),
                            treasury,
                            deployer
                        );
        varMarket   = new VARMarket(
                            address(usdc),
                            address(oracle),
                            address(hook),
                            treasury,
                            address(champPool)
                        );

        hook.setOracle(address(oracle));
        hook.setChampionPool(address(champPool));
        hook.setVarMarket(address(varMarket));
        hook.setStadiumNFT(address(nft));

        oracle.setAddresses(address(hook), address(varMarket), address(champPool));
        champPool.setAddresses(address(hook), address(varMarket), address(oracle));
        nft.setConvictionHook(address(hook));

        PoolKey memory key = PoolKey({
            currency0:   Currency.wrap(address(usdc)),
            currency1:   Currency.wrap(address(usdc)),
            fee:         3000,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });
        hook.registerTeam("Argentina", key);
        hook.registerTeam("France", key);
        hook.registerTeam("Brazil", key);

        usdc.mint(alice,   10_000 * 1e6);
        usdc.mint(bob,     10_000 * 1e6);
        usdc.mint(charlie, 10_000 * 1e6);

        vm.stopPrank();
    }

    // ────────────────────────────── Deposit ──────────────────────────────

    function test_depositConviction() public {
        vm.startPrank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        hook.depositConviction("Argentina", 1000 * 1e6);
        vm.stopPrank();

        assertEq(hook.convictionDeposit(alice, "Argentina"), 1000 * 1e6);
        assertEq(hook.totalConvictionLocked("Argentina"), 1000 * 1e6);
        assertEq(hook.totalAliveConvictionLocked(), 1000 * 1e6);
        assertTrue(hook.hasConviction(alice, "Argentina"));
    }

    function test_conviction_multiplier() public {
        vm.startPrank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        hook.depositConviction("Argentina", 1000 * 1e6);
        vm.stopPrank();

        assertEq(hook.getConvictionMultiplier(alice, "Argentina"), 150);
        assertEq(hook.getConvictionMultiplier(bob, "Argentina"), 100);
    }

    function test_multiplier_cleared_after_elimination() public {
        vm.startPrank(alice);
        usdc.approve(address(hook), 500 * 1e6);
        hook.depositConviction("Argentina", 500 * 1e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(hook), 500 * 1e6);
        hook.depositConviction("France", 500 * 1e6);
        vm.stopPrank();

        vm.prank(deployer);
        oracle.postElimination("Argentina");

        // multiplier returns 100 after elimination (team is out)
        assertEq(hook.getConvictionMultiplier(alice, "Argentina"), 100);
    }

    // ────────────────────────────── Survivor Yield ──────────────────────────────

    function test_survivorYield_on_elimination() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 1000 * 1e6);

        vm.prank(bob);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(bob);
        hook.depositConviction("France", 1000 * 1e6);

        vm.prank(charlie);
        usdc.approve(address(hook), 2000 * 1e6);
        vm.prank(charlie);
        hook.depositConviction("Brazil", 2000 * 1e6);

        // Eliminate France (1000 USDC total locked)
        // halfLost = 500; survivorYield = 50 (10% of 500)
        // totalAlive after elimination = 1000 (Alice) + 2000 (Charlie) = 3000
        // Alice yield = (1000/3000) * 50 ≈ 16 USDC
        // Charlie yield = (2000/3000) * 50 ≈ 33 USDC
        vm.prank(deployer);
        oracle.postElimination("France");

        assertGt(hook.accruedYield(alice), 0, "Alice should have accrued yield");
        assertGt(hook.accruedYield(charlie), 0, "Charlie should have accrued yield");
        assertGt(hook.accruedYield(charlie), hook.accruedYield(alice), "Charlie has more stake so more yield");

        // Bob (eliminated backer) gets 50% back = 500 USDC
        // Bob started at 10000 - 1000 = 9000; after elimination 9000 + 500 = 9500
        assertEq(usdc.balanceOf(bob), 9500 * 1e6);
    }

    function test_claimYield() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 1000 * 1e6);

        vm.prank(bob);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(bob);
        hook.depositConviction("France", 1000 * 1e6);

        vm.prank(deployer);
        oracle.postElimination("France");

        uint256 aliceYield = hook.accruedYield(alice);
        assertGt(aliceYield, 0);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        hook.claimYield();

        assertEq(usdc.balanceOf(alice), balBefore + aliceYield);
        assertEq(hook.accruedYield(alice), 0);
    }

    function test_claimYield_reverts_when_no_yield() public {
        vm.prank(alice);
        vm.expectRevert("ConvictionHook: no yield");
        hook.claimYield();
    }

    // ────────────────────────────── Champion Settlement ──────────────────────────────

    function test_settleChampion() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 1000 * 1e6);

        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(deployer);
        oracle.postChampion("Argentina");

        // Alice gets 100% principal back + any yield
        assertGe(usdc.balanceOf(alice), balBefore + 1000 * 1e6);
        assertEq(hook.convictionDeposit(alice, "Argentina"), 0);
    }

    function test_settleChampion_idempotent() public {
        vm.prank(alice);
        usdc.approve(address(hook), 500 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 500 * 1e6);

        vm.prank(deployer);
        oracle.postChampion("Argentina");

        // Second call should revert (hook guards this)
        vm.prank(deployer);
        vm.expectRevert("ConvictionHook: already settled");
        hook.settleChampion("Argentina");
    }

    // ────────────────────────────── Guards ──────────────────────────────

    function test_cannotDeposit_for_eliminated_team() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("France", 1000 * 1e6);

        vm.prank(deployer);
        oracle.postElimination("France");

        vm.prank(bob);
        usdc.approve(address(hook), 500 * 1e6);
        vm.prank(bob);
        vm.expectRevert("ConvictionHook: team eliminated");
        hook.depositConviction("France", 500 * 1e6);
    }

    function test_cannotDeposit_for_unregistered_team() public {
        vm.prank(alice);
        usdc.approve(address(hook), 500 * 1e6);
        vm.prank(alice);
        vm.expectRevert("ConvictionHook: team not registered");
        hook.depositConviction("Uruguay", 500 * 1e6);
    }

    function test_settleElimination_double_reverts() public {
        vm.prank(alice);
        usdc.approve(address(hook), 200 * 1e6);
        vm.prank(alice);
        hook.depositConviction("France", 200 * 1e6);

        vm.prank(deployer);
        oracle.postElimination("France");

        vm.prank(deployer);
        vm.expectRevert("ConvictionHook: already eliminated");
        hook.settleElimination("France");
    }

    // ────────────────────────────── Faucet ──────────────────────────────

    function test_faucet() public {
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), bal + 1000 * 1e6);
    }

    function test_faucet_cooldown_enforced() public {
        vm.prank(alice);
        usdc.faucet();
        vm.prank(alice);
        vm.expectRevert("Faucet: cooldown active");
        usdc.faucet();
    }

    function test_faucet_resets_after_one_day() public {
        vm.prank(alice);
        usdc.faucet();
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(alice);
        usdc.faucet(); // should not revert
    }

    // ────────────────────────────── Zero-amount guard ──────────────────────────────

    function test_deposit_zero_reverts() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        vm.expectRevert("ConvictionHook: zero amount");
        hook.depositConviction("Argentina", 0);
    }
}
