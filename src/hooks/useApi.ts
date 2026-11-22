"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@/lib/types";

type Result<T, M> = { url: string; data: T | null; meta: M | null; error: string | null };

/** GET API Route 호출. url이 null이면 호출하지 않음. url이 바뀌면 자동 재요청 */
export function useApi<T, M = object>(url: string | null) {
  const [result, setResult] = useState<Result<T, M> | null>(null);

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((res) => res.json() as Promise<ApiResponse<T, M>>)
      .then((json) => {
        if (!json.ok) throw new Error(json.error);
        const { data, ...meta } = json;
        setResult({ url, data, meta: meta as unknown as M, error: null });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({ url, data: null, meta: null, error: err instanceof Error ? err.message : "데이터를 불러오지 못했습니다." });
      });
    return () => ctrl.abort();
  }, [url]);

  if (!url) return { data: null, meta: null, loading: false, error: null };
  const current = result?.url === url;
  return {
    data: current ? result.data : null,
    meta: current ? result.meta : null,
    loading: !current,
    error: current ? result.error : null,
  };
}
