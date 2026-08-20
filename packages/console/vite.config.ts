import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// dev 代理(接线批任务⑤):vite dev(47120)页的 API/WS 恒同源相对路径,由此转发到 daemon。
// 剥 Origin 头 = 转发后请求语义等同本地进程调用(pipeline/CLI 同型,G1 originAllowed 放行);
// capability token 门照过(G1 主体绑定不放宽)。SAYDO_DAEMON_ORIGIN 供 Playwright 指测试 daemon。
const daemonOrigin = process.env["SAYDO_DAEMON_ORIGIN"] ?? "http://127.0.0.1:47100";

function stripOrigin(): NonNullable<ProxyOptions["configure"]> {
  return (proxy) => {
    proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
    proxy.on("proxyReqWs", (proxyReq) => proxyReq.removeHeader("origin"));
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    host: "127.0.0.1", // 显式 IPv4(vite 7 缺省绑 [::1],与 daemon/probe 的 127.0.0.1 不同栈)
    port: 47120,
    strictPort: true,
    // DNS-rebinding 加固(code-review B2):proxy 剥 Origin 后 daemon 三道纵深收窄为 token 单点,
    // vite 侧补 Host 白名单——rebinding 域名的 Host 头不在名单即拒,恢复两道纵深(dev 通道专用)
    allowedHosts: ["127.0.0.1", "localhost"],
    proxy: {
      "/api": { target: daemonOrigin, changeOrigin: true, configure: stripOrigin() },
      "/dev": { target: daemonOrigin, changeOrigin: true, configure: stripOrigin() },
      "/health": { target: daemonOrigin, changeOrigin: true },
      "/ws": { target: daemonOrigin, ws: true, changeOrigin: true, configure: stripOrigin() }
    }
  }
});
