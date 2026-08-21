export { openExternal } from "@saydo/platform";

export function consoleUrl(port: number, token: string): string {
  return `http://localhost:${port}/?token=${encodeURIComponent(token)}`;
}
