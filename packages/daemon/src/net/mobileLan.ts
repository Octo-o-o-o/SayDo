// M1 移动 LAN 临时访问面:显式开关、路由最小白名单与监听地址单源。

export function mobileLanEnabled(value: string | undefined): boolean {
  return value === "1";
}

export function daemonListenAddress(configured: string, mobileLan: boolean): string {
  return mobileLan ? "0.0.0.0" : configured;
}

export function mobileLanApiAllowed(method: string | undefined, pathname: string): boolean {
  if (method === "GET") {
    if (
      pathname === "/api/attention" ||
      pathname === "/api/focuses" ||
      pathname === "/api/sessions/recent-transcript" ||
      pathname === "/api/memory/recent"
    ) {
      return true;
    }
    if (/^\/api\/focuses\/[^/]+$/.test(pathname)) return true;
    // 桌面 Memory.tsx 同源只读:GET /api/projects/:id/memory
    return /^\/api\/projects\/[^/]+\/memory$/.test(pathname);
  }
  return method === "POST" && pathname === "/api/setup/first-run/query";
}
