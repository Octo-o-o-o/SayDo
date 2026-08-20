import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function consoleDistDirectory(daemonDir: string): string {
  const packaged = join(daemonDir, "console");
  return process.env["SAYDO_CONSOLE_DIST"] ??
    (existsSync(packaged) ? packaged : join(daemonDir, "..", "console", "dist"));
}

export function consoleArtifactReady(daemonDir: string): boolean {
  const dist = consoleDistDirectory(daemonDir);
  const index = join(dist, "index.html");
  if (!existsSync(index)) return false;
  const html = readFileSync(index, "utf8");
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1] as string);
  return assets.length > 0 && assets.every((asset) => existsSync(join(dist, asset.replace(/^\//, ""))));
}
