// ReviewPage page-fixture:coding(机器验+自报+人工 unknown)/writing(逐条裁决)/S3 三例,复用组件 fixture。
import type { ReviewPageView } from "./ReviewPage";
import { reviewCoding, reviewS3, reviewWriting } from "../../components/redesign/ReviewPanel.fixture";

export const reviewPageFixtures: { name: string; view: ReviewPageView }[] = [
  { name: "coding(机器验+自报降权+人工 unknown)", view: { ctx: reviewCoding, focusTitle: "月度运营报表自动化" } },
  { name: "writing(人工项逐条裁决后才放行)", view: { ctx: reviewWriting, focusTitle: "九月产品发布会讲稿" } },
  { name: "S3(Touch ID 独立按钮区)", view: { ctx: reviewS3, focusTitle: "给 SayDo 重做前端" } }
];
