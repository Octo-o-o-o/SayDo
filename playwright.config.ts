// Playwright 冒烟(5.1/5.2):daemon 静态服务 console dist(同源保 G1),fixture 种子,11 路由渲染 + 截图基线。

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/console",
  timeout: 30_000,
  retries: 0,
  workers: 1, // 共享 daemon 进程,串行
  globalSetup: "./e2e/console/global-setup.ts",
  use: {
    viewport: { width: 1440, height: 900 },
    // W4 3.1(09 §3.3 部署约束):S3 面须经 localhost(rpId 绑定);daemon 对 127.0.0.1 页面 308 归一
    baseURL: "http://localhost:47188"
  },
  reporter: [["list"]]
});
