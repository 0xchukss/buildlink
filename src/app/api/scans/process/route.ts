import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getAttachmentBytes } from "@/lib/storage";
import { scanBuffer } from "@/lib/scanner";
import {
  getNextQueuedScanTask,
  markAttachmentScanResult,
  markScanTaskCompleted,
  markScanTaskFailed,
  markScanTaskProcessing,
} from "@/lib/store";

function hasCronAuth(request: Request) {
  const secret = process.env.SCAN_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const headerSecret = request.headers.get("x-scan-cron-secret");
  const authHeader = request.headers.get("authorization");

  return (
    headerSecret === secret ||
    authHeader === `Bearer ${secret}`
  );
}

export async function POST(request: Request) {
  const cronAuthorized = hasCronAuth(request);
  if (!cronAuthorized) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const maxItems = Number(process.env.SCAN_BATCH_SIZE ?? 10);
  let processed = 0;

  for (let i = 0; i < maxItems; i += 1) {
    const task = await getNextQueuedScanTask();
    if (!task) {
      break;
    }

    await markScanTaskProcessing(task.id);

    try {
      const bytes = await getAttachmentBytes(task.attachment.storageKey);
      const scan = await scanBuffer(bytes);

      if (scan.clean) {
        await markAttachmentScanResult({
          attachmentId: task.attachmentId,
          status: "CLEAN",
          details: scan.details,
        });
      } else {
        await markAttachmentScanResult({
          attachmentId: task.attachmentId,
          status: "INFECTED",
          details: scan.details,
        });
      }

      await markScanTaskCompleted(task.id);
      processed += 1;
    } catch (error) {
      await markAttachmentScanResult({
        attachmentId: task.attachmentId,
        status: "ERROR",
        details: error instanceof Error ? error.message : "scan-error",
      });
      await markScanTaskFailed(task.id, error instanceof Error ? error.message : "scan-error");
    }
  }

  return NextResponse.json({ processed });
}
