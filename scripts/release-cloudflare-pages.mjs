#!/usr/bin/env node

export const CLOUDFLARE_PAGES_PROJECTS = Object.freeze(["saydo", "saydo-link"]);

const SAFE_FAILURE = "Cloudflare API 失败";
const ownedRecords = new WeakMap();

class CloudflareTrustedError extends Error {
  constructor(message) {
    super(message);
    this.name = "CloudflareTrustedError";
  }
}

class CloudflarePublicError extends Error {
  constructor(message) {
    super(message);
    this.name = "CloudflarePublicError";
  }
}

function ownError(error, message) {
  const rec = Object.freeze({ message });
  ownedRecords.set(error, rec);
  try {
    Object.defineProperty(error, "message", { value: message, writable: false, configurable: false, enumerable: false });
  } catch {
    // best-effort immutability
  }
  return error;
}

function ownedRecord(value) {
  try {
    if (value === null || value === undefined) return undefined;
    const kind = typeof value;
    if (kind !== "object" && kind !== "function") return undefined;
    return ownedRecords.get(value);
  } catch {
    return undefined;
  }
}

function ownedMessage(value) {
  const rec = ownedRecord(value);
  return rec && typeof rec.message === "string" ? rec.message : undefined;
}

function failTrusted(message) {
  throw ownError(new CloudflareTrustedError(message), message);
}

function publicError(message) {
  return ownError(new CloudflarePublicError(message), message);
}

function isArraySafe(value) {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function toPublicError(error, secrets = []) {
  try {
    const message = ownedMessage(error);
    if (typeof message === "string" && message.length > 0) {
      const redacted = redactSecrets(message, secrets);
      return publicError(typeof redacted === "string" && redacted.length > 0 ? redacted : SAFE_FAILURE);
    }
  } catch {
    return publicError(SAFE_FAILURE);
  }
  return publicError(SAFE_FAILURE);
}

export function safeErrorText(error) {
  try {
    if (typeof error === "string") return error;
    const message = ownedMessage(error);
    if (typeof message === "string") return message;
    return SAFE_FAILURE;
  } catch {
    return SAFE_FAILURE;
  }
}

export function redactSecrets(text, secrets = []) {
  if (typeof text !== "string") return SAFE_FAILURE;
  let out = text;
  try {
    if (isArraySafe(secrets)) {
      for (const secret of secrets) {
        if (typeof secret === "string" && secret.length >= 8) out = out.split(secret).join("[redacted]");
      }
    }
    return out
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/CLOUDFLARE_API_TOKEN[=:][^\s]+/gi, "CLOUDFLARE_API_TOKEN=[redacted]");
  } catch {
    return SAFE_FAILURE;
  }
}

function readOwn(object, key) {
  try {
    if (object === null || object === undefined) return { ok: false, threw: false };
    if (typeof object !== "object" && typeof object !== "function") return { ok: false, threw: false };
    return { ok: true, threw: false, value: object[key] };
  } catch {
    return { ok: false, threw: true };
  }
}

function readOwnDataValue(object, key) {
  try {
    if (object === null || object === undefined || (typeof object !== "object" && typeof object !== "function")) {
      return { missing: true };
    }
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(object, key);
    } catch {
      failTrusted("Cloudflare API 响应非法");
    }
    if (!desc) return { missing: true };
    if (typeof desc.get === "function" || typeof desc.set === "function") failTrusted("Cloudflare API 响应非法");
    if (!Object.prototype.hasOwnProperty.call(desc, "value")) failTrusted("Cloudflare API 响应非法");
    return { missing: false, value: desc.value };
  } catch (error) {
    if (ownedRecord(error)) failTrusted(ownedMessage(error) ?? "Cloudflare API 响应非法");
    failTrusted("Cloudflare API 响应非法");
  }
}

function isTrustedHttpStatus(status) {
  return typeof status === "number" && Number.isInteger(status) && status >= 0 && status <= 999;
}

