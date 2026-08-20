import { RUNTIME_PROTOCOL_VERSION } from "@saydo/contracts";

declare const __SAYDO_PROTOCOL_VERSION__: string | undefined;

export const CLI_PROTOCOL_VERSION =
  typeof __SAYDO_PROTOCOL_VERSION__ === "string"
    ? __SAYDO_PROTOCOL_VERSION__
    : RUNTIME_PROTOCOL_VERSION;
