import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageWriteInput = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
  jobId: string;
};

type StorageWriteResult = {
  storageKey: string;
};

const provider = process.env.STORAGE_PROVIDER?.toLowerCase() ?? "local";

function isS3Configured() {
  return provider === "s3" && !!process.env.S3_BUCKET;
}

export function usesLocalStorage() {
  return !isS3Configured();
}

function buildS3Client() {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

function safeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function putAttachment(input: StorageWriteInput): Promise<StorageWriteResult> {
  const safeName = safeFileName(input.fileName || "attachment");
  const storageKey = `jobs/${input.jobId}/${Date.now()}-${randomUUID()}-${safeName}`;

  if (isS3Configured()) {
    const client = buildS3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      Body: input.bytes,
      ContentType: input.contentType,
    });

    await client.send(command);
    return { storageKey };
  }

  const target = path.join(process.cwd(), ".storage", storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(input.bytes));

  return { storageKey };
}

export async function getAttachmentSignedUrl(storageKey: string) {
  if (isS3Configured()) {
    const client = buildS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
    });
    const expiresIn = Number(process.env.SIGNED_URL_TTL_SECONDS ?? 900);
    const url = await getSignedUrl(client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { url, expiresAt };
  }

  return {
    url: `/api/attachments/local?key=${encodeURIComponent(storageKey)}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
}

export async function getAttachmentBytes(storageKey: string) {
  if (isS3Configured()) {
    const client = buildS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
    });
    const result = await client.send(command);

    if (!result.Body) {
      throw new Error("Attachment body is empty");
    }

    const chunks: Uint8Array[] = [];
    const stream = result.Body.transformToWebStream();
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }

    const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  const filePath = path.join(process.cwd(), ".storage", storageKey);
  return new Uint8Array(await readFile(filePath));
}
