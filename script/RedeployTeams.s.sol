// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TeamFactory} from "../src/TeamFactory.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

interface IStadiumHook {
    function registerPool(PoolKey calldata key, uint16 teamId) external;
}

/// @notice Deploys a fresh TeamFactory, registers all 48 teams, creates V4 pools
///         at the CORRECT sqrtPrice (1 USDC display = 1 team token display),
///         and registers each pool in StadiumHook.
///
/// Required env vars:
///   PRIVATE_KEY            — deployer (must own StadiumHook)
///   POOL_MANAGER_ADDRESS   — PoolManager (from deployments config)
///   MOCK_USDC_ADDRESS      — MockUSDC
///   STADIUM_HOOK_ADDRESS   — StadiumHook
///
/// Usage:
///   forge script script/RedeployTeams.s.sol \
///     --rpc-url $XLAYER_RPC_URL --broadcast
///
/// After running: update VITE_TEAM_FACTORY_ADDRESS in frontend/.env
/// and in frontend/src/config/deployments/xlayer.json.
contract RedeployTeams is Script {
    int24  constant TICK_SPACING = 60;

    // sqrtPriceX96 for 1 display USDC = 1 display team token.
    //
    // Team token has 18 decimals, USDC has 6 decimals. Which is currency0 depends
    // on the address sort order (V4 requires currency0 < currency1 by address).
    //
    // Case A: USDC (6 dec) is currency0, team token (18 dec) is currency1
    //   price_raw = teamToken_raw / USDC_raw = 1e18 / 1e6 = 1e12
    //   sqrtPrice = sqrt(1e12) * 2^96 = 1e6 * 2^96
    //
    // Case B: team token (18 dec) is currency0, USDC (6 dec) is currency1
    //   price_raw = USDC_raw / teamToken_raw = 1e6 / 1e18 = 1e-12
    //   sqrtPrice = sqrt(1e-12) * 2^96 = 2^96 / 1e6
    //
    uint160 constant SQRT_PRICE_USDC_C0   = 79228162514264337593543950336000000; // 1e6 * 2^96
    uint160 constant SQRT_PRICE_TOKEN_C0  = 79228162514264337593544;              // 2^96 / 1e6  (≈ tick -276310)

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address poolMgr     = vm.envAddress("POOL_MANAGER_ADDRESS");
        address usdc        = vm.envAddress("MOCK_USDC_ADDRESS");
        address hookAddr    = vm.envAddress("STADIUM_HOOK_ADDRESS");

        address deployer = vm.addr(deployerKey);
        IStadiumHook hook = IStadiumHook(hookAddr);

        vm.startBroadcast(deployerKey);

        // ── Deploy new TeamFactory ──────────────────────────────────────────
        TeamFactory factory = new TeamFactory(poolMgr, usdc, hookAddr, deployer);
        console.log("TeamFactory deployed at:", address(factory));

        // ── Register 48 teams ──────────────────────────────────────────────
        (uint16[] memory ids, string[] memory names, string[] memory syms) = _teams();
        for (uint256 i = 0; i < ids.length; i++) {
            factory.registerTeam(ids[i], names[i], syms[i]);
        }
        console.log("Registered 48 teams");

        // ── Create pools at correct price + register in hook ───────────────
        uint256 poolsCreated = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            uint16  teamId = ids[i];
            address token  = factory.teamToken(teamId);

            uint160 sqrtPrice = usdc < token ? SQRT_PRICE_USDC_C0 : SQRT_PRICE_TOKEN_C0;
            factory.createTeamPool(teamId, TICK_SPACING, sqrtPrice);

            (Currency c0, Currency c1) = usdc < token
                ? (Currency.wrap(usdc),  Currency.wrap(token))
                : (Currency.wrap(token), Currency.wrap(usdc));

            PoolKey memory key = PoolKey({
                currency0:   c0,
                currency1:   c1,
                fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
                tickSpacing: TICK_SPACING,
                hooks:       IHooks(hookAddr)
            });

            hook.registerPool(key, teamId);
            poolsCreated++;
        }

        vm.stopBroadcast();

        console.log("Pools created and registered:", poolsCreated);
        console.log("\nUpdate frontend/.env:");
        console.log("VITE_TEAM_FACTORY_ADDRESS=%s", address(factory));
        console.log("\nUpdate frontend/src/config/deployments/xlayer.json:");
        console.log("\"teamFactory\": \"%s\"", address(factory));
    }

    // ── 48 World Cup 2026 teams — IDs MUST match contracts.js WORLD_CUP_TEAMS ─
    function _teams() internal pure returns (
        uint16[] memory ids,
        string[] memory names,
        string[] memory syms
    ) {
        ids   = new uint16[](48);
        names = new string[](48);
        syms  = new string[](48);

        // Group A — must match contracts.js WORLD_CUP_TEAMS exactly
        ids[0]=1;  names[0]="Mexico";         syms[0]="MEX";
        ids[1]=2;  names[1]="South Africa";   syms[1]="RSA";
        ids[2]=3;  names[2]="South Korea";    syms[2]="KOR";
        ids[3]=4;  names[3]="Czechia";        syms[3]="CZE";
        // Group B
        ids[4]=5;  names[4]="Canada";         syms[4]="CAN";
        ids[5]=6;  names[5]="Bosnia & Herz";  syms[5]="BIH";
        ids[6]=7;  names[6]="Qatar";          syms[6]="QAT";
        ids[7]=8;  names[7]="Switzerland";    syms[7]="SUI";
        // Group C
        ids[8]=9;  names[8]="Brazil";         syms[8]="BRA";
        ids[9]=10; names[9]="Morocco";        syms[9]="MAR";
        ids[10]=11;names[10]="Haiti";         syms[10]="HAI";
        ids[11]=12;names[11]="Scotland";      syms[11]="SCO";
        // Group D
        ids[12]=13;names[12]="USA";           syms[12]="USA";
        ids[13]=14;names[13]="Paraguay";      syms[13]="PAR";
        ids[14]=15;names[14]="Australia";     syms[14]="AUS";
        ids[15]=16;names[15]="Turkiye";       syms[15]="TUR";
        // Group E
        ids[16]=17;names[16]="Germany";       syms[16]="GER";
        ids[17]=18;names[17]="Curacao";       syms[17]="CUW";
        ids[18]=19;names[18]="Ivory Coast";   syms[18]="CIV";
        ids[19]=20;names[19]="Ecuador";       syms[19]="ECU";
        // Group F
        ids[20]=21;names[20]="Netherlands";   syms[20]="NED";
        ids[21]=22;names[21]="Japan";         syms[21]="JPN";
        ids[22]=23;names[22]="Sweden";        syms[22]="SWE";
        ids[23]=24;names[23]="Tunisia";       syms[23]="TUN";
        // Group G
        ids[24]=25;names[24]="Belgium";       syms[24]="BEL";
        ids[25]=26;names[25]="Egypt";         syms[25]="EGY";
        ids[26]=27;names[26]="Iran";          syms[26]="IRN";
        ids[27]=28;names[27]="New Zealand";   syms[27]="NZL";
        // Group H
        ids[28]=29;names[28]="Spain";         syms[28]="ESP";
        ids[29]=30;names[29]="Cape Verde";    syms[29]="CPV";
        ids[30]=31;names[30]="Saudi Arabia";  syms[30]="KSA";
        ids[31]=32;names[31]="Uruguay";       syms[31]="URU";
        // Group I
        ids[32]=33;names[32]="France";        syms[32]="FRA";
        ids[33]=34;names[33]="Senegal";       syms[33]="SEN";
        ids[34]=35;names[34]="Iraq";          syms[34]="IRQ";
        ids[35]=36;names[35]="Norway";        syms[35]="NOR";
        // Group J
        ids[36]=37;names[36]="Argentina";     syms[36]="ARG";
        ids[37]=38;names[37]="Algeria";       syms[37]="ALG";
        ids[38]=39;names[38]="Austria";       syms[38]="AUT";
        ids[39]=40;names[39]="Jordan";        syms[39]="JOR";
        // Group K
        ids[40]=41;names[40]="Portugal";      syms[40]="POR";
        ids[41]=42;names[41]="Congo DR";      syms[41]="COD";
        ids[42]=43;names[42]="Uzbekistan";    syms[42]="UZB";
        ids[43]=44;names[43]="Colombia";      syms[43]="COL";
        // Group L
        ids[44]=45;names[44]="England";       syms[44]="ENG";
        ids[45]=46;names[45]="Croatia";       syms[45]="CRO";
        ids[46]=47;names[46]="Ghana";         syms[46]="GHA";
        ids[47]=48;names[47]="Panama";        syms[47]="PAN";
    }
}
