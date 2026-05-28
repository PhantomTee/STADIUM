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

            try hook.registerPool(key, teamId) {
                poolsCreated++;
            } catch {
                console.log("Hook registerPool failed for team", teamId);
            }
        }

        vm.stopBroadcast();

        console.log("Pools created and registered:", poolsCreated);
        console.log("\nUpdate frontend/.env:");
        console.log("VITE_TEAM_FACTORY_ADDRESS=%s", address(factory));
        console.log("\nUpdate frontend/src/config/deployments/xlayer.json:");
        console.log("\"teamFactory\": \"%s\"", address(factory));
    }

    // ── 48 World Cup 2026 teams ──────────────────────────────────────────────
    function _teams() internal pure returns (
        uint16[] memory ids,
        string[] memory names,
        string[] memory syms
    ) {
        ids   = new uint16[](48);
        names = new string[](48);
        syms  = new string[](48);

        // Group A
        ids[0]=1;  names[0]="Mexico";         syms[0]="MEX";
        ids[1]=2;  names[1]="South Africa";   syms[1]="RSA";
        ids[2]=3;  names[2]="South Korea";    syms[2]="KOR";
        ids[3]=4;  names[3]="Czechia";        syms[3]="CZE";
        // Group B
        ids[4]=5;  names[4]="Ecuador";        syms[4]="ECU";
        ids[5]=6;  names[5]="Hungary";        syms[5]="HUN";
        ids[6]=7;  names[6]="Saudi Arabia";   syms[6]="KSA";
        ids[7]=8;  names[7]="Senegal";        syms[7]="SEN";
        // Group C
        ids[8]=9;  names[8]="Canada";         syms[8]="CAN";
        ids[9]=10; names[9]="Morocco";        syms[9]="MAR";
        ids[10]=11;names[10]="Japan";         syms[10]="JPN";
        ids[11]=12;names[11]="Belgium";       syms[11]="BEL";
        // Group D
        ids[12]=13;names[12]="United States"; syms[12]="USA";
        ids[13]=14;names[13]="Cameroon";      syms[13]="CMR";
        ids[14]=15;names[14]="Serbia";        syms[14]="SRB";
        ids[15]=16;names[15]="Ukraine";       syms[15]="UKR";
        // Group E
        ids[16]=17;names[16]="Spain";         syms[16]="ESP";
        ids[17]=18;names[17]="Nigeria";       syms[17]="NGA";
        ids[18]=19;names[18]="Venezuela";     syms[18]="VEN";
        ids[19]=20;names[19]="Turkiye";       syms[19]="TUR";
        // Group F
        ids[20]=21;names[20]="Portugal";      syms[20]="POR";
        ids[21]=22;names[21]="Egypt";         syms[21]="EGY";
        ids[22]=23;names[22]="Switzerland";   syms[22]="SUI";
        ids[23]=24;names[23]="Ivory Coast";   syms[23]="CIV";
        // Group G
        ids[24]=25;names[24]="Germany";       syms[24]="GER";
        ids[25]=26;names[25]="Colombia";      syms[25]="COL";
        ids[26]=27;names[26]="Peru";          syms[26]="PER";
        ids[27]=28;names[27]="New Zealand";   syms[27]="NZL";
        // Group H
        ids[28]=29;names[28]="Uruguay";       syms[28]="URU";
        ids[29]=30;names[29]="Poland";        syms[29]="POL";
        ids[30]=31;names[30]="Iran";          syms[30]="IRI";
        ids[31]=32;names[31]="Qatar";         syms[31]="QAT";
        // Group I
        ids[32]=33;names[32]="Netherlands";   syms[32]="NED";
        ids[33]=34;names[33]="Cameroon";      syms[33]="ALG"; // Algeria
        ids[34]=35;names[34]="Australia";     syms[34]="AUS";
        ids[35]=36;names[35]="Hungary";       syms[35]="SLO"; // Slovenia
        // Group J
        ids[36]=37;names[36]="Argentina";     syms[36]="ARG";
        ids[37]=38;names[37]="Algeria";       syms[37]="DZA";
        ids[38]=39;names[38]="Austria";       syms[38]="AUT";
        ids[39]=40;names[39]="Jordan";        syms[39]="JOR";
        // Group K
        ids[40]=41;names[40]="France";        syms[40]="FRA";
        ids[41]=42;names[41]="Denmark";       syms[41]="DEN";
        ids[42]=43;names[42]="Ghana";         syms[42]="GHA";
        ids[43]=44;names[43]="Chile";         syms[43]="CHI";
        // Group L
        ids[44]=45;names[44]="Brazil";        syms[44]="BRA";
        ids[45]=46;names[45]="Paraguay";      syms[45]="PAR";
        ids[46]=47;names[46]="Croatia";       syms[46]="CRO";
        ids[47]=48;names[47]="Curacao";       syms[47]="CUR";
    }
}
