// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StadiumHook} from "../src/StadiumHook.sol";

/// @notice One-shot script to call StadiumHook.setUsdc() on an already-deployed hook.
///
/// Required env vars:
///   PRIVATE_KEY           — hook owner's key
///   STADIUM_HOOK_ADDRESS  — deployed StadiumHook address
///   MOCK_USDC_ADDRESS     — MockUSDC (or real USDC) address to register
///
/// Usage:
///   forge script script/SetHookUsdc.s.sol --rpc-url $RPC_URL --broadcast --slow
contract SetHookUsdc is Script {
    function run() external {
        uint256 key     = vm.envUint("PRIVATE_KEY");
        address hookAddr = vm.envAddress("STADIUM_HOOK_ADDRESS");
        address usdc     = vm.envAddress("MOCK_USDC_ADDRESS");

        require(hookAddr != address(0), "SetHookUsdc: STADIUM_HOOK_ADDRESS not set");
        require(usdc     != address(0), "SetHookUsdc: MOCK_USDC_ADDRESS not set");

        StadiumHook hook = StadiumHook(hookAddr);

        console.log("Hook:    ", hookAddr);
        console.log("USDC:    ", usdc);
        console.log("Current usdc():", hook.usdc());

        vm.broadcast(key);
        hook.setUsdc(usdc);

        console.log("Done — hook.usdc() =", hook.usdc());
    }
}
