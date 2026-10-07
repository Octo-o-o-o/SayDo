# owner20 repair49：home-lock装配与第一块审读证据

代码 I：`edfb52494db22378bab9bfc8a48c8ab94442ffb3`。author 局部修复，最终独立候选验收 NOT_RUN；INCOMPLETE/RED、workflow FAILED。不是全任务通过或生产授信。

## 修复及实际验证

原48 clean CI的 waiter exit1 精确首因仍 UNKNOWN：旧 stdio=ignore，不能恢复原stderr。本轮先保留诊断做 default 控制9PASS及长TMPDIR控制6PASS/3FAIL；后者真实暴露 tsx CLI IPC socket EADDRINUSE。两组是E48+dirty诊断源，不能追认48根因。将测试worker改为 Node --import 既有tsx loader直接持有，crash-hold明确保持测试worker活跃到SIGKILL；lock产品源码、安全、期限和timeout语义不改。stderr/stdout仅保留8192B尾部，不隐藏失败exit。dirty after默认和长目录均9PASS；最终clean I长目录9PASS，首次失败均保留。

唯一完整 clean I49 `just ci` 实际exit1：contracts156/platform121/cli74/console575/daemon2940，合计3866PASS、21SKIP；home-lock通过。分发 fresh scratch empty cache 在 offline install 实际 ENOTCACHED better-sqlite3，后段及CI Python未触达。单独 `just ci-python` ruff通过、160PASS；JS shared-reader24、Python bounded-reader13边界PASS。未重复同I完整CI，未使用procedure重试。

43required为34PASS/8FAIL/1REUSED_PASS，另precommit PASS。04/06/07/08/37/38保持现役真实FAIL；35完整CI与40其中分发实际FAIL。36仅绑定原46的936对象同字节及原浏览器环境收据，64PASS限定复用，非新PW或全闭合。私有required-current.json保存每条真实argv/ref/exit/logSHA。新读API不等于旧四完整collector/finalizer已安全可resume；Git child/OS/native/mmap/heap完整通道UNKNOWN。

## 离线分发

本地缓存只找到锁定版本官方metadata；未找到better-sqlite3 13.0.3和koffi3.1.6的同integrity官方tarball。展开的同版本workspace包不是官方tarball完整性证据；错误版本缓存不能替代。保持fresh-install合同，不借workspace node_modules、重包依赖、降门或下载。下载例外/独立native验证者尚待owner答复，不提前执行。

## 第一块审读与明确结转

原160文档/46commit固定范围，实际审读documents0–26与commits0–7：26当前文档FULL，09为HUNK（当前3513–3848全文读回，1–3512尚未读）；其余26对应effective diff FULL，09 effective diff仅末段HUNK且工具截断未冒全文。11当前661行完整补读。commit003/004/005/007补丁FULL；000–002三份review_snapshot只具名canonical/journal hunk，巨大private日志/二进制仅METADATA；006实际3154–3785的checker来源图/conditions重放/scope hunk，前段与完整ledger未全文。详细每项bytes/SHA/范围、双向映射及分层判断保存在私有audit-coverage.json；第一块PARTIAL_COVERAGE，不能称完成。

现役canonical与历史提案、排产、archive源、制品及真实运行分别判读：SOURCE_FINITE采纳不等于native授信；owner18有限资源上限不是完整容量已测；C14 A unavailable、13hop/256node/depth12、admission0和全部旧RED保持。手机/真人设备、provider、Hopper后续计划不擅自实施。下一轮须补09余段、snapshot其余具名canonical/product hunks及006全ledger/hunks，并继续133文档/38commit。

## 保全与日志

162锚：原13来源/113图像/20 current paths/12题文件（600问题）/4旧helper逐bytesSHA保全；原20原始字节仍UNRECOVERED。日志私有不入Git，以下保存原名、bytes与SHA；终态及输入freeze边界以对应terminal为准，不将before/dirty ref当最终I。

