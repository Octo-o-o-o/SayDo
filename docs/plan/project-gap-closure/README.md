# project-gap-closure

本目录是 PG-01A 的历史收据与冻结 control,只读。不是排产现势源,收口后不要把它当成第三个现势指针。

当前现势只在 [`../IMPLEMENTATION-PLAN-2.md`](../IMPLEMENTATION-PLAN-2.md) 顶部 schedule-pointer 块;`HANDOFF.md` §1.1 生成块由 [`../../../scripts/schedule-pointer.mjs`](../../../scripts/schedule-pointer.mjs) `--render` 投影。

本目录文件:

- [`control.json`](./control.json) / [`policy.frozen.json`](./policy.frozen.json):PG-01A cycle 冻结
- [`fg1-review-1.receipt.json`](./fg1-review-1.receipt.json) / [`fg1-repair-1.receipt.json`](./fg1-repair-1.receipt.json) / [`fg1-carry-in-red.md`](./fg1-carry-in-red.md):PG-01A focused 收据

cycle-state 在同级 [`../project-gap-closure-cycle.json`](../project-gap-closure-cycle.json),同样只读历史。
