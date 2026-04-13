export const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    name: "ARC",
    symbol: "ARC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
    public: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://explorer.arc.network",
    },
  },
  testnet: true,
} as const;

export const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

export const ARC_USDC_DECIMALS = 6;

export const CIRCLE_ERC721_TEMPLATE_ID =
  "76b83278-50e2-4006-8b63-5b1a2a814533" as const;