| 日志 | bytes | SHA-256 | exit |
|---|---:|---|---:|
| bounded-read-I49.log | 1744 | 2e13d6200d23f4e907efca3025fac8eaee3897be039efb47f98514f3a07c2514 | 0 |
| ci-I49.log | 145754 | 6595e64af31f10ec287fb80c8a8729862e8cdb579f06b01221babd1e4507cbba | 1 |
| code-precommit.log | 370 | bf0ce3ba39a898b5b1d55728bf2431038701b6c680688b29b4be071888c467f1 | 0 |
| home-lock-direct-long.log | 587 | b091cdc4e9cd174296078b37a5268d5d270a277943a912c8e3bff4847e9e206a | 0 |
| home-lock-direct-node.log | 587 | bff4ecc77c4d817247d2485e2456ae819d8d2f79f89fe916081a8ccf26626317 | 0 |
| home-lock-final-long.log | 588 | 8fb059be945013c348af56cf6ded08521aec0697025e133930546e156234ea34 | 0 |
| home-lock-long-path.log | 5872 | 1d7078b92e0240abd648cfb97ad513aec339d60ec4107ddbbd36c2ca40b338c4 | 1 |
| home-lock-observable.log | 593 | faf257b33e85d910dcd5e1bcd447fe28a8810bb88eb242dc93f6a031f1863660 | 0 |
| precommit.log | 370 | bf0ce3ba39a898b5b1d55728bf2431038701b6c680688b29b4be071888c467f1 | 0 |
| python-I49.log | 415 | 450234c7adeec4e3fcef1978f6eebccd15f311a156173e9467c5f16fef5af532 | 0 |
| required-00.log | 328 | 8d491f796e394ad3f65e5e4f3b9ab60c02eaf3678942df66d918e70b711449a3 | 0 |
| required-01.log | 325 | 6529bbf9058bb721138cc99bcc0cd13dd45a4149df0ad5efecbeffc8be08cbcc | 0 |
| required-02.log | 526 | 3fea5e9fecd7eb62d4ab4d66a085ed074bbf1f2da4e5c75fb18c8875a814ae5c | 0 |
| required-03.log | 129 | 186e5fdf31e61e4da9d89dd82b82bfa2e77ba1c91cee748d5a0c58077b901621 | 0 |
| required-04.log | 701 | d7418179bc93ff8b8f6083230d1e3b880ac22d48b53fe6897e9dc99256716387 | 1 |
| required-05.log | 24 | 39a4213f5f6c793ae104e1709eb5a20ef438aefe6987a3dd5711636506d2259d | 0 |
| required-06.log | 21605 | 3f7c6a39bcb85471f29b5fbc58dc2f87f054edc1cfa576a94c1dfd6f8b0f945b | 1 |
| required-07.log | 3283517 | c19afb34d92e1551814b149892fb7dd0e41401223e0ef60bffd899e836618562 | 1 |
| required-08.log | 374 | 740c2ad8df4be77265899d1cffd4241ea24ddc733adb0c06b0a0e57fa81d84fa | 1 |
| required-09.log | 21 | 5ee014a32aad1a0d1112ea37f75bea272b65eca50b0730a8849dd272a20125c8 | 0 |
| required-10.log | 18814 | 4f52033471e9d64a9ec890b497b838d25357384720b44cf822440c06dc62b28d | 0 |
| required-11.log | 4691 | 85d607d26283d3c177e0b7045c49f7c5df895d5941dd35fe2297470df8d50c36 | 0 |
| required-12.log | 2021 | e6f59226a37aab2bc3b2b7acb6a32cfac91478a8d3477478038d6ca7d31b6cab | 0 |
| required-13.log | 531 | 5171873129c13c7a0cd25cf52f1c12631fc51139ab878b8a8230b357cdb76048 | 0 |
| required-14.log | 656 | adc478407cea7bfad48b1ac1fb657fe19da463a039658d2eafa74e91733364c0 | 0 |
| required-15.log | 1899 | 7517ace03217a12acefdf2e71479dab3ca5052a455206608f2456f3b5789c8d0 | 0 |
| required-16.log | 832 | a24e86aa1d4e81347d3200f867a8176c8280e8a1608096a872e42236750b7d8b | 0 |
| required-17.log | 28 | fcf9d9b005e7c8ce7b76fb3bda5028373c684533cec26d35e41c6176db8c3886 | 0 |
| required-18.log | 1931 | d9c369cc6531ee1f3f7e9401aaf38a99409a3b4ab72528a9664c79cbdda7f770 | 0 |
| required-19.log | 27 | 8b46650b1c52525eafa2b67b3cbfc74b9d7af3bf9e6a74d7f0edec511c91800c | 0 |
| required-20.log | 1156 | 917d56956c12b7674c2e638f9282e0f5b7a62883e660dd7039eb0536c96c8fda | 0 |
| required-21.log | 596 | db21c818bc449b016617b0a4fe612a62d65e07c7c87be5d0a61d3463443d51ef | 0 |
| required-22.log | 1032 | 6e1a5714e49bbeb0f6c8708bb5fc3fd66ea08a979e1e3393eed623d559361ff1 | 0 |
| required-23.log | 12272 | 62eb38ac0a5589337716b4c05271434f9e876e56f1df88bc6b49c8fc660b6ae4 | 0 |
| required-24.log | 71 | 7c413e5e18145636179f2e0bda6352a2b47903ce4b37b201fe3b7fb982688bcd | 0 |
| required-25.log | 512 | 6cb54e37c13b5eac36b23ef07aedcdc66c762b45493ebbe11704786b3295ca83 | 0 |
| required-26.log | 368 | 580e6f1f03e39a2a41adf0bbcf468acb2a16fb6cbd2ca81f69db4ae786d907e7 | 0 |
| required-27.log | 3583 | 31cf099c98f86d478a195f150e9bf4fc9dd0b10f812183814865ee58386d31ea | 0 |
| required-28.log | 82 | d360e836a6cc111c570c1c604162160bd7d8017185d5b77904a50445af4a2c20 | 0 |
| required-29.log | 47 | fd572c00a95bcd71926a73eac61d8a3912d8b530d25e42d102ad5608e1ea2060 | 0 |
| required-30.log | 23 | e97ffbbcc1ec2da64acb2b45cd94178bfa0703a13878c9345ab3f93ff96d7da3 | 0 |
| required-31.log | 67 | 663289301130eb6383ffe8eeaf085e13e9eb09eeefcc9d0405ae97c278e8e862 | 0 |
| required-32.log | 67 | 663289301130eb6383ffe8eeaf085e13e9eb09eeefcc9d0405ae97c278e8e862 | 0 |
| required-33.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 0 |
| required-34.log | 448 | 8394e399fc1db6433060ab605e25d3087af7e2fc3b75eb52abe171bf4bdc4be0 | 0 |
| required-37.log | 1715 | abfc5691ee1f89863b8a638c69e01a755cad45e14d93ba6d01c986be7cf43452 | 1 |
| required-38.log | 12730 | d5b70f8e00305bf47197e99205f0ee1d9bd3a6ba17fcdc00b1242f49a5b9e380 | 1 |
| required-39.log | 11467 | 6e9ff5e82056ef3db569c1bcf6591704ee78dfd09a8b5cb08c11520fdd13e85b | 0 |
| required-41.log | 3515 | cbe7c412c0257898244261d5106bbe7f2d73ee191dd6d82812f063a08ce1bbc9 | 0 |
| required-42.log | 104 | b30cc3e1cd52c763c116d5554c49a5a423fad9a9939e9c64f600fc2344946be8 | 0 |
| rf-census.log | 69 | 7504082de1d6f837978c38fbfd796c767ed369d4ef9a49c793f6eca72e666a9a | 0 |
| shared-read-I49.log | 1375 | a265145a32ecef3c32fe07c0441a9a367c9b4bce546b84d8cfc8809018d0d300 | 0 |

