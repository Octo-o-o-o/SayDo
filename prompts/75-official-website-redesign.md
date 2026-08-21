# 75 · 官网重建对抗性评审

你是对抗性评审员。SayDo 官网刚完成重建,目标:最优雅、最标准、能长期使用的官网;中英双语、亮暗双主题、移动端适配;诚实标注完成度(已完成的标「现在可用」,未完成的一律 Coming soon),不做半成品。

## 被审对象(deploy/saydo-octoooo-com/,Cloudflare Pages 静态站,无构建)

- `index.html`(中文首页)
- `en/index.html`(英文首页)
- `site.css`(全站样式,含「夜账本」暗色层)
- `theme.js`(主题切换/移动菜单/滚动入场)
- `tokens.css`(亮色设计 token,console canonical 的拷贝件,未改)
- `privacy/`、`terms/`、`support/`(中文法律与支持页,仅更新骨架)

## 项目硬约束(违反 = A 级)

1. 零 emoji、零 pictographic 符号；文本状态标记使用 `[ok]` / `[fail]` / `[warn]`，文本箭头 → ↔ 合法。
2. 状态词纪律:执行状态永不说「完成/做完/done」;口径是「等你验收/ready for your review」;合并交付永远人拍板。
3. 不得暗示无人值守隔夜完成的承诺;不得承诺未落地的能力为已可用。
4. 完成度诚实:当前真实状态 = 桌面服务(daemon+console+pipeline)开源可用、CLI/BYOA 接入可用、记忆/账本可用;iOS/Android/HarmonyOS App 均未提审(只能 Coming soon);电话回叫未做。
5. 品牌:印泥朱 #b13a2b(亮色)/ 夜印朱 #d0513c(暗色);纸上账本的纸感;禁赛博霓虹/AI 星光俗套。

## 评审角度(对抗性,找问题不给好评)

- A 级:违反上述硬约束;事实错误或与产品真实状态不符的宣称;双语内容含义不一致;broken 链接/资源;移动端破版;暗色可读性(对比度)问题;a11y 硬伤(对比度、focus、aria、语义标签);SEO 硬伤(title/description/hreflang/canonical)。
- B 级:英文文案的地道性与专业感;视觉一致性与高级感(间距、对齐、层级);长文渲染边界(窄屏长词溢出);性能(未优化大图、阻塞资源)。
- C 级:锦上添花建议。

## 产出

把报告写入 `research/codex-findings/75-official-website-redesign.md`,格式:发现列表按 A/B/C 分级,每条含文件:位置、问题、建议修法;末尾给一段总评(是否可上线)。用简体中文写报告。
