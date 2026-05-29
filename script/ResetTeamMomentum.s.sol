// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StadiumHook} from "../src/StadiumHook.sol";

/// @notice Admin script to set (or zero-out) a team's momentum score on an
///         already-deployed StadiumHook.
///
/// Required env vars:
///   PRIVATE_KEY           -- hook owner's key
///   STADIUM_HOOK_ADDRESS  -- deployed StadiumHook address
///   TEAM_ID               -- uint16 team ID to update (default: 0 = all below)
///   MOMENTUM_VALUE        -- new value in USDC raw units (default: 0 = reset)
///
/// Usage (reset South Africa teamId=2):
///   TEAM_ID=2 MOMENTUM_VALUE=0 forge script script/ResetTeamMomentum.s.sol \
///     --rpc-url $RPC_URL --broadcast --slow
contract ResetTeamMomentum is Script {
    function run() external {
        uint256 key      = vm.envUint("PRIVATE_KEY");
        address hookAddr = vm.envAddress("STADIUM_HOOK_ADDRESS");
        uint16  teamId   = uint16(vm.envOr("TEAM_ID", uint256(2)));
        uint256 value    = vm.envOr("MOMENTUM_VALUE", uint256(0));

        require(hookAddr != address(0), "ResetTeamMomentum: STADIUM_HOOK_ADDRESS not set");

        StadiumHook hook = StadiumHook(hookAddr);

        console.log("Hook:         ", hookAddr);
        console.log("Team ID:      ", teamId);
        console.log("Old momentum: ", hook.teamMomentum(teamId));
        console.log("New value:    ", value);

        vm.broadcast(key);
        hook.setTeamMomentum(teamId, value);

        console.log("Done - teamMomentum =", hook.teamMomentum(teamId));
    }
}
