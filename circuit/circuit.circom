pragma circom 2.0.0;

include "../app/node_modules/circomlib/circuits/poseidon.circom";

template PrivateTransfer() {
    // Private inputs (hidden from public)
    signal input privateKey;
    signal input nonce;
    
    // Public inputs (visible on-chain)
    signal input commitment;
    signal input nullifier;

    // 1. Verify commitment is correct
    component hashCommitment = Poseidon(2);
    hashCommitment.inputs[0] <== privateKey;
    hashCommitment.inputs[1] <== nonce;
    commitment === hashCommitment.out;

    // 2. Verify nullifier is correct  
    component hashNullifier = Poseidon(2);
    hashNullifier.inputs[0] <== privateKey;
    hashNullifier.inputs[1] <== nonce;
    nullifier === hashNullifier.out;
}

component main { public [commitment, nullifier] } = PrivateTransfer();