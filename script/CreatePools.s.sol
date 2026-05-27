// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

interface ITeamFactory {
    function registerTeam(uint16 teamId, string calldata name, string calldata symbol) external;
    function createTeamPool(uint16 teamId, int24 tickSpacing, uint160 sqrtPriceX96) external;
    function setHook(address hook) external;
    function teamToken(uint16 teamId) external view returns (address);
    function teamPoolId(uint16 teamId) external view returns (bytes32);
}

/// @notice Registers demo teams in TeamFactory and creates their Uniswap V4 pools.
///
/// Required env vars:
///   PRIVATE_KEY              — deployer private key
///   TEAM_FACTORY_ADDRESS     — deployed TeamFactory address
///
/// Optional:
///   STADIUM_HOOK_ADDRESS     — if set, updates the factory hook before pool creation
///
/// Usage:
///   forge script script/CreatePools.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract CreatePools is Script {
    // 1:1 initial price (token0/token1 = 1)
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24   constant TICK_SPACING   = 60;

    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address factoryAddr  = vm.envAddress("TEAM_FACTORY_ADDRESS");
        require(factoryAddr != address(0), "CreatePools: TEAM_FACTORY_ADDRESS not set");

        ITeamFactory factory = ITeamFactory(factoryAddr);

        // Optional: update hook address before creating pools
        address hookAddr = _envAddressOr("STADIUM_HOOK_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        if (hookAddr != address(0)) {
            factory.setHook(hookAddr);
            console.log("Hook updated:", hookAddr);
        }

        // ── Register teams ─────────────────────────────────────────────────────

        // World Cup 2026 demo teams
        _registerTeam(factory, 37, "Argentina", "ARG");
        _registerTeam(factory, 33, "France",    "FRA");
        _registerTeam(factory, 9,  "Brazil",    "BRA");
        _registerTeam(factory, 45, "England",   "ENG");
        _registerTeam(factory, 1,  "Mexico",    "MEX");
        _registerTeam(factory, 3,  "South Korea", "KOR");
        _registerTeam(factory, 26, "Germany",   "GER");
        _registerTeam(factory, 10, "Spain",     "ESP");

        // ── Create V4 pools (requires hook to be set) ─────────────────────────

        if (hookAddr != address(0)) {
            _createPool(factory, 37);
            _createPool(factory, 33);
            _createPool(factory, 9);
            _createPool(factory, 45);
            _createPool(factory, 1);
            _createPool(factory, 3);
            _createPool(factory, 26);
            _createPool(factory, 10);
            console.log("Created V4 pools for all 8 teams");
        } else {
            console.log("Skipped pool creation — STADIUM_HOOK_ADDRESS not set");
            console.log("Set the hook and call createTeamPool() for each team manually.");
        }

        vm.stopBroadcast();

        console.log("\n=== TEAM REGISTRATION SUMMARY ===");
        console.log("TeamFactory:", factoryAddr);
        console.log("Teams registered: Argentina(37), France(33), Brazil(9), England(45)");
        console.log("                  Mexico(1), South Korea(3), Germany(26), Spain(10)");
    }

    function _registerTeam(ITeamFactory factory, uint16 teamId, string memory name, string memory symbol) internal {
        try factory.registerTeam(teamId, name, symbol) {
            address token = factory.teamToken(teamId);
            console.log(string.concat("Registered ", name, " (", symbol, ")"), token);
        } catch {
            console.log(string.concat("Skipped ", name, " — already registered"));
        }
    }

    function _createPool(ITeamFactory factory, uint16 teamId) internal {
        try factory.createTeamPool(teamId, TICK_SPACING, SQRT_PRICE_1_1) {
            bytes32 pid = factory.teamPoolId(teamId);
            console.log(string.concat("Pool created for teamId=", vm.toString(uint256(teamId))));
            console.log("  poolId:", vm.toString(pid));
        } catch {
            console.log(string.concat("Pool creation failed for teamId=", vm.toString(uint256(teamId))));
        }
    }

    function _envAddressOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val == address(0) ? fallback_ : val;
        } catch {
            return fallback_;
        }
    }
}
