import net from "node:net";

function hasEicarString(bytes: Uint8Array) {
  const content = Buffer.from(bytes).toString("utf8");
  return content.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
}

async function clamAvScan(bytes: Uint8Array) {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);

  if (!host) {
    return null;
  }

  return new Promise<{ clean: boolean; details: string }>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write("zINSTREAM\0");

      const chunkLength = Buffer.alloc(4);
      chunkLength.writeUInt32BE(bytes.length, 0);
      socket.write(chunkLength);
      socket.write(Buffer.from(bytes));

      const zero = Buffer.alloc(4);
      zero.writeUInt32BE(0, 0);
      socket.write(zero);
    });

    let output = "";

    socket.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });

    socket.on("error", (error) => {
      reject(error);
    });

    socket.on("end", () => {
      const isClean = output.includes("OK");
      resolve({ clean: isClean, details: output.trim() || "clamav-no-output" });
    });
  });
}

export async function scanBuffer(bytes: Uint8Array) {
  const clam = await clamAvScan(bytes).catch((error) => ({
    clean: false,
    details: `clamav-error:${error instanceof Error ? error.message : "unknown"}`,
  }));

  if (clam) {
    return clam;
  }

  const eicar = hasEicarString(bytes);
  if (eicar) {
    return {
      clean: false,
      details: "heuristic-detected-eicar-signature",
    };
  }

  return {
    clean: true,
    details: "heuristic-clean",
  };
}