export function requireCloudflareCredentials(env) {
  try {
    const source = env === undefined ? process.env : env;
    const accountIdRead = readOwn(source, "CLOUDFLARE_ACCOUNT_ID");
    const apiTokenRead = readOwn(source, "CLOUDFLARE_API_TOKEN");
    if (accountIdRead.threw || apiTokenRead.threw) failTrusted(SAFE_FAILURE);
    const accountId = typeof accountIdRead.value === "string" ? accountIdRead.value.trim() : "";
    const apiToken = typeof apiTokenRead.value === "string" ? apiTokenRead.value.trim() : "";
    if (!/^[a-f0-9]{32}$/i.test(accountId)) failTrusted("缺有效 CLOUDFLARE_ACCOUNT_ID");
    if (!(apiToken.length >= 32 && !/\s/.test(apiToken))) failTrusted("缺有效 CLOUDFLARE_API_TOKEN");
    return { accountId, apiToken };
  } catch (error) {
    const message = ownedRecord(error) ? ownedMessage(error) : undefined;
    throw new Error(typeof message === "string" && message.length > 0 ? message : SAFE_FAILURE);
  }
}

function assertUsableObject(value, message) {
  try {
    if (value === null || value === undefined || (typeof value !== "object" && typeof value !== "function")) {
      failTrusted(message);
    }
    Object.getOwnPropertyDescriptor(value, "__saydo_probe__");
  } catch (error) {
    if (ownedRecord(error)) failTrusted(ownedMessage(error) ?? message);
    failTrusted(message);
  }
}

function assertCloudflareApiEnvelopeUnchecked(payload, options) {
  if (!payload || typeof payload !== "object" || isArraySafe(payload)) {
    failTrusted("Cloudflare API 响应不是对象");
  }
  assertUsableObject(payload, "Cloudflare API 响应不是对象");
  const httpStatusRead = readOwn(options, "httpStatus");
  if (httpStatusRead.threw) failTrusted("Cloudflare API 响应非法");
  const httpStatus = httpStatusRead.ok ? httpStatusRead.value : undefined;
  if (!isTrustedHttpStatus(httpStatus) || httpStatus !== 200) {
    failTrusted(isTrustedHttpStatus(httpStatus) ? `Cloudflare API 失败: HTTP ${httpStatus}` : "Cloudflare API HTTP 状态非法");
  }
  const success = readOwn(payload, "success");
  if (success.threw) failTrusted("Cloudflare API 响应非法");
  if (!success.ok || success.value !== true) failTrusted("Cloudflare API success 非法");
  let hasErrors = false;
  try {
    hasErrors = Object.prototype.hasOwnProperty.call(payload, "errors");
  } catch {
    failTrusted("Cloudflare API 响应非法");
  }
  if (!hasErrors) failTrusted("Cloudflare API 缺 errors 字段");
  const errors = readOwn(payload, "errors");
  if (errors.threw) failTrusted("Cloudflare API 响应非法");
  if (!errors.ok || !isArraySafe(errors.value)) failTrusted("Cloudflare API errors 不是数组");
  const length = readOwn(errors.value, "length");
  if (length.threw) failTrusted("Cloudflare API 响应非法");
  if (!length.ok || typeof length.value !== "number" || !Number.isInteger(length.value) || length.value < 0) {
    failTrusted("Cloudflare API errors 不是数组");
  }
  if (length.value !== 0) failTrusted("Cloudflare API errors 非空");
  const result = readOwn(payload, "result");
  if (result.threw || !result.ok) failTrusted("Cloudflare API 响应非法");
  const expectArrayRead = readOwn(options, "expectArray");
  if (expectArrayRead.threw) failTrusted("Cloudflare API 响应非法");
  const expectArray = expectArrayRead.ok && expectArrayRead.value === true;
  const resultValue = result.value;
  if (expectArray) {
    if (!isArraySafe(resultValue)) failTrusted("Cloudflare API result 不是数组");
    assertUsableObject(resultValue, "Cloudflare API result 不是数组");
  } else if (!resultValue || typeof resultValue !== "object" || isArraySafe(resultValue)) {
    failTrusted("Cloudflare API result 不是对象");
  } else {
    assertUsableObject(resultValue, "Cloudflare API result 不是对象");
  }
  return resultValue;
}

