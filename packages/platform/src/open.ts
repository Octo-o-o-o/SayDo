import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { hostKind } from "./host.js";

export function openExternal(url: string, platform = process.platform): Promise<void> {
  const marker = process.env["SAYDO_OPEN_MARKER"];
  if (marker) {
    writeFileSync(marker, url);
    return Promise.resolve();
  }
  const kind = hostKind(platform);
  const command = kind === "darwin" ? "open" : kind === "win32" ? (process.env["ComSpec"] || "cmd.exe") : "xdg-open";
  const args = kind === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  const started = new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
  return started;
}
