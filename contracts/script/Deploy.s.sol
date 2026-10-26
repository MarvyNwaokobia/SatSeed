// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SatSeedRegistry} from "../src/SatSeedRegistry.sol";
import {SatSeedTips} from "../src/SatSeedTips.sol";

/// @notice Deploys SatSeedRegistry and SatSeedTips.
/// @dev MUSD_ADDRESS must be set. MIN_TIP (base units, 18 decimals) defaults to 0.1 MUSD. Mainnet 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,
///      testnet 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 (re-verify before use).
///      Dry run:  forge script script/Deploy.s.sol --rpc-url mezo_testnet
///      Broadcasting is a separate, deliberate step (--broadcast).
contract Deploy is Script {
    function run() external returns (SatSeedRegistry registry, SatSeedTips tips) {
        address musd = vm.envAddress("MUSD_ADDRESS");
        uint256 minTip = vm.envOr("MIN_TIP", uint256(0.1 ether));

        vm.startBroadcast();
        registry = new SatSeedRegistry();
        tips = new SatSeedTips(IERC20(musd), registry, minTip);
        vm.stopBroadcast();

        console.log("SatSeedRegistry:", address(registry));
        console.log("SatSeedTips:", address(tips));
    }
}
