// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {HookMiner} from "../src/vendor/HookMiner.sol";
import {StadiumHook} from "../src/StadiumHook.sol";

/// @notice Mines a CREATE2 salt such that the deployed StadiumHook address encodes
///         the required Uniswap V4 hook permission bits, then deploys the hook.
///
/// Required env vars:
///   PRIVATE_KEY            — deployer private key
///   POOL_MANAGER_ADDRESS   — deployed IPoolManager address
///
/// After deployment, update TEAM_FACTORY_ADDRESS with:
///   teamFactory.setHook(address(hook))
///
/// Usage:
///   forge script script/DeployHook.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract DeployHook is Script {
    // Foundry routes `new Contract{salt: s}()` broadcasts through this
    // deterministic CREATE2 factory (auto-deployed by forge if absent).
    address constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address owner        = vm.addr(deployerKey);
        address poolManager  = vm.envAddress("POOL_MANAGER_ADDRESS");
        require(poolManager != address(0), "DeployHook: POOL_MANAGER_ADDRESS not set");

        // ── Compute required flags ────────────────────────────────────────────
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG  |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.AFTER_ADD_LIQUIDITY_FLAG
        );

        // ── Mine hook address via CREATE2 ─────────────────────────────────────
        // HookMiner.find searches for a salt such that:
        //   keccak256(0xff ++ deployer ++ salt ++ initCodeHash) has the correct flag bits
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), owner);
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY,
            flags,
            type(StadiumHook).creationCode,
            constructorArgs
        );

        console.log("Mined hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // ── Deploy with mined salt ────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        StadiumHook hook = new StadiumHook{salt: salt}(IPoolManager(poolManager), owner);
        require(address(hook) == hookAddress, "DeployHook: address mismatch - re-run mining");

        vm.stopBroadcast();

        console.log("\n=== HOOK DEPLOYMENT SUMMARY ===");
        console.log("StadiumHook:  ", address(hook));
        console.log("Salt:         ", vm.toString(salt));
        console.log("PoolManager:  ", poolManager);
        console.log("Owner:        ", owner);
        console.log("\nNext steps:");
        console.log("1. Set STADIUM_HOOK_ADDRESS=", address(hook));
        console.log("2. Call teamFactory.setHook(", address(hook), ")");
        console.log("3. Run CreatePools.s.sol to initialize team pools");

        // ── Update deployments.json with hook address ─────────────────────────
        // Read existing file so other fields are preserved (best-effort; new file if absent)
        string memory hookAddr  = vm.toString(address(hook));
        string memory pmAddr    = vm.toString(poolManager);
        string memory chainId   = vm.toString(block.chainid);
        // Write a minimal hook-info file alongside deployments.json
        string memory hookJson = string.concat(
            '{\n',
            '  "chainId": ',       chainId,    ',\n',
            '  "poolManager": "',  pmAddr,     '",\n',
            '  "stadiumHook": "',  hookAddr,   '",\n',
            '  "hookFlags": "beforeSwap|afterSwap|beforeAddLiquidity|afterAddLiquidity",\n',
            '  "hookSalt": "',     vm.toString(salt), '"\n',
            '}'
        );
        vm.writeFile("./hook-deployment.json", hookJson);
        console.log("\nHook info written to hook-deployment.json");
        console.log("Merge stadiumHook address into deployments.json manually or via jq.");
    }
}
