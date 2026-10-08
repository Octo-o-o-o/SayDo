import { lstatSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { isReparsePoint } from "@saydo/platform";

/** 官方 Windows 原生包入口；不执行包装脚本，不解析 PATH 或 latest。 */
export function cursorNodeEntrypoint(file: string): { file: string; script: string } {
  const versionDir = dirname(file);
  if (!isAbsolute(file) || basename(file) !== "index.js" || basename(dirname(versionDir)) !== "versions") {
    throw new Error("Cursor Node 入口须为绝对 versions/<version>/index.js 路径");
  }
  const runtime = join(versionDir, "node.exe");
  for (const [path, directory] of [[versionDir, true], [file, false], [runtime, false]] as const) {
    const st = lstatSync(path);
    if (st.isSymbolicLink() || isReparsePoint(path) || (directory ? !st.isDirectory() : !st.isFile())) {
      throw new Error("Cursor Node 入口、运行时和版本目录必须是非链接实体");
    }
  }
  return { file: runtime, script: file };
}
