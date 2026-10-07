// 在存储方法内部读取浏览器 getter，让调用方的读写失败分支同时涵盖 SecurityError。
export const sessionStoragePort: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, value),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key)
};
