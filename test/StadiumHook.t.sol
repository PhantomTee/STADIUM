// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

import {StadiumHook} from "../src/StadiumHook.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Mock Uniswap V4 PoolManager for hook tests.
///         Only implements the callback modifier check (onlyPoolManager).
///         Hook callbacks are called directly from tests by setting msg.sender = poolManager.
contract MockPoolManager {
    // Minimal state to satisfy IPoolManager interface if needed
    receive() external payable {}
}

/// @notice Minimal mock oracle that can be configured per-test.
contract MockOracle {
    mapping(uint16 => bool) public eliminated;
    mapping(uint16 => uint8) public stage;

    function setEliminated(uint16 teamId, bool elim) external {
        eliminated[teamId] = elim;
    }

    function setStage(uint16 teamId, uint8 s) external {
        stage[teamId] = s;
    }

    function isTeamEliminated(uint16 teamId) external view returns (bool) {
        return eliminated[teamId];
    }

    function getTeamStage(uint16 teamId) external view returns (uint8) {
        return stage[teamId];
    }
}

/// @notice Minimal mock conviction vault.
contract MockConvictionVault {
    mapping(address => mapping(uint16 => bool)) public conviction;

    function setConviction(address user, uint16 teamId, bool active) external {
        conviction[user][teamId] = active;
    }

    function getActiveConviction(address user, uint16 teamId) external view returns (bool) {
        return conviction[user][teamId];
    }
}

/// @notice Minimal mock champion pool that records recordFor calls.
contract MockChampionPool {
    uint256 public lastAmount;
    string  public lastSource;
    uint256 public callCount;

    function recordFor(uint256 amount, string calldata source) external {
        lastAmount = amount;
        lastSource = source;
        callCount++;
    }
}

