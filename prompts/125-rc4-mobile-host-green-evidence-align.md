# RC4 移动端宿主绿灯证据对齐

继续 resume 同一移动实施会话 `<session-id>`，工作区：
`<repo>`。

不得新开分支，不得提交、push、发布、部署、查询或安装真机。这是 prompt 124 后宿主真实门禁回写，先重读当前 diff 与本文件。

## 宿主新取得的真实证据

- iOS generic simulator build：exit 0，`BUILD SUCCEEDED`。
- iOS available simulator XCTest：exit 0，`DesktopProfileTests` 13/13；`VoiceStateMachineTests` 9/9；总计 22/22，`TEST SUCCEEDED`。
- Android JDK 17 + SDK 36：完整 `testDebugUnitTest + lintDebug + assembleDebug` exit 0；XML 为 18 tests、0 skipped/failures/errors。
- Harmony：当前由 ohpm 正式安装且 lock 精确匹配的缓存树 `hvigorw test` 12/12；unsigned `assembleHap` exit 0，仍有 `No signingConfig`，不等于可安装。
- installer self-test 68/68、mobile release contract 68/68；typecheck/lint/actionlint/links/emoji/diff 均绿。

## 要求

1. 最小更新 `apps/ios/README.md` 与 `docs/release/version-matrix.md` 中已经过时的“本机 Xcode 27 beta 阻断 / 结果 pending”口径，改为上面的真实 build/XCTest 结果。不要声称 CI 已在 GitHub 实跑，不要声称真机已复测，不要改变 iOS 壳 No-Go / 未上架 / 无公开下载边界。
2. 若其他本轮改动文档中存在同一句过时口径，一并最小对齐；不得扩大到无关文档重写。
3. 三端安装脚本在改为“构建前精确删除固定产物”后，`BUILD_MARKER` 变量与空 marker 文件已不再参与判定。删除三处无用的 marker 创建和 trap，保持精确预删、非 symlink regular file/directory、签名检查与 68 条安装器自测语义不变。
4. 不改 pairing parser、版本号、签名配置或 CI 结构。

## 门禁

只跑：

```bash
bash -n apps/ios/build-and-install.sh apps/android/build-and-install.sh apps/harmonyos/build-and-install.sh scripts/mobile-install-common.sh
node scripts/test-mobile-installers.mjs
node scripts/test-mobile-release-contract.mjs
node scripts/check-doc-links.mjs
bash scripts/check-emoji.sh
git diff --check
```

最终报告真实退出码；保留工作树，不提交。
