// §12-1:digest 确定性 / 跨状态变更不变 / revision 变必变 / grant 篡改拒绝。

import { describe, expect, it } from "vitest";
import { computeGrantDigest, computePackageDigest, verifyPackageDigest } from "../src/digests.js";
import { buildInstallGrant, buildPackage } from "./helpers.js";

describe("§12-1 digest 确定性与签名域", () => {
  it("同签名域输入同 digest", () => {
    const a = buildPackage();
    const b = buildPackage();
    expect(a.digest).toBe(b.digest);
  });

  it("跨状态变更 digest 不变(status/approvedVia/expiresAt/createdAt 均在排除域)", () => {
    const pkg = buildPackage();
    const mutated = {
      ...pkg,
      status: "superseded" as const,
      approvedVia: { receiptId: "apr_01JD9WYX0000000000000000DD" },
      expiresAt: "2027-01-01T00:00:00Z",
      createdAt: "2020-01-01T00:00:00Z"
    };
    expect(computePackageDigest(mutated)).toBe(pkg.digest);
    expect(verifyPackageDigest(mutated)).toBeNull();
  });

  it("revision 变 digest 必变", () => {
    const pkg = buildPackage();
    const next = buildPackage({ revision: 2 });
    expect(next.digest).not.toBe(pkg.digest);
  });

  it("签名域内任一字段变 digest 必变(acceptance)", () => {
    const pkg = buildPackage();
    const changed = buildPackage({ acceptance: ["改了验收标准"] });
    expect(changed.digest).not.toBe(pkg.digest);
  });

  it("篡改内嵌 grant 字段但保留旧 grantDigest => 验包失败(递归重算)", () => {
    const grant = buildInstallGrant();
    const pkg = buildPackage({ mode: "direct_to_review" }, [grant]);
    expect(verifyPackageDigest(pkg)).toBeNull();

    // 篡改 packages 但保留旧 grantDigest(攻击面:偷换包名)
    const tampered = {
      ...pkg,
      preauthorizedEffects: [
        {
          ...grant,
          constraints: { ...grant.constraints, packages: ["evil-pkg"] }
          // grantDigest 保留旧值
        }
      ]
    };
    expect(verifyPackageDigest(tampered)).not.toBeNull();
  });

  it("grantDigest 签名域 = effect/target/constraints/downstreamTriggers/spokenForm/ttlHours", () => {
    const g = buildInstallGrant();
    expect(g.grantDigest).toBe(computeGrantDigest(g));
    expect(computeGrantDigest({ ...g, ttlHours: 24 })).not.toBe(g.grantDigest);
  });
});