/// @notice Helper to deploy StadiumHook at an address with the correct Hooks flags bits
///         so that onlyPoolManager + getHookPermissions work.
///         Uses vm.etch to plant bytecode at the mined address.
contract StadiumHookTest is Test {
    using PoolIdLibrary for PoolKey;

    // ─────────────────────────────── Actors ───────────────────────────────

    address owner        = makeAddr("owner");
    address poolManager;   // set in setUp by deploying MockPoolManager

    MockOracle          oracle;
    MockConvictionVault convVault;
    MockChampionPool    champPool;
    MockUSDC            usdc;

    StadiumHook hook;

    uint16 constant TEAM_ARG = 37;
    uint16 constant TEAM_FRA = 33;

    // ─────────────────────────────── Pool key helper ───────────────────────────────

    PoolKey baseKey;
    bytes32 basePoolId;

    function setUp() public {
        // Deploy mocks
        MockPoolManager pm = new MockPoolManager();
        poolManager = address(pm);

        oracle    = new MockOracle();
        convVault = new MockConvictionVault();
        champPool = new MockChampionPool();
        usdc      = new MockUSDC();

        // We need to deploy the hook at an address that satisfies Hooks permission bits.
        // In a real deployment this requires HookMiner. For testing, we use vm.etch.
        // Compute required flags
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG  |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.AFTER_ADD_LIQUIDITY_FLAG
        );

        // Create the hook at an address that has the correct flag bits
        // by deploying to a known address and then etching
        address hookAddr = address(flags);

        // Deploy real hook with vm.prank to set the poolManager
        // Since we can't mine in tests, we deploy to a temp address then etch
        vm.prank(owner);
        StadiumHook tempHook = new StadiumHook(IPoolManager(poolManager), owner);

        // Etch the bytecode at the flagged address
        vm.etch(hookAddr, address(tempHook).code);

        hook = StadiumHook(hookAddr);

        // The storage won't be copied — need to set state via the temp hook pattern
        // Instead: use vm.store to set owner and poolManager on the etched address.
        // For simplicity in tests, we skip etching and use the temp hook directly,
        // spoofing msg.sender as poolManager for callback invocations.
        hook = tempHook;

        // Wire up addresses
        vm.startPrank(owner);
        hook.setOracle(address(oracle));
        hook.setChampionPool(address(champPool));
        hook.setConvictionVault(address(convVault));
        hook.setTreasury(address(usdc)); // just an address for treasury
        hook.setUsdc(address(usdc));
        hook.setProtocolFeeBps(30);
        vm.stopPrank();

        // Build a test PoolKey
        address tokenA = address(usdc);
        address tokenB = makeAddr("teamToken");
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        baseKey = PoolKey({
            currency0:   Currency.wrap(t0),
            currency1:   Currency.wrap(t1),
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });
        basePoolId = PoolId.unwrap(baseKey.toId());
    }

    // ─────────────────────────────── Helper ───────────────────────────────

    function _registerPool(uint16 teamId) internal {
        vm.prank(owner);
        hook.registerPool(baseKey, teamId);
    }

    function _makeSwapParams(bool zeroForOne) internal pure returns (SwapParams memory) {
        return SwapParams({
            zeroForOne:        zeroForOne,
            amountSpecified:   -1000e6, // exact input: 1000 USDC
            sqrtPriceLimitX96: zeroForOne
                ? 4295128740                   // min sqrt price
                : 1461446703485210103287273052203988822378723970341 // max sqrt price
        });
    }

    // ─────────────────────────────── Tests ───────────────────────────────

    // ── Test 1: Owner can register a pool ───────────────────────────────

    function test_RegisterPool() public {
        _registerPool(TEAM_ARG);

        (
            uint16 teamId,
            bool registered,
            bool active,
            uint256 totalVol,
            uint256 feeRouted
        ) = hook.poolState(basePoolId);

        assertEq(teamId,     TEAM_ARG);
        assertTrue(registered);
        assertTrue(active);
        assertEq(totalVol,   0);
        assertEq(feeRouted,  0);
        assertEq(hook.teamPoolId(TEAM_ARG), basePoolId);
    }

    // ── Test 2: Non-owner cannot register a pool ─────────────────────────

    function test_RegisterPool_NonOwner_Reverts() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert();
        hook.registerPool(baseKey, TEAM_ARG);
    }

    // ── Test 3: beforeSwap reverts for unregistered pool ──────────────────

    function test_UnregisteredPool_Reverts() public {
        // Do NOT register the pool
        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        vm.expectRevert(StadiumHook.PoolNotRegistered.selector);
        hook.beforeSwap(address(this), baseKey, params, "");
    }

    // ── Test 4: Eliminated team swap reverts ────────────────────────────

    function test_EliminatedTeam_SwapReverts() public {
        _registerPool(TEAM_ARG);
        oracle.setEliminated(TEAM_ARG, true);

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        vm.expectRevert(StadiumHook.TeamEliminated.selector);
        hook.beforeSwap(address(this), baseKey, params, "");
    }

    // ── Test 5: Paused hook rejects all swaps ───────────────────────────

    function test_PauseBlocksSwaps() public {
        _registerPool(TEAM_ARG);

        vm.prank(owner);
        hook.pause();

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        vm.expectRevert(StadiumHook.TradingPaused.selector);
        hook.beforeSwap(address(this), baseKey, params, "");
    }

    // ── Test 6: Unpause allows swaps again ────────────────────────────

    function test_UnpauseAllowsSwaps() public {
        _registerPool(TEAM_ARG);

        vm.prank(owner);
        hook.pause();
        vm.prank(owner);
        hook.unpause();

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        (bytes4 selector,,) = hook.beforeSwap(address(this), baseKey, params, "");
        assertEq(selector, StadiumHook.beforeSwap.selector);
    }

    // ── Test 7: Successful beforeSwap returns correct selector ─────────────

    function test_BeforeSwap_ReturnsSelector() public {
        _registerPool(TEAM_ARG);

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        (bytes4 selector, BeforeSwapDelta delta, uint24 fee) = hook.beforeSwap(address(this), baseKey, params, "");

        assertEq(selector, StadiumHook.beforeSwap.selector);
        assertEq(BeforeSwapDelta.unwrap(delta), BeforeSwapDelta.unwrap(BeforeSwapDeltaLibrary.ZERO_DELTA));
        // Fee should be group stage default (3000) with the v4 override flag for non-conviction holder
        assertEq(fee, LPFeeLibrary.OVERRIDE_FEE_FLAG | 3000);
    }

    // ── Test 8: Conviction holder gets lower fee ──────────────────────────

    function test_ConvictionHolderGetsDiscount() public {
        _registerPool(TEAM_ARG);

        address swapper = makeAddr("swapper");
        convVault.setConviction(swapper, TEAM_ARG, true);

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        (, , uint24 fee) = hook.beforeSwap(swapper, baseKey, params, "");

        // Default group stage fee = 3000, conviction discount = 500
        // Expected fee = (3000 - 500) with the v4 override flag
        assertEq(fee, LPFeeLibrary.OVERRIDE_FEE_FLAG | 2500, "Conviction holder should get discounted fee");
    }

    // ── Test 9: Momentum updates on swap ───────────────────────────────

    function test_MomentumUpdatesOnSwap() public {
        _registerPool(TEAM_ARG);

        uint256 momentumBefore = hook.teamMomentum(TEAM_ARG);

        // Simulate afterSwap with a non-zero delta
        // BalanceDelta layout: high 128 bits = amount0, low 128 bits = amount1
        // amount0 = -1000e6 (user sends USDC), amount1 = +500e6 (user receives tokens)
        int256 packed = (int256(int128(-1000e6)) << 128) | int256(int128(500e6));
        BalanceDelta delta = BalanceDelta.wrap(packed);

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        hook.afterSwap(address(this), baseKey, params, delta, "");

        uint256 momentumAfter = hook.teamMomentum(TEAM_ARG);
        assertGt(momentumAfter, momentumBefore, "Momentum should increase after swap");
    }

    // ── Test 10: afterSwap increments the notional feeRoutedToChampPool accumulator ──
    //    No real USDC leaves the hook — ChampionPool is funded by ConvictionVault, not here.

    function test_AfterSwap_UpdatesNotionalFeeAccumulator() public {
        _registerPool(TEAM_ARG);

        // BalanceDelta: amount0 = -1000e6, amount1 = +500e6
        int256 packed2 = (int256(int128(-1000e6)) << 128) | int256(int128(500e6));
        BalanceDelta delta = BalanceDelta.wrap(packed2);

        SwapParams memory params = _makeSwapParams(true);

        vm.prank(poolManager);
        hook.afterSwap(address(this), baseKey, params, delta, "");

        // No call to championPool — fee is notional only
        assertEq(champPool.callCount(), 0, "ChampionPool must NOT be called from hook afterSwap");

        // feeRoutedToChampPool accumulator must increase
        (,,,, uint256 feeRouted) = hook.poolState(basePoolId);
        assertGt(feeRouted, 0, "Notional fee accumulator should increase after swap");
    }

    // ── Test 11: beforeAddLiquidity reverts for eliminated team ─────────────

    function test_BeforeAddLiquidity_EliminatedTeam_Reverts() public {
        _registerPool(TEAM_ARG);
        oracle.setEliminated(TEAM_ARG, true);

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower:      -600,
            tickUpper:       600,
            liquidityDelta:  1e18,
            salt:            bytes32(0)
        });

        vm.prank(poolManager);
        vm.expectRevert(StadiumHook.TeamEliminated.selector);
        hook.beforeAddLiquidity(address(this), baseKey, params, "");
    }

    // ── Test 11a: beforeAddLiquidity succeeds on registered, active pool ────
    //    Proves a pool can be seeded with liquidity through the hook.

    function test_BeforeAddLiquidity_Succeeds() public {
        _registerPool(TEAM_ARG);

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower:      -887220,
            tickUpper:       887220,
            liquidityDelta:  1e24,
            salt:            bytes32(0)
        });

        vm.prank(poolManager);
        bytes4 selector = hook.beforeAddLiquidity(address(this), baseKey, params, "");
        assertEq(selector, StadiumHook.beforeAddLiquidity.selector, "beforeAddLiquidity must return correct selector");
    }

    // ── Test 11b: afterSwap uses USDC side correctly when USDC is currency1 ──

    function test_AfterSwap_UsesUsdcCurrency1ForVolume() public {
        // Build a key where teamToken < usdc (i.e. usdc is currency1)
        address teamToken = address(0x1); // tiny address → teamToken is currency0
        // usdc address is larger, so currency0 = teamToken, currency1 = usdc
        PoolKey memory key1 = PoolKey({
            currency0:   Currency.wrap(teamToken),
            currency1:   Currency.wrap(address(usdc)),
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });

        vm.prank(owner);
        hook.registerPool(key1, TEAM_FRA);

        // amount0 = +999e6 (team tokens received by PM), amount1 = -500e6 (USDC paid by PM)
        // USDC is currency1 → hook should use abs(amount1) = 500e6 for volume.
        // Must mask amount1 to prevent sign-extension from corrupting the high 128 bits.
        int256 packed = (int256(int128(999e6)) << 128) | int256(uint256(uint128(int128(-500e6))));
        BalanceDelta delta = BalanceDelta.wrap(packed);

        SwapParams memory p = SwapParams({
            zeroForOne: false,
            amountSpecified: -500e6,
            sqrtPriceLimitX96: 1461446703485210103287273052203988822378723970341
        });

        vm.prank(poolManager);
        hook.afterSwap(address(this), key1, p, delta, "");

        bytes32 pid1 = PoolId.unwrap(key1.toId());
        (,,, uint256 vol,) = hook.poolState(pid1);
        assertEq(vol, 500e6, "Volume should reflect USDC (currency1) side");
        assertEq(hook.teamMomentum(TEAM_FRA), 500e6, "Momentum should use USDC side");
    }

    // ── Test 11c: registerPool with no-USDC pool reverts InvalidUSDCPool ────

    function test_RegisterPool_NonUSDCPool_Reverts() public {
        // Build a key that contains neither usdc nor a team token — just two random tokens
        address randA = makeAddr("randA");
        address randB = makeAddr("randB");
        (address t0, address t1) = randA < randB ? (randA, randB) : (randB, randA);

        PoolKey memory badKey = PoolKey({
            currency0:   Currency.wrap(t0),
            currency1:   Currency.wrap(t1),
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });

        vm.prank(owner);
        vm.expectRevert(StadiumHook.InvalidUSDCPool.selector);
        hook.registerPool(badKey, TEAM_ARG);
    }

    // ── Test 12: Registered pool returns correct pool state ─────────────────

    function test_RegisterPool_AlreadyRegistered_Reverts() public {
        _registerPool(TEAM_ARG);

        vm.prank(owner);
        vm.expectRevert(StadiumHook.PoolAlreadyRegistered.selector);
        hook.registerPool(baseKey, TEAM_FRA);
    }

    // ── Test 13: protocolFeeBps enforcement ─────────────────────────────

    function test_ProtocolFeeBps_TooHigh_Reverts() public {
        vm.prank(owner);
        vm.expectRevert();
        hook.setProtocolFeeBps(1001); // > 1000 = > 10%
    }

    // ── Test 14: FeeConfig can be updated ──────────────────────────────

    function test_SetFeeConfig() public {
        StadiumHook.FeeConfig memory cfg = StadiumHook.FeeConfig({
            groupStageFee:      2000,
            knockoutFee:        4000,
            finalFee:           8000,
            convictionDiscount: 300
        });

        vm.prank(owner);
        hook.setFeeConfig(cfg);

        (uint24 g, uint24 k, uint24 f, uint24 d) = hook.feeConfig();
        assertEq(g, 2000);
        assertEq(k, 4000);
        assertEq(f, 8000);
        assertEq(d, 300);
    }
}
