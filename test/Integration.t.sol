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

/// @notice Full tournament simulation: group stage → knockout → final → champion distribution
contract IntegrationTest is Test {
    MockUSDC usdc;
    ChampionPool champPool;
    StadiumNFT nft;
    MatchOracle oracle;
    ConvictionHook hook;
    VARMarket varMarket;
    PoolManager poolManager;

    address deployer = address(0x1);
    address treasury = address(0x2);

    // 5 users backing 4 teams
    address alice = address(0x10);   // backs Argentina
    address bob = address(0x11);     // backs France
    address charlie = address(0x12); // backs Brazil
    address dave = address(0x13);    // backs France
    address eve = address(0x14);     // backs Argentina (champion)

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
        hook.registerTeam("Germany", key);

        // Fund users
        usdc.mint(alice, 100_000 * 1e6);
        usdc.mint(bob, 100_000 * 1e6);
        usdc.mint(charlie, 100_000 * 1e6);
        usdc.mint(dave, 100_000 * 1e6);
        usdc.mint(eve, 100_000 * 1e6);

        vm.stopPrank();
    }

    function test_full_tournament_simulation() public {
        // ─── Phase 1: Initial CONVICTION deposits ───
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("Argentina", 1000 * 1e6);

        vm.prank(bob);
        usdc.approve(address(hook), 2000 * 1e6);
        vm.prank(bob);
        hook.depositConviction("France", 2000 * 1e6);

        vm.prank(charlie);
        usdc.approve(address(hook), 1500 * 1e6);
        vm.prank(charlie);
        hook.depositConviction("Brazil", 1500 * 1e6);

        vm.prank(dave);
        usdc.approve(address(hook), 500 * 1e6);
        vm.prank(dave);
        hook.depositConviction("France", 500 * 1e6);

        vm.prank(eve);
        usdc.approve(address(hook), 3000 * 1e6);
        vm.prank(eve);
        hook.depositConviction("Argentina", 3000 * 1e6);

        uint256 totalLocked = hook.totalAliveConvictionLocked();
        assertEq(totalLocked, 8000 * 1e6, "Total should be 8000 USDC");

        // ─── Phase 2: Group stage match + VAR ───
        vm.prank(deployer);
        oracle.createMatch(1, "Brazil", "Germany", block.timestamp + 2 hours);
        vm.prank(deployer);
        oracle.openVARWindow(1);

        // Place VAR bets
        vm.prank(alice);
        usdc.approve(address(varMarket), 200 * 1e6);
        vm.prank(alice);
        varMarket.placeBet(1, 0, "teamA", 200 * 1e6); // Alice bets Brazil wins

        vm.prank(charlie);
        usdc.approve(address(varMarket), 100 * 1e6);
        vm.prank(charlie);
        varMarket.placeBet(1, 0, "teamB", 100 * 1e6); // Charlie bets Germany wins

        vm.prank(deployer);
        oracle.startMatch(1);

        // Brazil wins
        vm.prank(deployer);
        oracle.postResult(1, "teamA", "teamA", false, false);

        // Alice should have received payout (bet on teamA = Brazil)
        console.log("Alice VAR payout from match 1");

        // ─── Phase 3: Germany eliminated ───
        uint256 aliceYieldBefore = hook.accruedYield(alice);

        vm.prank(deployer);
        oracle.postElimination("Germany");

        // ─── Phase 4: France eliminated ───
        uint256 aliceYieldAfterGermany = hook.accruedYield(alice);
        assertGe(aliceYieldAfterGermany, aliceYieldBefore, "Alice yield should increase on Germany elimination");

        uint256 bobBalanceBefore = usdc.balanceOf(bob);
        uint256 daveBalanceBefore = usdc.balanceOf(dave);

        vm.prank(deployer);
        oracle.postElimination("France");

        // Bob and Dave should have received 50% back + their yield
        uint256 bobBalance = usdc.balanceOf(bob);
        uint256 daveBalance = usdc.balanceOf(dave);

        assertGe(bobBalance, bobBalanceBefore + 1000 * 1e6, "Bob gets at least 50% back");
        assertGe(daveBalance, daveBalanceBefore + 250 * 1e6, "Dave gets at least 50% back");

        // NFT badges minted
        assertEq(nft.totalSupply(), 2, "2 elimination badges minted");

        // ─── Phase 5: Brazil eliminated ───
        vm.prank(deployer);
        oracle.postElimination("Brazil");

        // ─── Phase 6: Argentina is champion ───
        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        uint256 eveBalanceBefore = usdc.balanceOf(eve);
        uint256 champPoolBalance = champPool.getBalance();

        console.log("Champion Pool balance before distribution:", champPoolBalance);

        vm.prank(deployer);
        oracle.postChampion("Argentina");

        uint256 aliceBalance = usdc.balanceOf(alice);
        uint256 eveBalance = usdc.balanceOf(eve);

        // Alice had 1000 USDC conviction + yield, should get all back
        assertGe(aliceBalance, aliceBalanceBefore + 1000 * 1e6, "Alice gets principal back");
        // Eve had 3000 USDC, should get principal + yield back
        assertGe(eveBalance, eveBalanceBefore + 3000 * 1e6, "Eve gets principal back");

        // Champion NFTs minted (2 champion NFTs for Alice and Eve)
        assertEq(nft.totalSupply(), 5, "5 NFTs total: 3 badges + 2 champion");

        console.log("=== Integration test passed ===");
        console.log("Final champion pool distributed:", champPoolBalance);
    }

    function test_treasury_receives_funds() public {
        // Multiple eliminations should fill treasury
        vm.prank(charlie);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(charlie);
        hook.depositConviction("Brazil", 1000 * 1e6);

        vm.prank(bob);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(bob);
        hook.depositConviction("France", 1000 * 1e6);

        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(deployer);
        oracle.postElimination("France");

        uint256 treasuryAfter = usdc.balanceOf(treasury);
        // France total = 1000, halfLost = 500, treasury = ~15% of 500 = 75 USDC
        assertGt(treasuryAfter, treasuryBefore, "Treasury should receive funds on elimination");
    }

    function test_nft_metadata() public {
        vm.prank(alice);
        usdc.approve(address(hook), 1000 * 1e6);
        vm.prank(alice);
        hook.depositConviction("France", 1000 * 1e6);

        vm.prank(deployer);
        oracle.postElimination("France");

        // Token 1 should be an EliminationBadge
        string memory uri = nft.tokenURI(1);
        assertTrue(bytes(uri).length > 0, "tokenURI should not be empty");
        // Should contain base64 prefix
        assertEq(bytes(uri)[0], bytes("d")[0]); // "data:application/json;base64,"
    }
}
