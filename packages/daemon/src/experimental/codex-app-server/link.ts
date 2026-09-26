import type { Readable, Writable } from "node:stream";

export interface StdioLink {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable | null;
  onExit: ((listener: (code: number | null, signal: NodeJS.Signals | null) => void) => void) | null;
  terminate: ((opts: { termMs: number }) => Promise<{ sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null }>) | null;
}
