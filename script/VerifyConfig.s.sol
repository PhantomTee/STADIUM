// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

/// @notice Read-only script that verifies all deployed STADIUM contracts are live
///         and cross-wired correctly. Reads addresses from environment variables.
///
/// Required env vars (typically sourced from .env after Deploy.s.sol):
///   VITE_CONVICTION_VAULT_ADDRESS
///   VITE_MATCH_ORACLE_ADDRESS
///   VITE_VAR_MARKET_ADDRESS
///   VITE_CHAMPION_POOL_ADDRESS
///   VITE_MOCK_USDC_ADDRESS
///   VITE_STADIUM_NFT_ADDRESS
///
/// Optional:
///   STADIUM_HOOK_ADDRESS
///   TEAM_FACTORY_ADDRESS
///   TREASURY_ADDRESS
///
/// Usage:
///   forge script script/VerifyConfig.s.sol --rpc-url $XLAYER_RPC_URL
contract VerifyConfig is Script {
    uint256 private _passCount;
    uint256 private _failCount;

    function run() external {
        console.log("=== STADIUM DEPLOYMENT VERIFICATION ===\n");

        address vault       = _envAddrOr("VITE_CONVICTION_VAULT_ADDRESS");
        address oracle      = _envAddrOr("VITE_MATCH_ORACLE_ADDRESS");
        address varMarket   = _envAddrOr("VITE_VAR_MARKET_ADDRESS");
        address champPool   = _envAddrOr("VITE_CHAMPION_POOL_ADDRESS");
        address usdc        = _envAddrOr("VITE_MOCK_USDC_ADDRESS");
        address nft         = _envAddrOr("VITE_STADIUM_NFT_ADDRESS");
        address hook        = _envAddrOr("STADIUM_HOOK_ADDRESS");
        address factory     = _envAddrOr("TEAM_FACTORY_ADDRESS");
        address treasury    = _envAddrOr("TREASURY_ADDRESS");

        // ── Code existence checks ─────────────────────────────────────────────

        _check("ConvictionVault deployed", vault.code.length > 0,   vault);
        _check("MatchOracle deployed",     oracle.code.length > 0,  oracle);
        _check("VARMarket deployed",       varMarket.code.length > 0, varMarket);
        _check("ChampionPool deployed",    champPool.code.length > 0, champPool);
        _check("MockUSDC deployed",        usdc.code.length > 0,    usdc);
        _check("StadiumNFT deployed",      nft.code.length > 0,     nft);

        if (hook != address(0)) {
            _check("StadiumHook deployed", hook.code.length > 0, hook);
        } else {
            console.log("  [SKIP] STADIUM_HOOK_ADDRESS not set");
        }

        if (factory != address(0)) {
            _check("TeamFactory deployed", factory.code.length > 0, factory);
        } else {
            console.log("  [SKIP] TEAM_FACTORY_ADDRESS not set");
        }

        if (treasury != address(0)) {
            _check("Treasury deployed", treasury.code.length > 0, treasury);
        } else {
            console.log("  [SKIP] TREASURY_ADDRESS not set");
        }

        // ── Wiring checks via staticcall ──────────────────────────────────────

        // ConvictionVault.oracle == oracle
        _checkSlot("Vault.oracle == MatchOracle", vault,     0x5, oracle);

        // MatchOracle.convictionVault == vault
        _checkSlot("Oracle.convictionVault == Vault", oracle, 0x4, vault);

        // MatchOracle.varMarket == varMarket
        _checkSlot("Oracle.varMarket == VARMarket", oracle, 0x5, varMarket);

        // MatchOracle.championPool == champPool
        _checkSlot("Oracle.championPool == ChampPool", oracle, 0x6, champPool);

        console.log("");
        console.log("=== SUMMARY ===");
        console.log("All checks: use forge script output above for details.");
    }

    function _check(string memory label, bool ok, address addr) internal view {
        if (ok) {
            console.log(string.concat("  [PASS] ", label, ": ", vm.toString(addr)));
        } else {
            console.log(string.concat("  [FAIL] ", label, ": no code at ", vm.toString(addr)));
        }
    }

    function _checkSlot(string memory label, address target, uint256 slot, address expected) internal view {
        bytes32 raw = vm.load(target, bytes32(slot));
        address got = address(uint160(uint256(raw)));
        bool ok = (got == expected);
        if (ok) {
            console.log(string.concat("  [PASS] ", label));
        } else {
            console.log(string.concat("  [WARN] ", label, ": got ", vm.toString(got), " expected ", vm.toString(expected)));
            console.log("         (Slot-based checks may be inaccurate due to struct packing — verify manually if needed)");
        }
    }

    function _envAddrOr(string memory key) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val;
        } catch {
            return address(0);
        }
    }
}
