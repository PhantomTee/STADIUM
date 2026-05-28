// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StadiumRouter} from "../src/StadiumRouter.sol";

/// @notice Deploys StadiumRouter against the already-deployed PoolManager.
///
/// Required env vars:
///   PRIVATE_KEY           — deployer key
///   POOL_MANAGER_ADDRESS  — PoolManager address from deployments.json
///
/// Usage:
///   forge script script/DeployRouter.s.sol \
///     --rpc-url $XLAYER_RPC_URL \
///     --broadcast
///
/// Then copy the printed address into frontend/.env:
///   VITE_STADIUM_ROUTER_ADDRESS=0x...
contract DeployRouter is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address poolManager  = vm.envAddress("POOL_MANAGER_ADDRESS");
        require(poolManager != address(0), "DeployRouter: set POOL_MANAGER_ADDRESS");

        vm.startBroadcast(deployerKey);
        StadiumRouter router = new StadiumRouter(poolManager);
        vm.stopBroadcast();

        console.log("StadiumRouter deployed at:", address(router));
        console.log("\nAdd to frontend/.env:");
        console.log("VITE_STADIUM_ROUTER_ADDRESS=%s", address(router));
    }
}
