import { describe, expect, it } from "vitest";
import { reduceSessionProject, sessionProjectRoute } from "./sessionProject";

describe("session.project 投影", () => {
  it("按 session/revision 去重，乱序旧事件不能覆盖新锚", () => {
    const sessionId = "ses_current";
    const rev2 = reduceSessionProject(
      null,
      { t: "session.project", sessionId, projectId: "prj_target", projectRevision: 2, reason: "draft_reanchored" },
      sessionId
    );
    expect(rev2?.projectId).toBe("prj_target");
    expect(
      reduceSessionProject(
        rev2,
        { t: "session.project", sessionId, projectId: "prj_old", projectRevision: 1, reason: "workspace_adopted" },
        sessionId
      )
    ).toBe(rev2);
    expect(
      reduceSessionProject(
        rev2,
        { t: "session.project", sessionId: "ses_other", projectId: "prj_other", projectRevision: 3, reason: "workspace_adopted" },
        sessionId
      )
    ).toBe(rev2);
  });

  it("draft 与 migration snapshot 都形成项目对话页导航目标", () => {
    for (const reason of ["draft_created", "migration_snapshot"] as const) {
      const event = reduceSessionProject(
        null,
        { t: "session.project", sessionId: "ses_current", projectId: "prj_draft", projectRevision: 0, reason },
        "ses_current"
      );
      expect(event).not.toBeNull();
      expect(sessionProjectRoute(event!)).toBe("/p/prj_draft/chat");
    }
  });
});
