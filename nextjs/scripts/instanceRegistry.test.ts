import { AccountId, PrivateKey, Client } from "@hashgraph/sdk";
import {
  registerSubnet,
  registerInstance,
  getActiveInstancesBySubnet,
  getAllSubnets,
  getSubnet,
  getInstance,
} from "../src/lib/instanceRegistry";

async function main() {
  const MY_ACCOUNT_ID = AccountId.fromString(process.env.MY_ACCOUNT_ID || "0.0.5864744");
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(
    process.env.MY_PRIVATE_KEY || "d04f46918ebce20abe26f7d34e5018ac2ba8aa7ffacf9f817656789b36f76207"
  );
  const CONTRACT_ID = "0.0.6915896";
  const MINER_ACCOUNT_ID = process.env.MINER_ACCOUNT_ID || "0.0.5864744";

  const client = Client.forTestnet();
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);
  console.log("contractId:", CONTRACT_ID);
  console.log("registerSubnet...");
  try {
    const regSubnet = await registerSubnet({
      client,
      contractId: CONTRACT_ID,
      subnetId: 1,
      name: "Translation",
    });
    console.log(regSubnet);
  } catch (e: any) {
    console.warn(
      "registerSubnet failed (contract may be legacy without subnet functions). Proceeding...",
      e?.message || e
    );
  }

  console.log("registerInstance...");
  const regInst = await registerInstance({
    client,
    contractId: CONTRACT_ID,
    subnetId: 1,
    minerAddress: MINER_ACCOUNT_ID,
    state: true,
    url: "https://node.example.com",
  });
  console.log(regInst);

  console.log("getActiveInstancesBySubnet...");
  console.log(await getActiveInstancesBySubnet({ contractId: CONTRACT_ID, subnetId: 1 }));

//   console.log("getSubnet...");
//   console.log(await getSubnet({ contractId: CONTRACT_ID, subnetId: 1 }));

  console.log("getAllSubnets...");
  console.log(await getAllSubnets({ contractId: CONTRACT_ID }));

//   console.log("getInstance...");
//   console.log(await getInstance({ contractId: CONTRACT_ID, minerAddress: MINER_ACCOUNT_ID, subnetId: 1 }));

  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


