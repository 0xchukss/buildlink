import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import {
  getAttachmentBytes,
  getAttachmentSignedUrl,
  usesLocalStorage,
} from "@/lib/storage";
import { getAttachmentById, updateAttachmentSignedUrl } from "@/lib/store";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);

  const params = await context.params;
  const attachment = await getAttachmentById(params.id);

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const addr = session?.address.toLowerCase() ?? "";
  const creator = attachment.job.creatorAddress.toLowerCase();
  const doer = (attachment.job.doerAddress ?? "").toLowerCase();

  const isProofAttachment = attachment.attachmentType === "proof";
  if (isProofAttachment && (!session || (addr !== creator && addr !== doer))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (usesLocalStorage()) {
    const bytes = await getAttachmentBytes(attachment.storageKey);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `inline; filename="${attachment.name}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const cachedValid =
    attachment.signedUrl &&
    attachment.signedUrlExpiresAt &&
    attachment.signedUrlExpiresAt.getTime() > Date.now() + 5000;

  if (cachedValid) {
    return NextResponse.redirect(attachment.signedUrl as string);
  }

  const signed = await getAttachmentSignedUrl(attachment.storageKey);
  await updateAttachmentSignedUrl(attachment.id, signed.url, signed.expiresAt);
  return NextResponse.redirect(signed.url);
}
