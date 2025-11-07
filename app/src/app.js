const snarkjs = require("snarkjs");
const fs = require("fs");
const { zkVerifySession, Library, CurveType } = require("zkverifyjs");
const ethers = require("ethers");
require("dotenv").config({ path: [".env", ".env.secrets"] });
const { buildPoseidon } = require("circomlibjs");

let poseidon;

class PrivateTransferManager {
  constructor(provider, privateKey, contractAddress, zkVerifySession) {
    this.provider = provider;
    this.userPrivateKey = privateKey;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.relayerWallet = new ethers.Wallet(
      "0x6699bdd993157bdf09535edda1d4649de569f45b3166a63b8bcafcd2811e0bac", // relayer private key (change this to something for your own use)
      provider
    );
    this.contract = new ethers.Contract(
      contractAddress,
      ABI,
      this.relayerWallet
    ); // Use relayer wallet to send tx cause we dont want to expose user wallet (sender)
    this.zkSession = zkVerifySession;
  }

  generateCommitment(privateKey, nonce) {
    const result = poseidon([BigInt(privateKey), BigInt(nonce)]);
    return poseidon.F.toObject(result).toString();
  }

  generateNullifier(privateKey, nonce) {
    const result = poseidon([BigInt(privateKey), BigInt(nonce)]);
    return poseidon.F.toObject(result).toString();
  }

  async deposit(amountInWei) {
    console.log("🔐 Depositing tokens to get private commitment...");

    const nonceTx =
      (await this.provider.getTransactionCount(
        this.wallet.address,
        "pending"
      )) + 1;

    console.log("🚀 ~ PrivateTransferManager ~ deposit ~ nonceTx:", nonceTx); //remmove
    const commitment = this.generateCommitment(this.userPrivateKey, nonceTx);
    const balance = await this.provider.getBalance(this.wallet.address); // remove
    console.log("🚀 ~ PrivateTransferManager ~ deposit ~ balance:", balance); //remove

    try {
      const tx = await this.contract.deposit(BigInt(commitment), {
        value: amountInWei,
      });
      await tx.wait();
    } catch (error) {
      console.log("Insufficient funds for deposit", error);
    }

    console.log(`✅ Deposited! Commitment: ${commitment}`);
    return { commitment, nonce: nonceTx };
  }

  // Execute private transfer
  async privateTransfer(recipient, amountInWei, currentNonce) {
    console.log(
      `🔒 Starting private transfer of ${amountInWei} to ${recipient}...`
    );

    let lastTime = Date.now();
    const logTime = (label) => {
      const now = Date.now();
      console.log(`⏱️  ${label}: ${(now - lastTime) / 1000 / 60}mins`);
    };
    logTime("Start");

    // Calculate commitment and nullifier
    const commitment = this.generateCommitment(
      this.userPrivateKey,
      currentNonce
    );

    const nullifier = this.generateNullifier(this.userPrivateKey, currentNonce);

    const input = {
      // Private inputs
      privateKey: this.userPrivateKey.toString(),
      nonce: BigInt(currentNonce).toString(),

      // Public inputs
      commitment: commitment,
      nullifier: nullifier,
    };
    console.log(
      "🚀 ~ PrivateTransferManager ~ privateTransfer ~ input:",
      input
    );

    // Generate ZK proof
    console.log("🔄 Generating ZK proof...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "../circuit/setup/circuit.wasm",
      "../circuit/setup/circuit_final.zkey"
    );
    console.log(
      "🚀 ~ PrivateTransferManager ~ privateTransfer ~ publicSignals:",
      publicSignals
    );

    const vk = JSON.parse(
      fs.readFileSync("../circuit/setup/verification_key.json")
    );

    // Submit to zkVerify
    console.log("📤 Submitting proof to zkVerify...");
    const { events, transactionResult } = await this.zkSession
      .verify()
      .groth16({
        library: Library.snarkjs,
        curve: CurveType.bn128,
      })
      .execute({
        proofData: { vk, proof, publicSignals },
        domainId: 0,
      });

    // Wait for zkVerify confirmation
    const transactionInfo = await transactionResult;
    logTime("zkVerify confirmation");
    console.log(
      "🚀 ~ PrivateTransferManager ~ privateTransfer ~ transactionInfo:",
      transactionInfo
    );
    const receipt = await this.zkSession.waitForAggregationReceipt(
      transactionInfo.domainId,
      transactionInfo.aggregationId
    );
    logTime("Aggregation receipt");

    const statementPathResult = await this.zkSession.getAggregateStatementPath(
      receipt.blockHash,
      transactionInfo.domainId,
      transactionInfo.aggregationId,
      transactionInfo.statement
    );

    console.log("wait 1m"); // remove this
    // await new Promise((resolve) => setTimeout(resolve, 60000)); // wait 1m
    // wait to have enough time for relayer to submit on-chains
    await new Promise((resolve) => setTimeout(resolve, 40000)); // wait 1m
    console.log("wait 1m done!"); // remove this

    console.log("🚀 Executing private transfer...");
    const tx = await this.contract.privateTransfer(
      transactionInfo.aggregationId,
      transactionInfo.domainId,
      statementPathResult.proof,
      statementPathResult.numberOfLeaves,
      statementPathResult.leafIndex,
      ethers.getAddress(recipient),
      BigInt(amountInWei),
      BigInt(commitment),
      BigInt(nullifier)
    );

    const receiptTx = await tx.wait();
    console.log(`✅ Private transfer completed! Tx: ${receiptTx.hash}`);
    logTime("Finish");
    return {
      txHash: receiptTx.hash,
    };
  }
}

// Contract ABI
const ABI = [
  "function deposit(uint256 commitment)",
  "function privateTransfer(uint256 aggregationId, uint256 domainId, bytes32[] calldata merklePath, uint256 leafCount, uint256 index, address recipient, uint256 amount, uint256 commitment, uint256 nullifier)",
];

// Usage example
async function main() {
  // Setup
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  poseidon = await buildPoseidon();
  const zkSession = await zkVerifySession
    .start()
    .Custom({
      websocket: "wss://testnet-rpc.zkverify.io",
      rpc: "https://testnet-rpc.zkverify.io",
    })
    .withAccount(process.env.ZKV_SEED_PHRASE);

  const manager = new PrivateTransferManager(
    provider,
    process.env.ETH_SECRET_KEY,
    process.env.ETH_APP_CONTRACT_ADDRESS,
    zkSession
  );
  const amountToSend = ethers.parseEther("0.0001");

  // 1. Deposit to get private commitment
  const { commitment, nonce } = await manager.deposit(amountToSend);

  // 2. Execute private transfer
  const result = await manager.privateTransfer(
    "0x224ECBb02B07601d21a5714BB23571Dd124F9ED6", // recipient
    // "0x77468c757DB376F9bc216e75aAAd61eC9fC02DDD",
    amountToSend,
    nonce
  );

  console.log("🎉 Private transfer completed!");
  console.log(`Transaction hash: ${result.txHash}`);
}

main().catch(console.error);
