# RC4 移动线追加返工：Linux root 下不可读 fixture 必须稳定

继续同一移动线实施会话。上轮已经修正 `RENAME_EXCHANGE`，不要回退；现在只处理独立评审确认、但上轮启动后才补入返工单的第二个 P2。不提交、不推送、不联网、不发布。

## 已验证问题

`scripts/test-mobile-release-contract.mjs` 当前用 `chmod(000)` 假设目录一定不可读。Linux UID 0 仍可读取，独立评审真实运行完整入口得到 200/202、exit 1；第二个失败是第一个断言中断后的收尾状态级联。非 root Linux 与 macOS 通过不代表 root 稳定。

## 验收

1. 把“不可读目录 fail-closed”改成不依赖调用用户 UID、DAC bypass 或宿主权限的确定性失败注入/受控对象类型。
2. 反例必须仍经过产品扫描入口或等价的公开测试 seam，证明读取/枚举失败会 fail-closed；不能删断言、恒真、只测 mock 自身，不能削弱 symlink/non-regular/TOCTOU 合同。
3. 成功与异常路径均证明 cwd 恢复到相同 dev/ino，FD 数不增加；fixture cleanup 不能因第一个断言失败而污染后续测试。
4. macOS、Linux arm64 非 root、Linux arm64 root 的完整 `node scripts/test-mobile-release-contract.mjs` 都必须物理 exit 0；预期总数在同一平台一致，并明确输出该确定性反例通过。
5. 重跑 pairing 216、installers 128、typecheck、lint、emoji、doc-links、diff-check、actionlint。无本地 Linux 依赖时诚实标注，由主会话补跑；不要联网拉包。

只改直接相关测试或为测试提供的最小显式 seam；如必须改产品代码，先证明原因并保持 fail-closed。
