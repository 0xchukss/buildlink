const ALLOWED_MEDIA_PREFIXES = ["image/", "video/", "audio/"];

export type ForumMediaItem = {
  kind: "image" | "video" | "audio";
  contentType: string;
  dataUrl: string;
  fileName: string;
};

const MAX_MEDIA_ITEMS = 3;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function mediaKind(contentType: string): ForumMediaItem["kind"] | null {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return null;
}

export async function extractForumMedia(formData: FormData, fieldName: string) {
  const files = formData.getAll(fieldName).filter((entry): entry is File => entry instanceof File);

  if (files.length > MAX_MEDIA_ITEMS) {
    throw new Error(`You can attach up to ${MAX_MEDIA_ITEMS} media files.`);
  }

  const media: ForumMediaItem[] = [];

  for (const file of files) {
    if (!file.size) {
      continue;
    }

    if (!ALLOWED_MEDIA_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
      throw new Error(`Unsupported media type: ${file.type || "unknown"}`);
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`File ${file.name} is too large. Max size is 4MB.`);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const encoded = bytes.toString("base64");
    const kind = mediaKind(file.type);

    if (!kind) {
      throw new Error(`Unsupported media type: ${file.type || "unknown"}`);
    }

    media.push({
      kind,
      contentType: file.type,
      dataUrl: `data:${file.type};base64,${encoded}`,
      fileName: file.name || "media",
    });
  }

  return media;
}

export function parseForumMedia(value: string | null | undefined): ForumMediaItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as ForumMediaItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) =>
      item &&
      (item.kind === "image" || item.kind === "video" || item.kind === "audio") &&
      typeof item.contentType === "string" &&
      typeof item.dataUrl === "string" &&
      typeof item.fileName === "string",
    );
  } catch {
    return [];
  }
}
