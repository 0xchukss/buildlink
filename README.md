# ArcHire (Full-Stack DApp)

ArcHire is a decentralized jobbing platform on Arc Testnet with:

- User wallets (MetaMask/Rabby/Zerion) via Wagmi + RainbowKit
- SIWE-style wallet signature sessions for protected backend actions
- Platform admin automation via Circle Developer-Controlled Wallets SDK
- USDC escrow flow (approve + transfer)
- Doer submission flow with screenshot/doc/pdf attachments
- Strict upload controls: max 5 files, 10MB per file, 25MB total, plus binary-signature MIME checks
- Object storage-backed attachments with signed download URLs
- Malware scan queue (ClamAV if configured, heuristic fallback in dev)
- Creator approval gate before claim
- Proof-of-work NFT minting via Circle `createContractExecutionTransaction`
- USDC payout via Circle `createTransaction`

## Stack

- Frontend: Next.js App Router, Tailwind CSS, Wagmi, Viem, RainbowKit
- Backend: Next.js API routes + Circle SDK
- Persistence: Prisma + SQLite
- Storage: S3/R2/MinIO compatible (or local fallback)
- Chain: Arc Testnet
- USDC (Arc): `0x3600000000000000000000000000000000000000`

## Pages

- `/`: Builder Feed with Create Job modal and escrow actions
- `/profile`: Connected wallet proof NFT history

## API Endpoints

- `GET /api/jobs`: List active jobs
- `POST /api/jobs`: Create a new job
- `POST /api/jobs/[id]/monitor-funding`: Check Circle Monitor event and mark job funded
- `POST /api/jobs/[id]/complete`: Doer submits files for creator review
- `POST /api/jobs/[id]/approve`: Creator approves submitted proof
- `POST /api/jobs/[id]/claim`: Approved doer claims reward (payout, optional mint)
- `POST /api/mint-proof`: Standalone proof NFT minting route (only if enabled)
- `GET /api/profile/[address]/proofs`: List locally tracked proof NFTs
- `POST /api/auth/challenge`: Get sign-in message nonce
- `POST /api/auth/verify`: Verify signature and set session cookie
- `GET /api/auth/me`: Read current signed session
- `POST /api/auth/logout`: Revoke session
- `POST /api/scans/process`: Process queued attachment scans

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill all Circle and contract values

Required backend values:

- `CIRCLE_API_KEY`
- `CIRCLE_ENTITY_SECRET`
- `ESCROW_WALLET_ADDRESS`
- `DATABASE_URL` (for local: `file:./prisma/dev.db`)

Optional NFT values:

- `ENABLE_PROOF_NFT=true|false`
- `PROOF_NFT_CONTRACT_ADDRESS` (required only when `ENABLE_PROOF_NFT=true`)

Optional storage and security values:

- `STORAGE_PROVIDER=local|s3`
- `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `SIGNED_URL_TTL_SECONDS`
- `CLAMAV_HOST`, `CLAMAV_PORT`, `SCAN_BATCH_SIZE`
- `SCAN_CRON_SECRET` (or `CRON_SECRET` on Vercel)

Required frontend values:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_ESCROW_ADDRESS`

## Arc + Circle Notes

- Arc chain config uses RPC `https://rpc.testnet.arc.network` and Chain ID `5042002`
- ERC-721 template reference: `76b83278-50e2-4006-8b63-5b1a2a814533`
- Users must fund their EOA with ARC for gas (approve + transfer)
- For testing, get Arc USDC from the Circle Faucet
- Create one Circle Developer-Controlled Wallet manually first and use it as escrow/admin wallet

## Verification Flow

1. Creator funds escrow in USDC.
2. Doer signs in with wallet signature and submits completion evidence with file attachments.
3. Files are uploaded to object storage and queued for malware scan.
4. Scan worker marks attachments clean/infected (`POST /api/scans/process`).
5. Creator can only approve when all attachments are clean.
6. Only after approval, the doer can claim reward.
7. Claim triggers backend payout using Circle admin wallet.
8. NFT mint is optional and runs only when enabled.

## Scheduled Scan Worker (Production)

This project includes a cron schedule in [vercel.json](vercel.json) that calls [scan process route](src/app/api/scans/process/route.ts) every minute.

1. Set `SCAN_CRON_SECRET` (or `CRON_SECRET`) in your deployment environment.
2. Vercel cron will call `POST /api/scans/process` with bearer auth.
3. The route accepts either cron secret auth or an authenticated user session.
4. Keep `SCAN_BATCH_SIZE` tuned to your throughput and function limits.

## Run

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

## Build Check

```bash
npm run build
```

Build currently passes.
