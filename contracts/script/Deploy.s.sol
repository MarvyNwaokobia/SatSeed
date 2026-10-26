// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GardenRegistry} from "../src/GardenRegistry.sol";
import {GardenTips} from "../src/GardenTips.sol";

/// @notice Deploys GardenRegistry and GardenTips.
/// @dev MUSD_ADDRESS must be set. Mainnet 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,
///      testnet 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 (re-verify before use).
///      Dry run:  forge script script/Deploy.s.sol --rpc-url mezo_testnet
///      Broadcasting is a separate, deliberate step (--broadcast).
contract Deploy is Script {
    function run() external returns (GardenRegistry registry, GardenTips tips) {
        address musd = vm.envAddress("MUSD_ADDRESS");

        vm.startBroadcast();
        registry = new GardenRegistry();
        tips = new GardenTips(IERC20(musd), registry);
        vm.stopBroadcast();

        console.log("GardenRegistry:", address(registry));
        console.log("GardenTips:", address(tips));
    }
}
