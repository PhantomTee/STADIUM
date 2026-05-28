// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {TeamFactory} from "../src/TeamFactory.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

/// @dev Minimal pool manager mock — initialize() is mocked via vm.mockCall in each test.
contract MockPoolManager {
    receive() external payable {}
}

contract TeamFactoryTest is Test {
    MockUSDC     usdc;
    TeamFactory  factory;
    address      poolMgr;
    address      owner = makeAddr("owner");
    address      hook  = makeAddr("hook");

    uint16 constant TEAM_BRA = 9;

    function setUp() public {
        usdc    = new MockUSDC();
        MockPoolManager pm = new MockPoolManager();
        poolMgr = address(pm);

        // Deploy factory with hook == address(0) (pre-mine state)
        factory = new TeamFactory(poolMgr, address(usdc), address(0), owner);

        // Register team so createTeamPool has something to work with
        vm.prank(owner);
        factory.registerTeam(TEAM_BRA, "Brazil", "BRA");
    }

    // ── Test 1: createTeamPool reverts when hook is not set ──────────────

    function test_CreatePool_RevertsWhenHookUnset() public {
        vm.prank(owner);
        vm.expectRevert(TeamFactory.ZeroAddress.selector);
        factory.createTeamPool(TEAM_BRA, 60, 79228162514264337593543950336);
    }

    // ── Test 2: createTeamPool succeeds after hook is set ────────────────

    function test_CreatePool_SucceedsAfterSetHook() public {
        // Set hook first
        vm.prank(owner);
        factory.setHook(hook);

        // Mock poolManager.initialize() to succeed
        vm.mockCall(
            poolMgr,
            abi.encodeWithSelector(IPoolManager.initialize.selector),
            abi.encode(int24(0))
        );

        vm.prank(owner);
        factory.createTeamPool(TEAM_BRA, 60, 79228162514264337593543950336);

        assertTrue(factory.teamPoolId(TEAM_BRA) != bytes32(0), "Pool ID must be set");
    }

    // ── Test 3: setHook can be called by owner only ─────────────────────

    function test_SetHook_NonOwner_Reverts() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert();
        factory.setHook(hook);
    }

    // ── Test 4: double pool creation reverts ────────────────────────────

    function test_CreatePool_AlreadyCreated_Reverts() public {
        vm.prank(owner);
        factory.setHook(hook);

        vm.mockCall(
            poolMgr,
            abi.encodeWithSelector(IPoolManager.initialize.selector),
            abi.encode(int24(0))
        );

        vm.prank(owner);
        factory.createTeamPool(TEAM_BRA, 60, 79228162514264337593543950336);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TeamFactory.PoolAlreadyCreated.selector, TEAM_BRA));
        factory.createTeamPool(TEAM_BRA, 60, 79228162514264337593543950336);
    }
}