证据装配首次误用不存在的scripts/research-inventory.mjs，真实exit1（非产品故障）；随后核真实owning scripts/rf00-inventory-scan.mjs --write实际0。初次失败保留：evidence-rf-write.log 733 B / SHA-256 3f716f7efa087a6d14e31a68da60d7f57abfcd75d86b60f1af3417109134b8ef。不是第二次完整CI或重新判绿。

证据卫生实际终态（E前证据dirty范围，产品源仍I）：

- evidence-diff.log：0 B，SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，exit 0。
- evidence-doclinks.log：47 B，SHA-256 `fd572c00a95bcd71926a73eac61d8a3912d8b530d25e42d102ad5608e1ea2060`，exit 0。
- evidence-precommit.log：370 B，SHA-256 `1ec6675fc5bf4bebaa85ae3ac2bce4452a02c807587ca1904ac14bec9011e1f7`，exit 0。
- evidence-privacy-fs.log：67 B，SHA-256 `72f7af7a445bea6dc2754896cbc5db057198fd6e64485b4c5e4f5561b4d1956e`，exit 0。
- evidence-rf-census.log：69 B，SHA-256 `7504082de1d6f837978c38fbfd796c767ed369d4ef9a49c793f6eca72e666a9a`，exit 0。
- evidence-rf-check.log：368 B，SHA-256 `580e6f1f03e39a2a41adf0bbcf468acb2a16fb6cbd2ca81f69db4ae786d907e7`，exit 0。
- evidence-rf-staged.log：69 B，SHA-256 `7504082de1d6f837978c38fbfd796c767ed369d4ef9a49c793f6eca72e666a9a`，exit 0。
- evidence-rf-write.log：733 B，SHA-256 `3f716f7efa087a6d14e31a68da60d7f57abfcd75d86b60f1af3417109134b8ef`，exit 1。
