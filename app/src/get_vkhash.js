const fs = require("fs");
const {
  zkVerifySession,
  Library,
  CurveType,
  ProofType,
} = require("zkverifyjs");
require("dotenv").config({ path: [".env", ".env.secrets"] });

async function run() {
  // Load verification key from file
  const vk = JSON.parse(
    fs.readFileSync("../circuit/setup/verification_key.json")
  );

  // Establish a session with zkVerify
  const session = await zkVerifySession
    .start()
    .Custom({
      websocket: "wss://testnet-rpc.zkverify.io",
      rpc: "https://testnet-rpc.zkverify.io",
      network: "Volta", // Optional
    })
    .withAccount(process.env.ZKV_SEED_PHRASE);

  // Send verification key to zkVerify for registration
  const vkHash = await session.getVkHash(
    {
      proofType: ProofType.groth16,
      config: {
        curve: CurveType.bn254,
        library: Library.snarkjs,
      },
    },
    vk
  );
  console.log("VkHash: ", vkHash);
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
