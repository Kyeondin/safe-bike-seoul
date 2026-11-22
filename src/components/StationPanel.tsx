"use client";

import { Card, Toggle } from "@/components/InfoCards";
import { AVAILABILITY_STYLE, availabilityOf, formatDistance } from "@/lib/stationStyle";
import type { NearbyStation } from "@/lib/types";

export type StationTab = "origin" | "destination";

export const RADIUS_OPTIONS = [300, 500, 800, 1000, 1500] as const;

type Props = {
  tab: StationTab;
  onTabChange: (t: StationTab) => void;
  originName: string | null;
  destinationName: string | null;
  radius: number;
  onRadiusChange: (r: number) => void;
  stations: NearbyStation[];
  total: number;
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  visible: boolean;
  onToggleVisible: (v: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function StationPanel(p: Props) {
  const baseName = p.tab === "origin" ? p.originName : p.destinationName;
  const available = p.stations.filter((s) => s.bikes > 0).length;

  return (
    <Card title="따릉이 대여소" icon="🚲" live action={<Toggle checked={p.visible} onChange={p.onToggleVisible} label="지도 표시" />}>
      {/* 기준 위치 탭 */}
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold" role="tablist">
        {(
          [
            ["origin", "출발지 주변", "대여"],
            ["destination", "목적지 주변", "반납"],
          ] as const
        ).map(([key, label, hint]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={p.tab === key}
            onClick={() => p.onTabChange(key)}
            className={`rounded-md py-1.5 transition ${p.tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {label} <span className="font-normal text-slate-400">· {hint}</span>
          </button>
        ))}
      </div>

      {/* 반경 선택 + 새로고침 */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="검색 반경">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={p.radius === r}
              onClick={() => p.onRadiusChange(r)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                p.radius === r ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {formatDistance(r)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={p.onRefresh}
          disabled={p.loading || !baseName}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
          aria-label="대여소 정보 새로고침"
          title="새로고침"
        >
          <span className={p.loading ? "inline-block animate-spin" : ""}>↻</span>
        </button>
      </div>

      {/* 요약 */}
      {baseName && !p.error && (
        <p className="mb-2 text-[11px] text-slate-500">
          <b className="text-slate-700">{baseName}</b> 반경 {formatDistance(p.radius)} ·{" "}
          {p.loading && p.stations.length === 0 ? (
            "불러오는 중…"
          ) : (
            <>
              대여소 {p.total}곳{p.total > p.stations.length && ` 중 가까운 ${p.stations.length}곳`} · 대여 가능 {available}곳
            </>
          )}
        </p>
      )}

      {/* 본문 */}
      {!baseName ? (
        <p className="py-4 text-center text-sm text-slate-500">
          {p.tab === "origin" ? "출발지" : "목적지"}를 선택하면 주변 대여소를 거리순으로 보여 줍니다.
        </p>
      ) : p.error ? (
        <div className="rounded-lg bg-red-50 px-3 py-3 text-xs text-red-700">
          <p className="font-semibold">대여소 정보를 불러오지 못했습니다</p>
          <p className="mt-1">{p.error}</p>
          <button type="button" onClick={p.onRefresh} className="mt-2 rounded bg-white px-2 py-1 font-semibold ring-1 ring-red-200 hover:bg-red-100">
            다시 시도
          </button>
        </div>
      ) : !p.loading && p.stations.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          반경 {formatDistance(p.radius)} 안에 대여소가 없습니다.
          <br />
          <span className="text-xs">검색 반경을 넓혀 보세요.</span>
        </p>
      ) : (
        <ol className={`max-h-72 space-y-1.5 overflow-auto pr-1 transition-opacity ${p.loading ? "opacity-50" : ""}`}>
          {p.stations.map((s, i) => {
            const style = AVAILABILITY_STYLE[availabilityOf(s.bikes)];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => p.onSelect(s.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    p.selectedId === s.id ? "border-emerald-500 bg-emerald-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-4 shrink-0 text-center text-[11px] font-bold text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatDistance(s.distanceM)} · 거치대 {s.docks}개
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-bold ${style.text}`}>{s.bikes}대</div>
                    <div className="text-[10px] text-slate-400">{style.label}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-2 text-[10px] text-slate-400">
        출처: 서울 열린데이터광장 공공자전거 실시간 대여정보
        {p.fetchedAt && ` · ${new Date(p.fetchedAt).toLocaleTimeString("ko-KR")} 기준`} (최대 1분 지연)
      </p>
    </Card>
  );
}
