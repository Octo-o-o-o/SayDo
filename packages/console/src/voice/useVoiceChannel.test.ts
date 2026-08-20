import { describe, expect, it } from "vitest";
import { consumeNativeReplyQueue, enqueueNativeReply, type NativeReplyEvent } from "./useVoiceChannel";

function reply(sentenceId: string): NativeReplyEvent {
  return {
    sessionId: "ses_01MOBILE000000000000000000",
    turnId: "ses_01TURN00000000000000000000",
    sentenceId,
    text: sentenceId,
    origin: "assistant_reply"
  };
}

describe("M2 native reply queue", () => {
  it("连续回复逐条保留，消费旧批次时不丢随后到达项", () => {
    const firstBatch = enqueueNativeReply(enqueueNativeReply([], reply("s-1")), reply("s-2"));
    const withLateReply = enqueueNativeReply(firstBatch, reply("s-3"));
    expect(firstBatch.map((item) => item.sentenceId)).toEqual(["s-1", "s-2"]);
    expect(consumeNativeReplyQueue(withLateReply, firstBatch.length).map((item) => item.sentenceId)).toEqual(["s-3"]);
  });
});
