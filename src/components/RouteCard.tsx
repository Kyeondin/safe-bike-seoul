"use client";

import { Card, StatusBox } from "@/components/InfoCards";
import { ROUTE_COLORS } from "@/components/KakaoMap";
import type { ApiErrorInfo } from "@/hooks/useApi";
import type { BikeRouteResult } from "@/lib/types";

type Props = {
  hasEndpoints: boolean;
  startName: string | null;
  destinationName: string | null;
  result: BikeRouteResult | null;
  loading: boolean;
  error: string | null;
  errorInfo: ApiErrorInfo | null;
  /** 경로 id → corridorM 이내 사고다발지역 수 (사고 데이터 미수신 시 null) */
  accidentCounts: Record<string, number> | null;
  corridorM: number;
  accidentYear: number | null;
};

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
const minutes = (s: number) => `약 ${Math.max(1, Math.round(s / 60))}분`;
const kstTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

export default function RouteCard(p: Props) {
  const permissionDenied = p.errorInfo?.upstream && [401, 403].includes(p.errorInfo.upstream.status);

  return (
    <Card
      title="자전거 경로"
      icon="🛣️"
      live
      // 경로가 없을 때는 '실시간'·'예시' 대신 중립 배지 (가상 경로를 쓰지 않음)
      badge={
        p.result && !p.error ? undefined : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-300">
            {p.error ? "경로 없음" : "카카오"}
          </span>
        )
      }
    >
      {!p.hasEndpoints ? (
        <p className="text-sm text-slate-500">출발지와 목적지를 선택하면 카카오 자전거 경로를 조회합니다.</p>
      ) : p.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-800">
          <p className="text-sm font-semibold">
            {permissionDenied
              ? "카카오 자전거 경로 API 권한이 없어 경로를 표시하지 않습니다"
              : "자전거 경로를 불러오지 못해 경로를 표시하지 않습니다"}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <dt className="font-semibold">실패 이유</dt>
            <dd>{p.error}</dd>
            {p.errorInfo?.upstream && (
              <>
                <dt className="font-semibold">카카오 응답</dt>
                <dd>
                  HTTP {p.errorInfo.upstream.status}
                  {p.errorInfo.upstream.message && ` · ${p.errorInfo.upstream.message}`}
                </dd>
              </>
            )}
          </dl>
          <p className="mt-2 text-[11px] text-red-700/80">임의의 경로는 만들지 않습니다.</p>
        </div>
      ) : !p.result ? (
        <StatusBox loading={p.loading} error={null} />
      ) : (
        <div className={p.loading ? "opacity-50 transition-opacity" : ""}>
          <p className="mb-2 text-[11px] text-slate-500">
            <b className="text-slate-700">{p.startName}</b> → <b className="text-slate-700">{p.destinationName}</b>
          </p>

          {/* 경로 비교 표 */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">경로별 거리, 예상 시간, 주변 사고다발지역 수</caption>
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                  <th scope="col" className="py-1.5 text-left font-semibold">경로</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">거리</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">예상 시간</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    {p.corridorM}m 내<br />사고다발지역
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.result.routes.map((r, i) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="py-2 text-left font-medium text-slate-800">
                      <span className="mr-1.5 inline-block h-1 w-4 rounded align-middle" style={{ background: ROUTE_COLORS[i] }} />
                      {r.label}
                    </th>
                    <td className="py-2 text-right font-bold text-slate-900">{km(r.distanceM)}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{minutes(r.durationS)}</td>
                    <td className="py-2 text-right font-bold text-slate-900">
                      {p.accidentCounts ? `${p.accidentCounts[r.id] ?? 0}곳` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!p.result.optionsDiffer && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              카카오 응답에서 &lsquo;자전거도로 우선&rsquo;과 &lsquo;최단 거리&rsquo; 요청 결과가 같아 경로 1개만 표시합니다. 이 경로가
              자전거도로를 우선했는지, 최단 거리인지는 응답에서 확인할 수 없습니다.
            </p>
          )}

          <details className="mt-2 text-xs">
            <summary className="cursor-pointer select-none py-1 font-semibold text-slate-600">
              구간 안내 ({p.result.routes[0].steps.length}단계)
            </summary>
            <ol className="mt-1 max-h-48 list-decimal space-y-0.5 overflow-auto pl-5 text-slate-600">
              {p.result.routes[0].steps.map((s, i) => (
                <li key={i}>{s.guidance}</li>
              ))}
            </ol>
          </details>

          <ul className="mt-2 space-y-0.5 text-[10px] leading-relaxed text-slate-400">
            <li>
              출처: 카카오 자전거 경로 · {kstTime(p.result.fetchedAt)} 조회
              {p.result.landingUrl && (
                <>
                  {" · "}
                  <a href={p.result.landingUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
                    카카오맵에서 보기
                  </a>
                </>
              )}
            </li>
            <li>
              사고다발지역 수: 한국도로교통공단 {p.accidentYear ? `${p.accidentYear}년 기준 ` : ""}과거 통계, 경로 {p.corridorM}m 이내. 적다고
              안전하다는 뜻은 아닙니다.
            </li>
          </ul>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            이 앱은 경로의 안전성을 평가하거나 보장하지 않습니다. 실제 도로 상황·교통 법규를 확인하고 주의해서 주행하세요.
          </p>
        </div>
      )}
    </Card>
  );
}
