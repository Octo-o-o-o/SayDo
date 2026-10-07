// 生产映射与组件静态渲染的终态冲突负例；不冒充浏览器或 SQLite 运行。
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapReviewContext, pickLatestSettledRun } from "../hooks/redesign/mappers";
import { ReviewPanel } from "../components/redesign/ReviewPanel";
const tree = "a".repeat(40);
const current = {id:"run_new",attempt:2,state:"settled_review",tree_sha:tree,settle_proof_json:JSON.stringify({treeSha:tree,runId:"run_new",attempt:2}),evidence_conflict:false};
const old = {...current,id:"run_old",attempt:1,settle_proof_json:JSON.stringify({treeSha:tree,runId:"run_old",attempt:1})};
describe("重设计入口核当前执行终态",()=>{
 it.each([{acceptance:[]},{acceptance:["人工判断"]}])("空或无引用验收集也拦当前run冲突",({acceptance})=>{
  const value=mapReviewContext({task:{id:"tsk",status:"ready_for_review",route:"tier1"},package:{acceptance},runs:[old,{...current,evidence_conflict:true}],acceptanceChecks:acceptance.map(criterion=>({criterion,status:"unknown",source:"manual"}))});
  const html=renderToStaticMarkup(<ReviewPanel ctx={value}/>);
  expect(html).toContain('data-review-approve-blocked="1"');expect(html).toContain('disabled=""');expect(html).not.toContain("执行和检查都跑完了");
 });
 it("旧run冲突不会拦合法最新run",()=>{
  const value=mapReviewContext({task:{id:"tsk",status:"ready_for_review",route:"tier1"},package:{acceptance:[]},runs:[{...old,evidence_conflict:true},current]});
  expect(renderToStaticMarkup(<ReviewPanel ctx={value}/>)).toContain('data-review-approve-blocked="0"');
 });
 it.each([
  {...current,evidence_conflict:true},
  {...current,tree_sha:"bad"},
  {...current,settle_proof_json:JSON.stringify({treeSha:tree,runId:"run_new",attempt:1})},
  {...current,state:"running"}
 ])("最新run不可用于证据标签时不回退较旧run",latest=>{
  expect(pickLatestSettledRun([old,latest])).toBeUndefined();
 });
});