function assertCloudflareApiEnvelopeInner(payload, options) {
  try {
    return assertCloudflareApiEnvelopeUnchecked(payload, options);
  } catch (error) {
    if (ownedRecord(error)) failTrusted(ownedMessage(error) ?? "Cloudflare API 响应非法");
    failTrusted("Cloudflare API 响应非法");
  }
}

export function assertCloudflareApiEnvelope(payload, options) {
  try {
    return assertCloudflareApiEnvelopeInner(payload, options);
  } catch (error) {
    throw toPublicError(error);
  }
}

function primitiveQueryValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function readRequestField(request, key, illegalMessage) {
  const read = readOwn(request, key);
  if (read.threw) failTrusted(illegalMessage);
  return read;
}

export async function cloudflareV4Get(request) {
  const secrets = [];
  try {
    const accountIdRead = readRequestField(request, "accountId", SAFE_FAILURE);
    const apiTokenRead = readRequestField(request, "apiToken", SAFE_FAILURE);
    if (
      !accountIdRead.ok ||
      typeof accountIdRead.value !== "string" ||
      !apiTokenRead.ok ||
      typeof apiTokenRead.value !== "string"
    ) {
      failTrusted("Cloudflare 凭证未注入");
    }
    const accountId = accountIdRead.value;
    const apiToken = apiTokenRead.value;
    secrets.push(apiToken);

    const pathRead = readRequestField(request, "path", "Cloudflare API path 非法");
    const path = pathRead.ok ? pathRead.value : undefined;
    if (typeof path !== "string" || !path.startsWith("/accounts/")) failTrusted("Cloudflare API path 非法");
    if (path.includes(apiToken)) failTrusted("Cloudflare 请求含 token");

    let url;
    try {
      url = new URL(`https://api.cloudflare.com/client/v4${path}`);
    } catch {
      failTrusted("Cloudflare API URL 非法");
    }

    const queryRead = readRequestField(request, "query", "Cloudflare API query 非法");
    let queryObject = {};
    if (queryRead.ok && queryRead.value != null) {
      if (typeof queryRead.value !== "object") failTrusted("Cloudflare API query 非法");
      queryObject = queryRead.value;
    }

    let keys;
    try {
      keys = Object.keys(queryObject);
    } catch {
      failTrusted("Cloudflare API query 非法");
    }
    if (!isArraySafe(keys)) failTrusted("Cloudflare API query 非法");
    for (const key of keys) {
      if (typeof key !== "string") failTrusted("Cloudflare API query 非法");
      const valueRead = readOwn(queryObject, key);
      if (valueRead.threw || !valueRead.ok) failTrusted("Cloudflare API query 非法");
      const value = valueRead.value;
      if (value == null || value === "") continue;
      const text = primitiveQueryValue(value);
      if (text === null) failTrusted("Cloudflare API query 非法");
      if (key.includes(apiToken) || text.includes(apiToken)) failTrusted("Cloudflare 请求含 token");
      url.searchParams.set(key, text);
    }

    const expectArrayRead = readRequestField(request, "expectArray", SAFE_FAILURE);
    const expectArray = expectArrayRead.ok && expectArrayRead.value === true;
    const fetchRead = readRequestField(request, "fetchImpl", SAFE_FAILURE);
    const fetchImpl = fetchRead.ok && fetchRead.value != null ? fetchRead.value : fetch;
    if (typeof fetchImpl !== "function") failTrusted(SAFE_FAILURE);

    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json"
      }
    });
    const statusRead = readOwn(response, "status");
    if (statusRead.threw || !statusRead.ok) failTrusted("Cloudflare API 响应非法");
    const status = statusRead.value;
    const textFnRead = readOwn(response, "text");
    if (textFnRead.threw || !textFnRead.ok || typeof textFnRead.value !== "function") {
      failTrusted("Cloudflare API 响应非法");
    }
    let text;
    try {
      text = await textFnRead.value.call(response);
    } catch {
      failTrusted("Cloudflare API 响应非法");
    }
    if (typeof text !== "string") failTrusted("Cloudflare API 响应不是文本");
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      failTrusted(
        isTrustedHttpStatus(status) ? `Cloudflare API 响应不是 JSON: HTTP ${status}` : "Cloudflare API 响应不是 JSON"
      );
    }
    return assertCloudflareApiEnvelopeInner(payload, { httpStatus: status, expectArray });
  } catch (error) {
    throw toPublicError(error, secrets);
  }
}

