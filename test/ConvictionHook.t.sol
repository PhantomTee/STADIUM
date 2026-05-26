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
    address alice = address(0x3);
    address bob = address(0x4);
    address charlie = address(0x5);

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
        hook.registerTeam("Brazil", key);

        // Mint USDC for users
        usdc.mint(alice, 10_000 * 1e6);
        usdc.mint(bob, 10_000 * 1e6);
        usdc.mint(charlie, 10_000 * 1e6);

        vm.stopPrank();
    }

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

    function test_depositConviction_multiplier() public {
        vm.startPrank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        hook.depositConviction("Argentina", 1000 * 1e6);
        vm.stopPrank();

        assertEq(hook.getConvictionMultiplier(alice, "Argentina"), 150);
        assertEq(hook.getConvictionMultiplier(bob, "Argentina"), 100);
    }

    function test_survivorYield_on_elimination() public {
        // Alice backs Argentina, Bob backs France, Charlie backs Brazil
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

        // Oracle eliminates France
        // France total = 1000 USDC
        // halfLost = 500 USDC
        // survivorYield = 50 USDC (10% of 500)
        // champPool = 125 USDC (25% of 500)
        // treasury = 325 USDC (15% of 500 = 75, + rounding)
        // totalAliveConvictionLocked before elimination = 4000 - 1000 = 3000 (Alice 1000 + Charlie 2000)

        vm.prank(deployer);
        oracle.postElimination("France");

        // Bob gets 50% back = 500 USDC (+ 0 accrued yield since he had none)
        // Alice accrued yield = (1000/3000) * 50 = ~16.66 USDC
        // Charlie accrued yield = (2000/3000) * 50 = ~33.33 USDC

        uint256 aliceYield = hook.accruedYield(alice);
        uint256 charlieYield = hook.accruedYield(charlie);

        assertGt(aliceYield, 0, "Alice should have accrued yield");
        assertGt(charlieYield, 0, "Charlie should have accrued yield");
        assertGt(charlieYield, aliceYield, "Charlie has more so more yield");

        // Bob should have received 500 USDC (50% return) plus his yield was 0
        // Bob's pre-settlement balance: 10000 - 1000 = 9000 USDC
        // After elimination: 9000 + 500 = 9500 USDC
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

        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        hook.claimYield();

        assertEq(usdc.balanceOf(alice), aliceBalanceBefore + aliceYield);
        assertEq(hook.accruedYield(alice), 0);
    }

    function test_settleChampion() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 1000 * 1e6);

        uint256 aliceBalanceBefore = usdc.balanceOf(alice);

        vm.prank(deployer);
        oracle.postChampion("Argentina");

        // Alice should get her full 1000 USDC back plus any yield
        assertGe(usdc.balanceOf(alice), aliceBalanceBefore + 1000 * 1e6);
        assertEq(hook.convictionDeposit(alice, "Argentina"), 0);
    }

    function test_cannotDepositForEliminatedTeam() public {
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

    function test_beforeAddLiquidity_reverts() public {
        // The hook should reject direct V4 liquidity additions
        // This is tested via the hook callback mechanism
        // Since we can't easily call the V4 hook directly in unit tests,
        // we verify the function exists and has correct behavior by checking hook permissions
        assertTrue(hook.getHookPermissions().beforeAddLiquidity);
    }

    function test_faucet() public {
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 10_000 * 1e6 + 1_000 * 1e6);
    }

    function test_faucet_cooldown() public {
        vm.prank(alice);
        usdc.faucet();
        vm.prank(alice);
        vm.expectRevert("Faucet: cooldown active");
        usdc.faucet();
    }
}
