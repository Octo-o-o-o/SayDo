# RC4 移动端提交前隐私回修

继续移动实施工作区 `<repo>`。优先 resume 原会话 `<session-id>`；不得新开分支，不得提交、push、发布、部署、查询或安装真机。

## 宿主真实红灯

提交前 staged-tree 检查发现 `scripts/test-mobile-release-contract.mjs` 为了验证“不再硬编码私人设备”，反而把旧私人设备名、UUID、Android/Harmony 序列号原文写入 `forbidden` 数组。这样最终公开树仍泄漏原值，测试目的与实施相冲突。

另有：

```text
scripts/mobile-install-common.sh:220: new blank line at EOF
```

## 修复要求

1. 从最终树彻底删除所有旧私人设备名、UUID、Android/Harmony 序列号原文；不要拆串、编码、hash 或用其他方式把这些值藏在测试中。
2. 将合同自测改为不依赖私人样本的结构性检查，至少覆盖：
   - 安装器无个人 home 绝对路径和本地 file URL；
   - 无把模拟器名写死进 xcodebuild destination 的目的地；
   - 无固定设备 UUID 参数；
   - 无把设备标识写成字面赋值的 DEVICE_ID / SAYDO_DEVICE_ID（公共库初始化为空和运行时解析除外）；
   - adb/hdc/devicectl 的安装与构建必须绑定运行时 `${SAYDO_DEVICE_ID}`，现有正向 exact snippets 继续检查；
   - Docs/README/version matrix 无本机绝对路径或固定设备标识形状。
3. 不要为了通过扫描弱化已有 68 条安装器行为测试；只最小调整 privacy contract 与必要文案。
4. 修掉 `scripts/mobile-install-common.sh` EOF 多余空行，使 `git diff --check` 绿。
5. 不改 parser、安装逻辑、CI 结构、版本号或证据结论。

门禁：

```bash
node scripts/test-mobile-release-contract.mjs
node scripts/test-mobile-installers.mjs
git grep --cached/工作树等价最终树检查（测试自身也不得含私人原文）
git diff --check
```

注意当前 index 已暂存前一版；修改后宿主会重新 `git add`。你不得提交。最终报告真实退出码并保留工作树。
