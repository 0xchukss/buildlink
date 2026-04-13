import path from "node:path";

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

type AllowedMime = keyof typeof ALLOWED;

export type ValidatedUpload = {
  file: File;
  bytes: Uint8Array;
  safeName: string;
  contentType: AllowedMime;
};

export function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hasPrefix(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function toAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...Array.from(bytes.slice(start, end)));
}

function isMimeSignatureValid(mime: AllowedMime, bytes: Uint8Array, ext: string) {
  if (mime === "image/png") {
    return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  if (mime === "image/jpeg") {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  }

  if (mime === "image/webp") {
    return toAscii(bytes, 0, 4) === "RIFF" && toAscii(bytes, 8, 12) === "WEBP";
  }

  if (mime === "application/pdf") {
    return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }

  if (mime === "application/msword") {
    return (
      ext === ".doc" &&
      hasPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    );
  }

  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ext === ".docx" && hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]);
  }

  return false;
}

export async function validateAndPrepareAttachments(files: File[]) {
  if (files.length === 0) {
    return { ok: false as const, error: "At least one attachment is required" };
  }

  if (files.length > MAX_ATTACHMENTS) {
    return {
      ok: false as const,
      error: `Maximum ${MAX_ATTACHMENTS} attachments allowed`,
    };
  }

  let totalSize = 0;
  const uploads: ValidatedUpload[] = [];

  for (const file of files) {
    totalSize += file.size;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        ok: false as const,
        error: `${file.name} exceeds ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit`,
      };
    }

    const mime = file.type as AllowedMime;
    const allowedExtensions = ALLOWED[mime];

    if (!allowedExtensions) {
      return {
        ok: false as const,
        error: `Unsupported MIME type: ${file.type || "unknown"}`,
      };
    }

    const safeName = sanitizeFileName(file.name || "attachment");
    const ext = path.extname(safeName).toLowerCase();

    if (!allowedExtensions.includes(ext as never)) {
      return {
        ok: false as const,
        error: `${file.name} extension does not match MIME type`,
      };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const signatureValid = isMimeSignatureValid(mime, bytes, ext);

    if (!signatureValid) {
      return {
        ok: false as const,
        error: `${file.name} failed binary signature validation`,
      };
    }

    uploads.push({
      file,
      bytes,
      safeName,
      contentType: mime,
    });
  }

  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    return {
      ok: false as const,
      error: `Total upload size exceeds ${Math.floor(MAX_TOTAL_SIZE_BYTES / (1024 * 1024))}MB`,
    };
  }

  return { ok: true as const, uploads };
}
