import { spawn } from "node:child_process";

export function consoleUrl(port: number, token: string): string {
  return `http://localhost:${port}/?token=${encodeURIComponent(token)}`;
}

export function openExternal(url: string, platform = process.platform): Promise<void> {
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  const started = new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
  return started;
}
