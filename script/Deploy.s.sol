// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {MockUSDC}        from "../src/MockUSDC.sol";
import {ChampionPool}    from "../src/ChampionPool.sol";
import {StadiumNFT}      from "../src/StadiumNFT.sol";
import {MatchOracle}     from "../src/MatchOracle.sol";
import {ConvictionVault} from "../src/ConvictionVault.sol";
import {VARMarket}       from "../src/VARMarket.sol";
import {Treasury}        from "../src/Treasury.sol";
import {TeamFactory}     from "../src/TeamFactory.sol";

/// @notice Deploys the full STADIUM protocol.
///
/// Chain / RPC are read from .env:
///   XLAYER_CHAIN_ID  — set to 1952 (testnet docs) or 196 (mainnet)
///   XLAYER_RPC_URL   — RPC endpoint
///   PRIVATE_KEY      — deployer key
///   TREASURY_ADDRESS — protocol treasury wallet
///
/// Optional overrides (leave blank to deploy fresh):
///   POOL_MANAGER_ADDRESS — official Uniswap v4 PoolManager (mainnet)
///                          If empty, deploys a DEMO MockPoolManager (testnet only)
///   MOCK_USDC_ADDRESS    — existing USDC token
///                          If empty, deploys MockUSDC
///
/// StadiumHook is NOT deployed here — it requires address mining for V4 hook bits.
/// See README for hook deployment instructions.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address deployer     = vm.addr(deployerKey);
        address treasury     = vm.envAddress("TREASURY_ADDRESS");
        require(treasury != address(0), "Deploy: TREASURY_ADDRESS not set");

        // ── Optional overrides ────────────────────────────────────────────────
        address poolManagerOverride = _envAddressOr("POOL_MANAGER_ADDRESS", address(0));
        address usdcOverride        = _envAddressOr("MOCK_USDC_ADDRESS",    address(0));

        vm.startBroadcast(deployerKey);

        // 1. PoolManager — use override or deploy demo
        address poolManagerAddr;
        bool demoPoolManager = (poolManagerOverride == address(0));
        if (demoPoolManager) {
            PoolManager pm = new PoolManager(deployer);
            poolManagerAddr = address(pm);
            console.log("[DEMO] MockPoolManager:", poolManagerAddr);
            console.log("       ^ Testnet demo only. For mainnet, set POOL_MANAGER_ADDRESS.");
        } else {
            poolManagerAddr = poolManagerOverride;
            console.log("PoolManager (existing):", poolManagerAddr);
        }

        // 2. MockUSDC — use override or deploy fresh
        address usdcAddr;
        if (usdcOverride != address(0)) {
            usdcAddr = usdcOverride;
            console.log("MockUSDC (existing):", usdcAddr);
        } else {
            MockUSDC usdc = new MockUSDC();
            usdcAddr = address(usdc);
            console.log("MockUSDC:", usdcAddr);
            // Mint faucet supply for testing
            usdc.mint(deployer, 10_000_000 * 1e6); // 10M USDC
        }

        // 3. Treasury
        Treasury treasuryContract = new Treasury(deployer, usdcAddr);
        console.log("Treasury:", address(treasuryContract));

        // 4. ChampionPool
        ChampionPool champPool = new ChampionPool(usdcAddr, deployer);
        console.log("ChampionPool:", address(champPool));

        // 5. StadiumNFT
        StadiumNFT nft = new StadiumNFT(deployer);
        console.log("StadiumNFT:", address(nft));

        // 6. MatchOracle
        MatchOracle oracle = new MatchOracle(deployer, treasury);
        console.log("MatchOracle:", address(oracle));

        // 7. ConvictionVault
        ConvictionVault vault = new ConvictionVault(usdcAddr, treasury, deployer);
        console.log("ConvictionVault:", address(vault));

        // 8. VARMarket
        VARMarket varMarket = new VARMarket(
            usdcAddr,
            address(oracle),
            address(vault),
            treasury,
            address(champPool)
        );
        console.log("VARMarket:", address(varMarket));

        // 9. TeamFactory (hook address = address(0) until DeployHook.s.sol is run)
        TeamFactory teamFactory = new TeamFactory(poolManagerAddr, usdcAddr, address(0), deployer);
        console.log("TeamFactory:", address(teamFactory));

        // 10. Wire addresses
        vault.setOracle(address(oracle));
        vault.setChampionPool(address(champPool));
        vault.setStadiumNFT(address(nft));

        oracle.setAddresses(address(vault), address(varMarket), address(champPool));

        champPool.setAddresses(address(vault), address(varMarket), address(oracle));

        nft.setConvictionVault(address(vault));

        vm.stopBroadcast();

        // ── Summary ───────────────────────────────────────────────────────────
        console.log("\n=== STADIUM DEPLOYMENT SUMMARY ===");
        console.log("Deployer:       ", deployer);
        console.log("Treasury:       ", treasury);
        console.log("PoolManager:    ", poolManagerAddr, demoPoolManager ? "[DEMO]" : "[OFFICIAL]");
        console.log("MockUSDC:       ", usdcAddr);
        console.log("TreasuryContract:", address(treasuryContract));
        console.log("ChampionPool:   ", address(champPool));
        console.log("StadiumNFT:     ", address(nft));
        console.log("MatchOracle:    ", address(oracle));
        console.log("ConvictionVault:", address(vault));
        console.log("VARMarket:      ", address(varMarket));
        console.log("TeamFactory:    ", address(teamFactory));
        console.log("\nNote: Deploy StadiumHook separately via DeployHook.s.sol (requires address mining).");
        console.log("      After hook deployed, call: teamFactory.setHook(hookAddress)");

        // Write deployments.json
        string memory chainIdStr = vm.toString(block.chainid);
        string memory json = string.concat(
            '{\n',
            '  "chainId": ',           chainIdStr,                          ',\n',
            '  "demoPoolManager": ',   demoPoolManager ? "true" : "false",  ',\n',
            '  "poolManager": "',      vm.toString(poolManagerAddr),        '",\n',
            '  "mockUSDC": "',         vm.toString(usdcAddr),               '",\n',
            '  "treasury": "',         vm.toString(address(treasuryContract)), '",\n',
            '  "championPool": "',     vm.toString(address(champPool)),     '",\n',
            '  "stadiumNFT": "',       vm.toString(address(nft)),           '",\n',
            '  "matchOracle": "',      vm.toString(address(oracle)),        '",\n',
            '  "convictionVault": "',  vm.toString(address(vault)),         '",\n',
            '  "varMarket": "',        vm.toString(address(varMarket)),     '",\n',
            '  "teamFactory": "',      vm.toString(address(teamFactory)),   '",\n',
            '  "stadiumHook": ""',                                           '\n',
            '}'
        );
        vm.writeFile("./deployments.json", json);
        console.log("\nAddresses written to deployments.json");
        console.log("Copy frontend/.env values from deployments.json after deployment.");
    }

    /// @dev Reads an address env var, returns fallback if not set or zero-string
    function _envAddressOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val == address(0) ? fallback_ : val;
        } catch {
            return fallback_;
        }
    }
}
