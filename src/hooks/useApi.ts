"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@/lib/types";

/** 실패 응답의 부가 정보 (업스트림 상태·메시지) */
export type ApiErrorInfo = { source?: string; upstream?: { status: number; message: string | null } };

type Result<T, M> = { url: string; data: T | null; meta: M | null; error: string | null; errorInfo: ApiErrorInfo | null };

class ApiError extends Error {
  constructor(
    message: string,
    public readonly info: ApiErrorInfo,
  ) {
    super(message);
  }
}

/** GET API Route 호출. url이 null이면 호출하지 않음. url이 바뀌면 자동 재요청 */
export function useApi<T, M = object>(url: string | null) {
  const [result, setResult] = useState<Result<T, M> | null>(null);

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((res) => res.json() as Promise<ApiResponse<T, M>>)
      .then((json) => {
        if (!json.ok) {
          const { source, upstream } = json as { source?: string; upstream?: ApiErrorInfo["upstream"] };
          throw new ApiError(json.error, { source, upstream });
        }
        const { data, ...meta } = json;
        setResult({ url, data, meta: meta as unknown as M, error: null, errorInfo: null });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({
          url,
          data: null,
          meta: null,
          error: err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.",
          errorInfo: err instanceof ApiError ? err.info : null,
        });
      });
    return () => ctrl.abort();
  }, [url]);

  if (!url) return { data: null, meta: null, loading: false, error: null, errorInfo: null };
  const current = result?.url === url;
  return {
    data: current ? result.data : null,
    meta: current ? result.meta : null,
    loading: !current,
    error: current ? result.error : null,
    errorInfo: current ? result.errorInfo : null,
  };
}
