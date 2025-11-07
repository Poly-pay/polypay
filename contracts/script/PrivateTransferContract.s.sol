// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PrivateTransferContract} from "../src/PrivateTransferContract.sol";

contract ZkvVerifierContractScript is Script {
    PrivateTransferContract public privateTransferContract;

    function run() public {
        vm.startBroadcast();

        address zkvContract = vm.envAddress("ETH_ZKVERIFY_CONTRACT_ADDRESS");
        bytes32 vkHash = vm.envBytes32("VK_HASH");
        privateTransferContract = new PrivateTransferContract(zkvContract, vkHash);

        vm.stopBroadcast();
    }
}
