// RecordsPage page-fixture:活跃 Focus 全量记录面(复用组件 fixture)+ 已归档(重开按钮)一例。
import type { RecordsPageView } from "./RecordsPage";
import { FOCUS_DEMO } from "../../components/redesign/fixtureBase";
import { recordsFixture } from "../../components/redesign/RecordsPanel.fixture";

export const recordsPageFixtures: { name: string; view: RecordsPageView }[] = [
  { name: "活跃态(归档/放弃按钮区)", view: recordsFixture },
  {
    name: "已归档(只给重开)",
    view: {
      ...recordsFixture,
      focus: { ...FOCUS_DEMO, id: "foc_jp", title: "每天半小时日语", lifecycle: "archived", openByOwner: { human: 0, agent: 0, external: 0 } }
    }
  }
];
