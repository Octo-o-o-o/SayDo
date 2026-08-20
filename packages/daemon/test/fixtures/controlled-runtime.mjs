import { appendFileSync } from "node:fs";

const intervalEvidence = process.env["SAYDO_TEST_INTERVAL_EVIDENCE"];
const fetchEvidence = process.env["SAYDO_TEST_FETCH_EVIDENCE"];
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.setInterval = ((callback, _delay, ...args) => {
  if (intervalEvidence) appendFileSync(intervalEvidence, "interval\n");
  return nativeSetTimeout(() => callback(...args), 0);
});

globalThis.fetch = (async (input, init) => {
  if (fetchEvidence) appendFileSync(fetchEvidence, `${String(input)}\n`);
  return nativeFetch(input, init);
});
