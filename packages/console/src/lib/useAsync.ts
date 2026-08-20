// 数据加载钩子(11 §5.9:300ms 内不闪骨架;错误走 ErrorCard)。

import { useEffect, useState } from "react";
import { ApiError, apiErrorMessage } from "./apiError";

export interface AsyncState<T> {
  data: T | null;
  /** 失败人话(既有调用点直接显示这一条;不再是 `Error: 403 /api/x` 那种天书) */
  error: string | null;
  /** 分类后的失败——仅当异常来自 daemon 传输层;UI 据此分流文案与恢复动作 */
  failure: ApiError | null;
  loading: boolean;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, failure: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null, failure: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, failure: null, loading: false }),
      (err: unknown) =>
        alive &&
        setState({
          data: null,
          error: apiErrorMessage(err),
          // 非 ApiError(页面自己的业务异常)不强行归类,免得把无关错误说成网络问题
          failure: err instanceof ApiError ? err : null,
          loading: false
        })
    );
    return () => {
      alive = false;
    };
    // deps 由调用方显式给全(fn 引用变化不触发,避免每渲染重拉)
  }, deps);
  return state;
}
