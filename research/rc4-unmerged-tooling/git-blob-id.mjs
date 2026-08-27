#!/usr/bin/env node
import { createHash } from "node:crypto";

export function gitBlobId(buf) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}
