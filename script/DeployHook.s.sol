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

        // Wire USDC immediately so momentum tracks USDC volume (not raw token amounts).
        // Without this, hook.usdc == address(0) and afterSwap falls back to amt0,
        // which is the 18-decimal team token for most pools — showing absurd momentum.
        address usdcAddr = _envAddressOr("MOCK_USDC_ADDRESS", address(0));
        if (usdcAddr != address(0)) {
            hook.setUsdc(usdcAddr);
            console.log("setUsdc:", usdcAddr);
        } else {
            console.log("WARNING: MOCK_USDC_ADDRESS not set - momentum will use demo fallback (amt0).");
            console.log("         Run SetHookUsdc.s.sol to fix this before any swaps.");
        }

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

    function _envAddressOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val == address(0) ? fallback_ : val;
        } catch {
            return fallback_;
        }
    }
}
