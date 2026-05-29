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
contract DeployRouter is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address poolManager  = vm.envAddress("POOL_MANAGER_ADDRESS");
        require(poolManager != address(0), "DeployRouter: set POOL_MANAGER_ADDRESS");

        vm.startBroadcast(deployerKey);
        StadiumRouter router = new StadiumRouter(poolManager);
        vm.stopBroadcast();

        console.log("StadiumRouter deployed at:", address(router));

        string memory json = string.concat(
            '{\n  "stadiumRouter": "', vm.toString(address(router)), '"\n}'
        );
        vm.writeFile("./router-deployment.json", json);
        console.log("Router address written to router-deployment.json");
    }
}
