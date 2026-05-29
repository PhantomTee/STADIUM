// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

interface ITeamFactory {
    function registerTeam(uint16 teamId, string calldata name, string calldata symbol) external;
    function createTeamPool(uint16 teamId, int24 tickSpacing, uint160 sqrtPriceX96) external;
    function setHook(address hook) external;
    function teamToken(uint16 teamId) external view returns (address);
    function teamPoolId(uint16 teamId) external view returns (bytes32);
    function usdc() external view returns (address);
    function hook() external view returns (address);
}

interface IStadiumHook {
    function registerPool(PoolKey calldata key, uint16 teamId) external;
}

/// @notice Registers all 48 World Cup 2026 teams in TeamFactory and creates their Uniswap V4 pools.
///
/// Required env vars:
///   PRIVATE_KEY              - deployer private key
///   TEAM_FACTORY_ADDRESS     - deployed TeamFactory address
///
/// Optional:
///   STADIUM_HOOK_ADDRESS     - if set, updates the factory hook before pool creation
///
/// Team source of truth: config/teams.json and frontend/src/utils/contracts.js.
/// teamId values 1-48 here MUST match the id field in contracts.js WORLD_CUP_TEAMS.
///
/// Usage:
///   forge script script/CreatePools.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract CreatePools is Script {
    // Target display price: 0.01 USDC per team token (100 tokens per USDC).
    // USDC (6 dec) and team tokens (18 dec) have a 12-order decimal gap, so the
    // correct sqrtPriceX96 depends on which token sorts lower (becomes currency0).
    //
    // When USDC is currency0 (usdcAddr < tokenAddr):
    //   P_raw(C1/C0) = (100 × 1e18 raw team) / 1e6 raw USDC = 1e14
    //   sqrtPriceX96 = sqrt(1e14) × 2^96 = 1e7 × 2^96
    uint160 constant SQRT_PRICE_USDC_C0 = 792281625142643375935439503360000000;

    // When team token is currency0 (tokenAddr < usdcAddr):
    //   P_raw(C1/C0) = 1e4 raw USDC / 1e18 raw team = 1e-14
    //   sqrtPriceX96 = sqrt(1e-14) × 2^96 = 2^96 / 1e7
    uint160 constant SQRT_PRICE_TEAM_C0 = 7922816251426433759354;

    int24 constant TICK_SPACING = 60;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("TEAM_FACTORY_ADDRESS");
        require(factoryAddr != address(0), "CreatePools: TEAM_FACTORY_ADDRESS not set");

        ITeamFactory factory = ITeamFactory(factoryAddr);
        address hookAddr = _envAddressOr("STADIUM_HOOK_ADDRESS", address(0));

        (uint16[] memory ids, string[] memory names, string[] memory syms) = _teams();

        vm.startBroadcast(deployerKey);

        if (hookAddr != address(0)) {
            factory.setHook(hookAddr);
            console.log("Hook updated:", hookAddr);
        }

        for (uint256 i = 0; i < ids.length; i++) {
            _registerTeam(factory, ids[i], names[i], syms[i]);
        }

        if (hookAddr != address(0)) {
            address usdcAddr = factory.usdc();
            for (uint256 i = 0; i < ids.length; i++) {
                _createPool(factory, ids[i], names[i], usdcAddr, hookAddr);
            }
            console.log("Created V4 pools for all 48 teams");
        } else {
            console.log("Skipped pool creation - STADIUM_HOOK_ADDRESS not set");
            console.log("Set the hook and call createTeamPool() for each team manually.");
        }

        vm.stopBroadcast();

        console.log("\n=== TEAM REGISTRATION SUMMARY ===");
        console.log("TeamFactory:", factoryAddr);
        console.log("Teams registered: 48 (World Cup 2026, ids 1-48)");

        if (hookAddr != address(0)) {
            _writePoolManifest(factory, hookAddr, ids, names, syms);
        }
    }

    // -- Team list (ids 1-48, Groups A-L) -----------------------------------------
    // Keep in sync with config/teams.json and frontend/src/utils/contracts.js.
    // Non-ASCII names (Turkiye, Curacao) are ASCII-approximated here only.

    function _teams() internal pure returns (
        uint16[] memory ids,
        string[] memory names,
        string[] memory syms
    ) {
        ids   = new uint16[](48);
        names = new string[](48);
        syms  = new string[](48);

        // Group A
        ids[0]=1;  names[0]="Mexico";        syms[0]="MEX";
        ids[1]=2;  names[1]="South Africa";  syms[1]="RSA";
        ids[2]=3;  names[2]="South Korea";   syms[2]="KOR";
        ids[3]=4;  names[3]="Czechia";       syms[3]="CZE";

        // Group B
        ids[4]=5;  names[4]="Canada";        syms[4]="CAN";
        ids[5]=6;  names[5]="Bosnia";        syms[5]="BIH";
        ids[6]=7;  names[6]="Qatar";         syms[6]="QAT";
        ids[7]=8;  names[7]="Switzerland";   syms[7]="SUI";

        // Group C
        ids[8]=9;  names[8]="Brazil";        syms[8]="BRA";
        ids[9]=10; names[9]="Morocco";       syms[9]="MAR";
        ids[10]=11; names[10]="Haiti";       syms[10]="HAI";
        ids[11]=12; names[11]="Scotland";    syms[11]="SCO";

        // Group D
        ids[12]=13; names[12]="USA";         syms[12]="USA";
        ids[13]=14; names[13]="Paraguay";    syms[13]="PAR";
        ids[14]=15; names[14]="Australia";   syms[14]="AUS";
        ids[15]=16; names[15]="Turkiye";     syms[15]="TUR";

        // Group E
        ids[16]=17; names[16]="Germany";     syms[16]="GER";
        ids[17]=18; names[17]="Curacao";     syms[17]="CUW";
        ids[18]=19; names[18]="Ivory Coast"; syms[18]="CIV";
        ids[19]=20; names[19]="Ecuador";     syms[19]="ECU";

        // Group F
        ids[20]=21; names[20]="Netherlands"; syms[20]="NED";
        ids[21]=22; names[21]="Japan";       syms[21]="JPN";
        ids[22]=23; names[22]="Sweden";      syms[22]="SWE";
        ids[23]=24; names[23]="Tunisia";     syms[23]="TUN";

        // Group G
        ids[24]=25; names[24]="Belgium";     syms[24]="BEL";
        ids[25]=26; names[25]="Egypt";       syms[25]="EGY";
        ids[26]=27; names[26]="Iran";        syms[26]="IRN";
        ids[27]=28; names[27]="New Zealand"; syms[27]="NZL";

        // Group H
        ids[28]=29; names[28]="Spain";       syms[28]="ESP";
        ids[29]=30; names[29]="Cape Verde";  syms[29]="CPV";
        ids[30]=31; names[30]="Saudi Arabia";syms[30]="KSA";
        ids[31]=32; names[31]="Uruguay";     syms[31]="URU";

        // Group I
        ids[32]=33; names[32]="France";      syms[32]="FRA";
        ids[33]=34; names[33]="Senegal";     syms[33]="SEN";
        ids[34]=35; names[34]="Iraq";         syms[34]="IRQ";
        ids[35]=36; names[35]="Norway";      syms[35]="NOR";

        // Group J
        ids[36]=37; names[36]="Argentina";   syms[36]="ARG";
        ids[37]=38; names[37]="Algeria";     syms[37]="ALG";
        ids[38]=39; names[38]="Austria";     syms[38]="AUT";
        ids[39]=40; names[39]="Jordan";      syms[39]="JOR";

        // Group K
        ids[40]=41; names[40]="Portugal";    syms[40]="POR";
        ids[41]=42; names[41]="Congo DR";     syms[41]="COD";
        ids[42]=43; names[42]="Uzbekistan";  syms[42]="UZB";
        ids[43]=44; names[43]="Colombia";    syms[43]="COL";

        // Group L
        ids[44]=45; names[44]="England";     syms[44]="ENG";
        ids[45]=46; names[45]="Croatia";     syms[45]="CRO";
        ids[46]=47; names[46]="Ghana";       syms[46]="GHA";
        ids[47]=48; names[47]="Panama";      syms[47]="PAN";
    }

    // -- Helpers -------------------------------------------------------------------

    function _registerTeam(ITeamFactory factory, uint16 teamId, string memory name, string memory symbol) internal {
        try factory.registerTeam(teamId, name, symbol) {
            address token = factory.teamToken(teamId);
            console.log(string.concat("Registered ", name, " (", symbol, ")"), token);
        } catch {
            console.log(string.concat("Skipped ", name, " - already registered"));
        }
    }

    function _createPool(
        ITeamFactory factory,
        uint16 teamId,
        string memory name,
        address usdcAddr,
        address hookAddr
    ) internal {
        // Get token address first so we can determine sort order and pick the correct sqrtPriceX96.
        address token = factory.teamToken(teamId);
        if (token == address(0)) {
            console.log(string.concat("No token for team - skipping pool creation: ", name));
            return;
        }

        bool usdcIsC0 = usdcAddr < token;
        uint160 sqrtPriceX96 = usdcIsC0 ? SQRT_PRICE_USDC_C0 : SQRT_PRICE_TEAM_C0;

        try factory.createTeamPool(teamId, TICK_SPACING, sqrtPriceX96) {
            bytes32 pid = factory.teamPoolId(teamId);
            console.log(string.concat("Pool created: ", name), vm.toString(pid));
        } catch {
            console.log(string.concat("Pool creation failed (may already exist): ", name));
        }

        // Register the pool in StadiumHook so beforeSwap doesn't revert PoolNotRegistered.
        (Currency c0, Currency c1) = usdcIsC0
            ? (Currency.wrap(usdcAddr), Currency.wrap(token))
            : (Currency.wrap(token),    Currency.wrap(usdcAddr));

        PoolKey memory key = PoolKey({
            currency0:   c0,
            currency1:   c1,
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks:       IHooks(hookAddr)
        });

        try IStadiumHook(hookAddr).registerPool(key, teamId) {
            console.log(string.concat("Hook pool registered: ", name));
        } catch {
            console.log(string.concat("registerPool failed (may already be registered): ", name));
        }
    }

    function _writePoolManifest(
        ITeamFactory factory,
        address hookAddr,
        uint16[] memory ids,
        string[] memory names,
        string[] memory syms
    ) internal {
        // Split into two concat calls to stay within the 16-slot Yul stack limit
        string memory header = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "hook": "',   vm.toString(hookAddr), '",\n'
        );
        header = string.concat(
            header,
            '  "tickSpacing": ', vm.toString(uint256(uint24(int24(TICK_SPACING)))),
            ',\n  "sqrtPriceX96": "', vm.toString(uint256(SQRT_PRICE_1_1)),
            '",\n  "pools": [\n'
        );

        bytes memory entries;
        for (uint256 i = 0; i < ids.length; i++) {
            bool comma = (i < ids.length - 1);
            entries = abi.encodePacked(entries, _poolEntry(factory, ids[i], names[i], syms[i], comma));
        }

        vm.writeFile("./v4-pools.json", string.concat(header, string(entries), '  ]\n}'));
        console.log("\nV4 pool manifest written to v4-pools.json");
        console.log("Copy pool IDs into frontend config for the V4 Hook Engine card.");
    }

    function _poolEntry(
        ITeamFactory factory,
        uint16 teamId,
        string memory name,
        string memory symbol,
        bool comma
    ) internal view returns (string memory) {
        bytes32 pid   = factory.teamPoolId(teamId);
        address token = factory.teamToken(teamId);
        // Split into two concat calls to stay within the 16-slot Yul stack limit
        string memory entry = string.concat(
            '    {"teamId":', vm.toString(uint256(teamId)),
            ',"name":"', name, '","symbol":"', symbol, '"'
        );
        entry = string.concat(
            entry,
            ',"token":"', vm.toString(token),
            '","poolId":"', vm.toString(pid), '"}'
        );
        return comma ? string.concat(entry, ',\n') : string.concat(entry, '\n');
    }

    function _envAddressOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val == address(0) ? fallback_ : val;
        } catch {
            return fallback_;
        }
    }
}
