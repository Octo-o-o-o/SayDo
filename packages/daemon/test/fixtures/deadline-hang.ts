import { raceWithMonotonicDeadline } from "../../src/independentDeadline.js";

const ms = Number(process.env["SAYDO_DEADLINE_MS"] ?? "80");
await raceWithMonotonicDeadline(new Promise(() => undefined), "hang", ms).then(
  () => process.exit(0),
  () => process.exit(7)
);
