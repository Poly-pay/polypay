# Private ETH Transfer using zkVerify

A privacy-preserving Ethereum transfer system that uses zero-knowledge proofs to enable anonymous ETH transfers through a pool-based mechanism.

## How It Works

### Overview
This system allows users to transfer ETH privately by breaking the on-chain link between sender and recipient through a pool-based approach combined with zero-knowledge proofs.

### High Level Architecture

```
┌─────────────────────┐    1. Generate ZK Proof     ┌─────────────────────┐
│                     │ ──────────────────────────▶ │                     │
│   User Application  │                             │     zkVerify        │
│   (Privacy Client)  │                             │   (Proof Verifier)  │
│                     │ ◀────────── 4. Get ──────── │                     │
└─────────────────────┘    Aggregation ID           └─────────────────────┘
           │                                                   │
           │                                                   │
           │ 7. Call via Relayer                               │ 3. Aggregate &
           ▼                                                   │    Store Proofs
┌─────────────────────┐                                        │
│                     │                                        ▼
│   Relayer Service   │                              ┌─────────────────────┐
│  (Anonymous Proxy)  │                              │                     │
│                     │                              │   zkVerify Chain    │
└─────────────────────┘                              │  (Proof Registry)   │
           │                                         │                     │
           │ 8. Submit Transaction                   └─────────────────────┘
           ▼                                                   │
┌─────────────────────┐    5. Query Proof Status               │
│                     │ ◀───────────────────────────────────── │
│   Smart Contract    │                                        │
│   (Privacy Pool)    │    6. Verify Aggregated Proof          │
│                     │ ──────────────────────────────────────▶│
└─────────────────────┘                                        │
           │                                                   │
           │ 9. Transfer ETH                                   │
           ▼                                                   │
┌─────────────────────┐                                        │
│                     │                                        │
│    Recipient        │                                        │
│                     │                                        │
└─────────────────────┘                                        │
                                                               │
┌─────────────────────┐    2. Submit & Wait                    │
│                     │ ───────────────────────────────────────┘
│   Ethereum Chain    │
│  (Settlement Layer) │
└─────────────────────┘
```

### Architecture Components

#### 1. Smart Contract (Pool)
- Acts as an ETH pool that holds deposited funds
- Tracks commitments and their associated amounts
- Verifies zero-knowledge proofs via zkVerify integration
- Executes transfers from pool to recipients

#### 2. Zero-Knowledge Circuit
- Proves ownership of a commitment without revealing the private key
- Validates that the user knows the secret behind a specific commitment
- Generates proofs that are verified on-chain through zkVerify

#### 3. Relayer System
- Submits transactions on behalf of users to hide the actual sender
- Pays gas fees for transaction execution
- Ensures the transaction caller is not the original depositor

## Privacy Flow

### Step 1: Deposit
User A deposits ETH → Smart Contract Pool
- Generates commitment = hash(privateKey, nonce)
- Contract stores: `commitmentAmounts[commitment] = depositAmount`
- Public info: Someone deposited X ETH with commitment Y

### Step 2: Private Transfer
User A (or someone with A's private key) initiates transfer:
1. Generate ZK proof proving ownership of commitment
2. Submit proof to zkVerify for verification
3. Relayer calls `privateTransfer()` with verified proof
4. Contract transfers ETH from pool → Recipient

### Step 3: Privacy Achievement
On-chain observers see:
- Transaction 1: User A → Contract (deposit)
- Transaction 2: Relayer → Contract → Recipient (transfer)
- No direct link between User A and Recipient

## Folder Structure

The repository is organized into three main directories:

- `app`: Contains the Node.js application that serves as the frontend and handles proof generation
- `circuit`: Contains the zk-SNARK circuit written in Circom for proving commitment ownership
- `contracts`: Contains the Solidity smart contracts managed with Foundry

## Prerequisites

Before you begin, ensure you have the following installed:

-   [Node.js](https://nodejs.org/en/)
-   [Foundry](https://getfoundry.sh/)
-   [Circom](https://docs.circom.io/getting-started/installation/)
-   [snarkjs](https://github.com/iden3/snarkjs)

## Development Setup

### Step-by-Step Setup

#### 1. Clone and Install Dependencies

```bash
git clone git@github.com:Poly-pay/polypay.git
cd polypay

# Install Node.js dependencies
cd app
npm install
cd ..
```

#### 2. Compile Circuit

```bash
cd circuit/
make
```

This command will:
1. Compile the `circuit.circom` file
2. Perform a local trusted setup (for demonstration purposes, do not use in production)
3. Generate the proving key (`circuit_final.zkey`), verification key (`verification_key.json`), and WebAssembly version of the circuit (`circuit.wasm`)
4. Place the generated files in the `setup` directory

#### 3. Environment Configuration

Create `.env.secret` file in `app/` directory with your private keys and zkVerify credentials.

#### 4. Generate Verification Key Hash

```bash
cd app/
node ./src/get_vkhash.js
```

This requires `.env.secret` to be properly configured.

#### 5. Update Contract Environment

Copy the generated vkHash to `.env` file in `contracts/` directory.

#### 6. Deploy Smart Contract

```bash
cd contracts
forge script script/PrivateTransferContract.s.sol:ZkvVerifierContractScript \
  --rpc-url wss://ethereum-sepolia-rpc.publicnode.com \
  --private-key=YOUR_PRIVATE_KEY \
  --broadcast
```

#### 7. Update App Configuration

- Save the deployed contract address to `.env` in `app/` directory
- Update the relayer private key in `app.js`:

```javascript
this.relayerWallet = new ethers.Wallet(
  "YOUR_PRIVATE_KEY", // relayer private key (change this to something for your own use)
  provider
);
```

#### 8. Run the Application

```bash
cd app/
node app.js
```

## End-to-End User Workflow

1. **Generate a Proof**: The user interacts with the DApp. The DApp uses the compiled circuit (`circuit.wasm`) and proving key (`circuit_final.zkey`) to generate a proof based on the user's commitment
2. **Submit Proof to zkVerify**: The DApp sends the generated proof and public inputs to zkVerify for verification
3. **Receive Proof ID**: zkVerify verifies the proof and returns proof
4. **Execute Private Transfer**: The relayer calls the smart contract with the proof, enabling anonymous transfer from pool to recipient
5. **On-Chain Attestation**: The smart contract verifies the proof through zkVerify's attestation contract

## Next Steps

Check out [zkVerify documentation](https://docs.zkverify.io/) for additional info and tutorials:
- [zkVerify Contracts](https://docs.zkverify.io/overview/contract-addresses)
- [zkVerify Supported Verifiers](https://docs.zkverify.io/overview/supported_proofs)
- [zkVerifyJS](https://docs.zkverify.io/overview/zkverifyjs)
- [Dapp Developer Tutorial](https://docs.zkverify.io/overview/getting-started/smart-contract)
- [Utility Solidity Library for DApp Developers](https://github.com/zkVerify/zkv-attestation-contracts/tree/main/contracts/verifiers)
- [zkVerify Aggregation Contract](https://github.com/zkVerify/zkv-attestation-contracts/blob/main/contracts/ZkVerifyAggregationGlobal.sol)
