// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";

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
/// Required env vars:
///   PRIVATE_KEY        — deployer key
///   TREASURY_ADDRESS   — protocol treasury wallet
///
/// Optional overrides:
///   POOL_MANAGER_ADDRESS — existing Uniswap v4 PoolManager; omit to deploy demo
///   MOCK_USDC_ADDRESS    — existing USDC; omit to deploy fresh MockUSDC
///
/// StadiumHook is NOT deployed here — it requires CREATE2 address mining.
/// Run DeployHook.s.sol after this script.
contract Deploy is Script {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct CoreAddresses {
        address usdc;
        address treasury;
        address oracle;
        address championPool;
        address convictionVault;
        address varMarket;
        address nft;
        address teamFactory;
        address stadiumHook;
    }

    struct DeployConfig {
        address deployer;
        address treasuryAddress;
        address poolManager;
        bool    demoMode;
    }

    // ── Entry point ───────────────────────────────────────────────────────────

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        DeployConfig memory cfg = _loadConfig(deployerKey);

        vm.startBroadcast(deployerKey);
        CoreAddresses memory a = _deployCore(cfg);
        _wireContracts(a);
        vm.stopBroadcast();

        _logSummary(cfg, a);
        _writeDeploymentJson(cfg, a);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _loadConfig(uint256 deployerKey) internal returns (DeployConfig memory cfg) {
        cfg.deployer       = vm.addr(deployerKey);
        cfg.treasuryAddress = vm.envAddress("TREASURY_ADDRESS");
        require(cfg.treasuryAddress != address(0), "Deploy: TREASURY_ADDRESS not set");

        address pmOverride = _envAddressOr("POOL_MANAGER_ADDRESS", address(0));
        cfg.demoMode   = (pmOverride == address(0));
        cfg.poolManager = pmOverride;
    }

    function _deployCore(DeployConfig memory cfg) internal returns (CoreAddresses memory a) {
        // 1. PoolManager — deploy demo instance or use existing
        if (cfg.demoMode) {
            cfg.poolManager = address(new PoolManager(cfg.deployer));
            console.log("[DEMO] PoolManager:", cfg.poolManager);
            console.log("       ^ Testnet demo only. Set POOL_MANAGER_ADDRESS for mainnet.");
        } else {
            console.log("PoolManager (existing):", cfg.poolManager);
        }

        // 2. MockUSDC
        address usdcOverride = _envAddressOr("MOCK_USDC_ADDRESS", address(0));
        if (usdcOverride != address(0)) {
            a.usdc = usdcOverride;
            console.log("MockUSDC (existing):", a.usdc);
        } else {
            MockUSDC freshUsdc = new MockUSDC();
            a.usdc = address(freshUsdc);
            freshUsdc.mint(cfg.deployer, 10_000_000 * 1e6);
            console.log("MockUSDC:", a.usdc);
        }

        // 3. Core contracts — each immediately cast to address to free stack slots
        a.treasury      = address(new Treasury(cfg.deployer, a.usdc));
        console.log("Treasury:", a.treasury);

        a.championPool  = address(new ChampionPool(a.usdc, cfg.deployer));
        console.log("ChampionPool:", a.championPool);

        a.nft           = address(new StadiumNFT(cfg.deployer));
        console.log("StadiumNFT:", a.nft);

        a.oracle        = address(new MatchOracle(cfg.deployer, cfg.treasuryAddress));
        console.log("MatchOracle:", a.oracle);

        a.convictionVault = address(new ConvictionVault(a.usdc, cfg.treasuryAddress, cfg.deployer));
        console.log("ConvictionVault:", a.convictionVault);

        a.varMarket = address(new VARMarket(
            a.usdc,
            a.oracle,
            a.convictionVault,
            cfg.treasuryAddress,
            a.championPool
        ));
        console.log("VARMarket:", a.varMarket);

        a.teamFactory = address(new TeamFactory(
            cfg.poolManager, a.usdc, address(0), cfg.deployer
        ));
        console.log("TeamFactory:", a.teamFactory);

        a.stadiumHook = address(0);
    }

    function _wireContracts(CoreAddresses memory a) internal {
        ConvictionVault(a.convictionVault).setOracle(a.oracle);
        ConvictionVault(a.convictionVault).setChampionPool(a.championPool);
        ConvictionVault(a.convictionVault).setStadiumNFT(a.nft);

        MatchOracle(a.oracle).setAddresses(a.convictionVault, a.varMarket, a.championPool);

        ChampionPool(a.championPool).setAddresses(a.convictionVault, a.varMarket, a.oracle);

        StadiumNFT(a.nft).setConvictionVault(a.convictionVault);
    }

    function _writeDeploymentJson(DeployConfig memory cfg, CoreAddresses memory a) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ',          vm.toString(block.chainid),             ',\n',
            '  "demoPoolManager": ',  cfg.demoMode ? "true" : "false",        ',\n',
            '  "poolManager": "',     vm.toString(cfg.poolManager),           '",\n',
            '  "mockUSDC": "',        vm.toString(a.usdc),                    '",\n',
            '  "treasury": "',        vm.toString(a.treasury),                '",\n',
            '  "championPool": "',    vm.toString(a.championPool),            '",\n',
            '  "stadiumNFT": "',      vm.toString(a.nft),                     '",\n',
            '  "matchOracle": "',     vm.toString(a.oracle),                  '",\n',
            '  "convictionVault": "', vm.toString(a.convictionVault),         '",\n',
            '  "varMarket": "',       vm.toString(a.varMarket),               '",\n',
            '  "teamFactory": "',     vm.toString(a.teamFactory),             '",\n',
            '  "stadiumHook": ""',                                             '\n',
            '}'
        );
        vm.writeFile("./deployments.json", json);
        console.log("\nAddresses written to deployments.json");
        console.log("Next: run DeployHook.s.sol, then call teamFactory.setHook(hookAddress)");
    }

    function _logSummary(DeployConfig memory cfg, CoreAddresses memory a) internal view {
        console.log("\n=== STADIUM DEPLOYMENT SUMMARY ===");
        console.log("Deployer:        ", cfg.deployer);
        console.log("Treasury wallet: ", cfg.treasuryAddress);
        console.log("PoolManager:     ", cfg.poolManager, cfg.demoMode ? "[DEMO]" : "[OFFICIAL]");
        console.log("MockUSDC:        ", a.usdc);
        console.log("Treasury:        ", a.treasury);
        console.log("ChampionPool:    ", a.championPool);
        console.log("StadiumNFT:      ", a.nft);
        console.log("MatchOracle:     ", a.oracle);
        console.log("ConvictionVault: ", a.convictionVault);
        console.log("VARMarket:       ", a.varMarket);
        console.log("TeamFactory:     ", a.teamFactory);
        console.log("StadiumHook:      (deploy separately via DeployHook.s.sol)");
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    function _envAddressOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val == address(0) ? fallback_ : val;
        } catch {
            return fallback_;
        }
    }
}
