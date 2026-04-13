import { NextResponse } from "next/server";
import { isProofNftEnabled, mintProofNft } from "@/lib/circle";

export async function POST(request: Request) {
  try {
    if (!isProofNftEnabled()) {
      return NextResponse.json(
        {
          error:
            "Proof NFT minting is disabled. Configure PROOF_NFT_CONTRACT_ADDRESS and ENABLE_PROOF_NFT=true.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      doerAddress?: string;
      tokenUri?: string;
    };

    if (!body.doerAddress) {
      return NextResponse.json(
        { error: "doerAddress is required" },
        { status: 400 },
      );
    }

    const mintResponse = await mintProofNft({
      doerAddress: body.doerAddress,
      tokenUri: body.tokenUri,
    });

    return NextResponse.json({ mintResponse });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Mint proof failed",
      },
      { status: 500 },
    );
  }
}
