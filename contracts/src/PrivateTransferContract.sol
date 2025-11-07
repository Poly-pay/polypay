// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IVerifyProofAggregation {
    function verifyProofAggregation(
        uint256 _domainId,
        uint256 _aggregationId,
        bytes32 _leaf,
        bytes32[] calldata _merklePath,
        uint256 _leafCount,
        uint256 _index
    ) external view returns (bool);
}

contract PrivateTransferContract {
    bytes32 public constant PROVING_SYSTEM_ID =
        keccak256(abi.encodePacked("groth16"));
    bytes32 public constant VERSION_HASH = sha256(abi.encodePacked(""));

    address public immutable zkvContract;
    bytes32 public immutable vkHash;

    // Private state tracking
    mapping(uint256 => bool) public nullifiers; // Prevent double spend
    mapping(uint256 => uint256) public commitmentAmounts; // commitment → amount

    constructor(address _zkvContract, bytes32 _vkHash) {
        zkvContract = _zkvContract;
        vkHash = _vkHash;
    }

    // Public deposit to get private commitment
    function deposit(uint256 commitment) external payable {
        require(msg.value > 0, "Amount must be positive");
        require(commitmentAmounts[commitment] == 0, "Commitment exists");

        commitmentAmounts[commitment] = msg.value;
    }

    // Private transfer using ZK proof
    function privateTransfer(
        uint256 aggregationId,
        uint256 domainId,
        bytes32[] calldata merklePath,
        uint256 leafCount,
        uint256 index,
        address recipient,
        // Public inputs from ZK proof
        uint256 amount,
        uint256 commitment,
        uint256 nullifier
    ) external {
        // 1. Check commitment has enough balance
        require(
            commitmentAmounts[commitment] >= amount,
            "Insufficient commitment balance"
        );

        // 2. Check nullifier not used
        require(!nullifiers[nullifier], "Nullifier already used");

        // 3. Verify ZK proof
        require(
            _verifyProofHasBeenPostedToZkv(
                aggregationId,
                domainId,
                merklePath,
                leafCount,
                index,
                // public inputs
                commitment,
                nullifier
            ),
            "Invalid ZK proof"
        );

        // 4. Update state
        commitmentAmounts[commitment] -= amount;
        nullifiers[nullifier] = true;

        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    function _verifyProofHasBeenPostedToZkv(
        uint256 aggregationId,
        uint256 domainId,
        bytes32[] calldata merklePath,
        uint256 leafCount,
        uint256 index,
        uint256 commitment,
        uint256 nullifier
    ) internal view returns (bool) {
        // Encode public inputs
        bytes memory encodedInputs = abi.encodePacked(
            _changeEndianess(commitment),
            _changeEndianess(nullifier)
        );

        // Calculate leaf hash
        bytes32 leaf = keccak256(
            abi.encodePacked(
                PROVING_SYSTEM_ID,
                vkHash,
                VERSION_HASH,
                keccak256(encodedInputs)
            )
        );

        // Verify with zkVerify
        return
            IVerifyProofAggregation(zkvContract).verifyProofAggregation(
                domainId,
                aggregationId,
                leaf,
                merklePath,
                leafCount,
                index
            );
    }

    /// Utility function to efficiently change the endianess of its input (zkVerify groth16
    /// pallet uses big-endian encoding of public inputs, but EVM uses little-endian encoding).
    function _changeEndianess(uint256 input) internal pure returns (uint256 v) {
        v = input;
        // swap bytes
        v =
            ((v &
                0xFF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00) >>
                8) |
            ((v &
                0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF) <<
                8);
        // swap 2-byte long pairs
        v =
            ((v &
                0xFFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000) >>
                16) |
            ((v &
                0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF) <<
                16);
        // swap 4-byte long pairs
        v =
            ((v &
                0xFFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000) >>
                32) |
            ((v &
                0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF) <<
                32);
        // swap 8-byte long pairs
        v =
            ((v &
                0xFFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF0000000000000000) >>
                64) |
            ((v &
                0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF) <<
                64);
        // swap 16-byte long pairs
        v = (v >> 128) | (v << 128);
    }
}
