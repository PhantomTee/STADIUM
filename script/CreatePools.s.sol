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

/// @notice Registers all 48 World Cup 2026 teams in TeamFactory and creates their Uniswap V4 pools.
///
/// Required env vars:
///   PRIVATE_KEY              - deployer private key
///   TEAM_FACTORY_ADDRESS     - deployed TeamFactory address
///
/// Optional:
///   STADIUM_HOOK_ADDRESS     - if set, updates the factory hook before pool creation
///
/// Team source of truth: config/teams.json (keep in sync with _teams() below).
/// Placeholder entries (isPlaceholder=true in JSON) are registered on-chain but pools
/// for them will be skipped until the real team name/code is back-filled.
///
/// Usage:
///   forge script script/CreatePools.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
contract CreatePools is Script {
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24   constant TICK_SPACING   = 60;

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
            for (uint256 i = 0; i < ids.length; i++) {
                _createPool(factory, ids[i], names[i]);
            }
            console.log("Created V4 pools for all 48 teams");
        } else {
            console.log("Skipped pool creation - STADIUM_HOOK_ADDRESS not set");
            console.log("Set the hook and call createTeamPool() for each team manually.");
        }

        vm.stopBroadcast();

        console.log("\n=== TEAM REGISTRATION SUMMARY ===");
        console.log("TeamFactory:", factoryAddr);
        console.log("Teams registered: 48 (World Cup 2026)");

        if (hookAddr != address(0)) {
            _writePoolManifest(factory, hookAddr, ids, names, syms);
        }
    }

    // ── Team list ─────────────────────────────────────────────────────────────
    // Source of truth: config/teams.json — update both files together.
    // isPlaceholder entries (UEFA Playoff 1-4, IC Playoff Winner 1-2) must be
    // replaced with confirmed team names once the draw is finalised.

    function _teams() internal pure returns (
        uint16[] memory ids,
        string[] memory names,
        string[] memory syms
    ) {
        ids   = new uint16[](48);
        names = new string[](48);
        syms  = new string[](48);

        // CONMEBOL (6)
        ids[0]=9;   names[0]="Brazil";          syms[0]="BRA";
        ids[1]=37;  names[1]="Argentina";        syms[1]="ARG";
        ids[2]=5;   names[2]="Uruguay";          syms[2]="URU";
        ids[3]=6;   names[3]="Colombia";         syms[3]="COL";
        ids[4]=7;   names[4]="Ecuador";          syms[4]="ECU";
        ids[5]=8;   names[5]="Paraguay";         syms[5]="PAR";

        // CONCACAF (6 - USA/Mexico/Canada are hosts)
        ids[6]=1;   names[6]="Mexico";           syms[6]="MEX";
        ids[7]=2;   names[7]="USA";              syms[7]="USA";
        ids[8]=4;   names[8]="Canada";           syms[8]="CAN";
        ids[9]=47;  names[9]="Panama";           syms[9]="PAN";
        ids[10]=46; names[10]="Curacao";         syms[10]="CUW";
        ids[11]=48; names[11]="Haiti";           syms[11]="HAI";

        // UEFA direct qualifiers (12)
        ids[12]=10; names[12]="Spain";           syms[12]="ESP";
        ids[13]=26; names[13]="Germany";         syms[13]="GER";
        ids[14]=33; names[14]="France";          syms[14]="FRA";
        ids[15]=45; names[15]="England";         syms[15]="ENG";
        ids[16]=11; names[16]="Portugal";        syms[16]="POR";
        ids[17]=12; names[17]="Netherlands";     syms[17]="NED";
        ids[18]=13; names[18]="Belgium";         syms[18]="BEL";
        ids[19]=14; names[19]="Croatia";         syms[19]="CRO";
        ids[20]=15; names[20]="Norway";          syms[20]="NOR";
        ids[21]=17; names[21]="Austria";         syms[21]="AUT";
        ids[22]=18; names[22]="Switzerland";     syms[22]="SUI";
        ids[23]=19; names[23]="Scotland";        syms[23]="SCO";

        // UEFA playoff winners (4) - isPlaceholder; replace when confirmed
        ids[24]=60; names[24]="UEFA Playoff 1";  syms[24]="UP1";
        ids[25]=61; names[25]="UEFA Playoff 2";  syms[25]="UP2";
        ids[26]=62; names[26]="UEFA Playoff 3";  syms[26]="UP3";
        ids[27]=63; names[27]="UEFA Playoff 4";  syms[27]="UP4";

        // AFC (8)
        ids[28]=3;  names[28]="South Korea";     syms[28]="KOR";
        ids[29]=27; names[29]="Japan";           syms[29]="JPN";
        ids[30]=28; names[30]="Iran";            syms[30]="IRN";
        ids[31]=29; names[31]="Saudi Arabia";    syms[31]="KSA";
        ids[32]=30; names[32]="Australia";       syms[32]="AUS";
        ids[33]=31; names[33]="Uzbekistan";      syms[33]="UZB";
        ids[34]=32; names[34]="Jordan";          syms[34]="JOR";
        ids[35]=34; names[35]="Qatar";           syms[35]="QAT";

        // CAF (9)
        ids[36]=35; names[36]="Morocco";         syms[36]="MAR";
        ids[37]=36; names[37]="Senegal";         syms[37]="SEN";
        ids[38]=38; names[38]="Egypt";           syms[38]="EGY";
        ids[39]=39; names[39]="Ghana";           syms[39]="GHA";
        ids[40]=40; names[40]="South Africa";    syms[40]="RSA";
        ids[41]=41; names[41]="Ivory Coast";     syms[41]="CIV";
        ids[42]=42; names[42]="Algeria";         syms[42]="ALG";
        ids[43]=43; names[43]="Tunisia";         syms[43]="TUN";
        ids[44]=44; names[44]="Cape Verde";      syms[44]="CPV";

        // OFC (1)
        ids[45]=49; names[45]="New Zealand";     syms[45]="NZL";

        // Inter-confederation playoff winners (2) - isPlaceholder; replace when confirmed
        ids[46]=64; names[46]="IC Playoff Winner 1"; syms[46]="IP1";
        ids[47]=65; names[47]="IC Playoff Winner 2"; syms[47]="IP2";
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _registerTeam(ITeamFactory factory, uint16 teamId, string memory name, string memory symbol) internal {
        try factory.registerTeam(teamId, name, symbol) {
            address token = factory.teamToken(teamId);
            console.log(string.concat("Registered ", name, " (", symbol, ")"), token);
        } catch {
            console.log(string.concat("Skipped ", name, " - already registered"));
        }
    }

    function _createPool(ITeamFactory factory, uint16 teamId, string memory name) internal {
        try factory.createTeamPool(teamId, TICK_SPACING, SQRT_PRICE_1_1) {
            bytes32 pid = factory.teamPoolId(teamId);
            console.log(string.concat("Pool created: ", name), vm.toString(pid));
        } catch {
            console.log(string.concat("Pool creation failed: ", name));
        }
    }

    function _writePoolManifest(
        ITeamFactory factory,
        address hookAddr,
        uint16[] memory ids,
        string[] memory names,
        string[] memory syms
    ) internal {
        string memory header = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "hook": "', vm.toString(hookAddr), '",\n',
            '  "tickSpacing": ', vm.toString(uint256(uint24(int24(TICK_SPACING)))), ',\n',
            '  "sqrtPriceX96": "', vm.toString(uint256(SQRT_PRICE_1_1)), '",\n',
            '  "pools": [\n'
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
        string memory entry = string.concat(
            '    {"teamId":', vm.toString(uint256(teamId)),
            ',"name":"', name,
            '","symbol":"', symbol,
            '","token":"', vm.toString(token),
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
