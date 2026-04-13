import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, decodeEventLog, getAddress, http, parseAbiItem } from "viem";
import { ARC_USDC_ADDRESS } from "@/lib/constants";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export function isProofNftEnabled() {
  const enabledFlag = process.env.ENABLE_PROOF_NFT;
  const hasContract = !!process.env.PROOF_NFT_CONTRACT_ADDRESS;
  return hasContract && enabledFlag !== "false";
}

function getCircleClient(): CircleDeveloperControlledWalletsClient {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error("Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET");
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

export async function mintProofNft(params: {
  doerAddress: string;
  tokenUri?: string;
}) {
  const walletAddress = process.env.ESCROW_WALLET_ADDRESS;
  const contractAddress = process.env.PROOF_NFT_CONTRACT_ADDRESS;

  if (!isProofNftEnabled()) {
    throw new Error(
      "Proof NFT minting is disabled. Set PROOF_NFT_CONTRACT_ADDRESS and ENABLE_PROOF_NFT=true.",
    );
  }

  if (!walletAddress || !contractAddress) {
    throw new Error(
      "Missing ESCROW_WALLET_ADDRESS or PROOF_NFT_CONTRACT_ADDRESS",
    );
  }

  const client = getCircleClient();

  return client.createContractExecutionTransaction({
    walletAddress,
    blockchain: "ARC-TESTNET",
    contractAddress,
    abiFunctionSignature: "safeMint(address,string)",
    abiParameters: [params.doerAddress, params.tokenUri ?? "ipfs://builderlink-proof"],
    fee: {
      type: "level",
      config: {
        feeLevel: "MEDIUM",
      },
    },
  });
}

export async function payoutUsdc(params: {
  doerAddress: string;
  rewardAmount: string;
}) {
  const walletAddress = process.env.ESCROW_WALLET_ADDRESS;

  if (!walletAddress) {
    throw new Error("Missing ESCROW_WALLET_ADDRESS");
  }

  const client = getCircleClient();

  return client.createTransaction({
    amount: [params.rewardAmount],
    destinationAddress: params.doerAddress,
    tokenAddress: ARC_USDC_ADDRESS,
    blockchain: "ARC-TESTNET",
    walletAddress,
    fee: {
      type: "level",
      config: {
        feeLevel: "MEDIUM",
      },
    },
  });
}

export async function checkTransferViaCircleMonitor(params: {
  txHash: string;
  toAddress: string;
  tokenAddress: string;
}) {
  const rpcUrl =
    process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
  const publicClient = createPublicClient({ transport: http(rpcUrl) });

  const verifyOnchainTransfer = async () => {
    const receipt = await publicClient.getTransactionReceipt({
      hash: params.txHash as `0x${string}`,
    });

    if (receipt.status !== "success") {
      return false;
    }

    const expectedTo = getAddress(params.toAddress).toLowerCase();
    const expectedToken = getAddress(params.tokenAddress).toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== expectedToken) {
        continue;
      }

      try {
        const decoded = decodeEventLog({
          abi: [transferEvent],
          data: log.data,
          topics: log.topics,
        });

        if (
          decoded.eventName === "Transfer" &&
          getAddress(decoded.args.to).toLowerCase() === expectedTo
        ) {
          return true;
        }
      } catch {
        // Ignore unrelated logs from the same transaction.
      }
    }

    return false;
  };

  const apiKey = process.env.CIRCLE_API_KEY;
  const monitorUrl =
    process.env.CIRCLE_MONITOR_API_URL ??
    "https://api.circle.com/v1/w3s/monitor/events";

  if (!apiKey) {
    return verifyOnchainTransfer();
  }

  try {
    const response = await fetch(monitorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        blockchain: "ARC-TESTNET",
        txHash: params.txHash,
        eventName: "Transfer",
        tokenAddress: params.tokenAddress,
        toAddress: params.toAddress,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return verifyOnchainTransfer();
      }
      const text = await response.text();
      throw new Error(`Circle Monitor API error: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as {
      data?: { events?: Array<{ txHash?: string; eventName?: string }> };
    };

    const events = payload.data?.events ?? [];
    const found = events.some(
      (event) =>
        event.txHash?.toLowerCase() === params.txHash.toLowerCase() &&
        event.eventName?.toLowerCase() === "transfer",
    );

    if (found) {
      return true;
    }

    return verifyOnchainTransfer();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Circle Monitor API error:")) {
      throw error;
    }
    return verifyOnchainTransfer();
  }
}
