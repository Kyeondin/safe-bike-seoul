"use client";

import { useEffect, useState } from "react";
import type { NearbyStation, StationsResponse } from "@/lib/types";

type Result = {
  key: string;
  stations: NearbyStation[];
  total: number;
  fetchedAt: string | null;
  error: string | null;
};

/** 특정 지점 주변의 따릉이 대여소를 /api/stations에서 거리순으로 가져옴 */
export function useNearbyStations(center: { lat: number; lng: number } | null, radiusM: number, reloadKey = 0, limit = 30) {
  const key = center ? `${center.lat},${center.lng},${radiusM},${limit},${reloadKey}` : null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!center || !key) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      lat: String(center.lat),
      lng: String(center.lng),
      radius: String(radiusM),
      limit: String(limit),
    });

    fetch(`/api/stations?${params}`, { signal: ctrl.signal })
      .then((res) => res.json() as Promise<StationsResponse>)
      .then((json) => {
        if (!json.ok) throw new Error(json.error);
        setResult({ key, stations: json.data, total: json.total, fetchedAt: json.fetchedAt, error: null });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error = err instanceof Error ? err.message : "대여소 정보를 불러오지 못했습니다.";
        setResult({ key, stations: [], total: 0, fetchedAt: null, error });
      });

    return () => ctrl.abort();
    // key가 center·radius·limit·reloadKey를 모두 대표함
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key) return { stations: [], total: 0, fetchedAt: null, loading: false, error: null };

  const current = result?.key === key;
  return {
    // 새 요청 중에는 직전 결과를 흐리게 유지 (깜빡임 방지)
    stations: result?.stations ?? [],
    total: result?.total ?? 0,
    fetchedAt: result?.fetchedAt ?? null,
    loading: !current,
    error: current ? result.error : null,
  };
}
