// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ChampionPool} from "../src/ChampionPool.sol";
import {StadiumNFT} from "../src/StadiumNFT.sol";
import {MatchOracle} from "../src/MatchOracle.sol";
import {ConvictionHook} from "../src/ConvictionHook.sol";
import {VARMarket} from "../src/VARMarket.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer   = vm.addr(deployerPrivateKey);
        address treasuryAddr = vm.envAddress("TREASURY_ADDRESS");

        require(treasuryAddr != address(0), "Deploy: treasury not set");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Uniswap V4 PoolManager (self-hosted for X Layer Testnet)
        PoolManager poolManager = new PoolManager(deployer);
        console.log("PoolManager:", address(poolManager));

        // 2. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:", address(usdc));

        // 3. Deploy ChampionPool (needs deployer as Ownable owner)
        ChampionPool champPool = new ChampionPool(address(usdc), deployer);
        console.log("ChampionPool:", address(champPool));

        // 4. Deploy StadiumNFT
        StadiumNFT nft = new StadiumNFT(deployer);
        console.log("StadiumNFT:", address(nft));

        // 5. Deploy MatchOracle
        MatchOracle oracle = new MatchOracle(deployer, treasuryAddr);
        console.log("MatchOracle:", address(oracle));

        // 6. Deploy ConvictionHook
        ConvictionHook hook = new ConvictionHook(
            IPoolManager(address(poolManager)),
            address(usdc),
            treasuryAddr,
            deployer
        );
        console.log("ConvictionHook:", address(hook));

        // 7. Deploy VARMarket
        VARMarket varMarket = new VARMarket(
            address(usdc),
            address(oracle),
            address(hook),
            treasuryAddr,
            address(champPool)
        );
        console.log("VARMarket:", address(varMarket));

        // 8. Wire up addresses
        hook.setOracle(address(oracle));
        hook.setChampionPool(address(champPool));
        hook.setVarMarket(address(varMarket));
        hook.setStadiumNFT(address(nft));

        oracle.setAddresses(address(hook), address(varMarket), address(champPool));
        champPool.setAddresses(address(hook), address(varMarket), address(oracle));
        nft.setConvictionHook(address(hook));

        // 9. Mint initial faucet supply for testing
        usdc.mint(deployer, 10_000_000 * 1e6);

        vm.stopBroadcast();

        console.log("\n=== STADIUM DEPLOYMENT SUMMARY ===");
        console.log("Chain: X Layer Testnet (ID 195)");
        console.log("Deployer:      ", deployer);
        console.log("Treasury:      ", treasuryAddr);
        console.log("PoolManager:   ", address(poolManager));
        console.log("MockUSDC:      ", address(usdc));
        console.log("ChampionPool:  ", address(champPool));
        console.log("StadiumNFT:    ", address(nft));
        console.log("MatchOracle:   ", address(oracle));
        console.log("ConvictionHook:", address(hook));
        console.log("VARMarket:     ", address(varMarket));

        string memory json = string.concat(
            '{\n',
            '  "chainId": 195,\n',
            '  "poolManager": "',    vm.toString(address(poolManager)), '",\n',
            '  "mockUSDC": "',       vm.toString(address(usdc)),        '",\n',
            '  "championPool": "',   vm.toString(address(champPool)),   '",\n',
            '  "stadiumNFT": "',     vm.toString(address(nft)),         '",\n',
            '  "matchOracle": "',    vm.toString(address(oracle)),      '",\n',
            '  "convictionHook": "', vm.toString(address(hook)),        '",\n',
            '  "varMarket": "',      vm.toString(address(varMarket)),   '"\n',
            '}'
        );
        vm.writeFile("./deployments.json", json);
        console.log("\nAddresses written to deployments.json");
    }
}