export async function getPagesProject(request) {
  const secrets = [];
  try {
    const accountIdRead = readRequestField(request, "accountId", SAFE_FAILURE);
    const apiTokenRead = readRequestField(request, "apiToken", SAFE_FAILURE);
    if (
      !accountIdRead.ok ||
      typeof accountIdRead.value !== "string" ||
      !apiTokenRead.ok ||
      typeof apiTokenRead.value !== "string"
    ) {
      failTrusted("Cloudflare 凭证未注入");
    }
    secrets.push(apiTokenRead.value);
    const projectRead = readRequestField(request, "project", SAFE_FAILURE);
    const project = projectRead.ok ? projectRead.value : undefined;
    if (!CLOUDFLARE_PAGES_PROJECTS.includes(project)) failTrusted("Pages project 不在允许集");
    const fetchRead = readRequestField(request, "fetchImpl", SAFE_FAILURE);
    const fetchImpl = fetchRead.ok && fetchRead.value != null ? fetchRead.value : fetch;
    const result = await cloudflareV4Get({
      accountId: accountIdRead.value,
      apiToken: apiTokenRead.value,
      path: `/accounts/${accountIdRead.value}/pages/projects/${encodeURIComponent(project)}`,
      fetchImpl
    });
    if (!result || typeof result !== "object" || isArraySafe(result)) failTrusted("project result 不能是数组");
    const nameRead = readOwnDataValue(result, "name");
    if (nameRead.missing || nameRead.value !== project) failTrusted("project name 不一致");
    return result;
  } catch (error) {
    throw toPublicError(error, secrets);
  }
}

export async function listPagesDeployments(request) {
  const secrets = [];
  try {
    const accountIdRead = readRequestField(request, "accountId", SAFE_FAILURE);
    const apiTokenRead = readRequestField(request, "apiToken", SAFE_FAILURE);
    if (
      !accountIdRead.ok ||
      typeof accountIdRead.value !== "string" ||
      !apiTokenRead.ok ||
      typeof apiTokenRead.value !== "string"
    ) {
      failTrusted("Cloudflare 凭证未注入");
    }
    secrets.push(apiTokenRead.value);
    const projectRead = readRequestField(request, "project", SAFE_FAILURE);
    const project = projectRead.ok ? projectRead.value : undefined;
    if (!CLOUDFLARE_PAGES_PROJECTS.includes(project)) failTrusted("Pages project 不在允许集");
    const environmentRead = readRequestField(request, "environment", SAFE_FAILURE);
    const environment = environmentRead.ok ? environmentRead.value : undefined;
    if (environment !== "preview" && environment !== "production") failTrusted("deployment environment 非法");
    const fetchRead = readRequestField(request, "fetchImpl", SAFE_FAILURE);
    const fetchImpl = fetchRead.ok && fetchRead.value != null ? fetchRead.value : fetch;
    const all = [];
    for (let page = 1; page <= 50; page += 1) {
      const batch = await cloudflareV4Get({
        accountId: accountIdRead.value,
        apiToken: apiTokenRead.value,
        path: `/accounts/${accountIdRead.value}/pages/projects/${encodeURIComponent(project)}/deployments`,
        query: { env: environment, page, per_page: 25 },
        expectArray: true,
        fetchImpl
      });
      if (!isArraySafe(batch)) failTrusted("Cloudflare API result 不是数组");
      const lengthRead = readOwnDataValue(batch, "length");
      if (lengthRead.missing || typeof lengthRead.value !== "number" || !Number.isInteger(lengthRead.value) || lengthRead.value < 0) {
        failTrusted("Cloudflare API result 不是数组");
      }
      for (let index = 0; index < lengthRead.value; index += 1) {
        const item = readOwnDataValue(batch, String(index));
        if (item.missing) failTrusted("Cloudflare API result 不是数组");
        all.push(item.value);
      }
      if (lengthRead.value < 25) break;
      if (page === 50) failTrusted("Cloudflare deployment 分页超过 50 页");
    }
    return all;
  } catch (error) {
    throw toPublicError(error, secrets);
  }
}
