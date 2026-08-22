export type HostKind = "darwin" | "win32" | "linux" | "other";

export function hostKind(platform = process.platform): HostKind {
  if (platform === "darwin" || platform === "win32" || platform === "linux") return platform;
  return "other";
}

export function homeDir(): string {
  const home = process.env["USERPROFILE"] ?? process.env["HOME"] ?? "";
  if (hostKind() === "win32") {
    const resolved = process.env["USERPROFILE"] || home;
    if (!resolved) throw new Error("USERPROFILE is required on Windows");
    return resolved;
  }
  const posix = process.env["HOME"] || home;
  if (!posix) throw new Error("HOME is required");
  return posix;
}

export function pathDelimiter(platform = process.platform): string {
  return platform === "win32" ? ";" : ":";
}
