import type { ReactNode } from "react";
import type { RouteInfo } from "@/lib/mockData";
import type { AccidentMeta, AccidentSpot } from "@/lib/types";

export function LiveBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-300">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      실시간
    </span>
  );
}

export function HistoricalBadge({ year }: { year?: number | null }) {
  return (
    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-300">
      과거 통계{year ? ` · ${year}년` : ""}
    </span>
  );
}

export function SampleBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-300">
      예시 데이터
    </span>
  );
}

export function Card({
  title,
  icon,
  action,
  live = false,
  badge,
  children,
}: {
  title: string;
  icon: string;
  action?: ReactNode;
  /** true면 "실시간", false면 "예시 데이터" 배지 */
  live?: boolean;
  /** 지정하면 live 대신 이 배지를 표시 */
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span aria-hidden>{icon}</span>
          {title}
          {badge ?? (live ? <LiveBadge /> : <SampleBadge />)}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-emerald-600" />
      {label}
    </label>
  );
}

export function StatusBox({ loading, error, empty }: { loading: boolean; error: string | null; empty?: string }) {
  if (error)
    return (
      <div className="rounded-lg bg-red-50 px-3 py-3 text-xs text-red-700">
        <p className="font-semibold">데이터를 불러오지 못했습니다</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  if (loading) return <p className="py-4 text-center text-sm text-slate-400">불러오는 중…</p>;
  return <p className="py-4 text-center text-sm text-slate-500">{empty}</p>;
}

export function RouteCard({
  route,
  nearAccidents,
  corridorM,
  accidentYear,
}: {
  route: RouteInfo | null;
  /** 경로 corridorM 이내 사고다발지역 수 (데이터 미수신 시 null) */
  nearAccidents: number | null;
  corridorM: number;
  accidentYear: number | null;
}) {
  return (
    <Card title="자전거 경로" icon="🛣️">
      {!route ? (
        <p className="text-sm text-slate-500">출발지와 목적지를 선택하면 경로가 표시됩니다.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="거리 (예시 경로)" value={`${route.distanceKm}km`} />
            <Stat label="예상 시간" value={`약 ${route.durationMin}분`} />
            <Stat
              label={`주변 사고다발지역`}
              value={nearAccidents === null ? "-" : `${nearAccidents}곳`}
              tone={nearAccidents ? "text-amber-600" : "text-slate-900"}
            />
          </div>
          <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-500">
            <li>· 직선거리 {route.straightKm}km. 경로는 출발·도착을 이은 <b>가상의 곡선</b>으로, 실제 도로·자전거도로를 따르지 않습니다.</li>
            <li>· 예상 시간은 평균 15km/h를 가정한 참고값입니다.</li>
            <li>
              · 사고다발지역 수는 이 예시 경로 {corridorM}m 이내{accidentYear ? `의 ${accidentYear}년 기준` : "의"} 과거 통계입니다.
              적다고 해서 안전하다는 뜻은 아닙니다.
            </li>
          </ul>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            이 앱은 경로의 안전성을 평가하거나 보장하지 않습니다. 실제 도로 상황·교통 법규를 확인하고 주의해서 주행하세요.
          </p>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}

const SEVERITY = {
  high: { label: "위험", cls: "bg-red-100 text-red-700" },
  medium: { label: "주의", cls: "bg-amber-100 text-amber-700" },
  low: { label: "참고", cls: "bg-yellow-50 text-yellow-700" },
} as const;

export type AccidentNearRoute = AccidentSpot & { distanceM: number };

export function AccidentCard({
  nearRoute,
  totalSpots,
  corridorM,
  hasRoute,
  meta,
  loading,
  error,
  visible,
  onToggle,
  selectedId,
  onSelect,
}: {
  nearRoute: AccidentNearRoute[];
  totalSpots: number;
  corridorM: number;
  hasRoute: boolean;
  meta: AccidentMeta | null;
  loading: boolean;
  error: string | null;
  visible: boolean;
  onToggle: (v: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const year = meta?.accidentYear ?? null;
  return (
    <Card
      title="자전거 사고다발지역"
      icon="⚠️"
      badge={<HistoricalBadge year={year} />}
      action={<Toggle checked={visible} onChange={onToggle} label="지도 표시" />}
    >
      {/* 과거 정보 안내 */}
      <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] leading-relaxed text-violet-900">
        <p className="font-semibold">
          📅 과거 사고 통계입니다{year ? ` — ${year}년 1년간 발생한 사고 기준` : ""}
        </p>
        <p className="mt-0.5">
          실시간 사고·공사 정보가 아니며, 이후 도로 구조 개선 등으로 현재 상황과 다를 수 있습니다. 과거에 사고가 잦았던 곳이니 지날 때
          속도를 줄이고 주의하세요.
        </p>
      </div>

      {error || (loading && !meta) ? (
        <StatusBox loading={loading} error={error} />
      ) : (
        <>
          <p className="mb-2 text-[11px] text-slate-500">
            지도에 서울 전체 사고다발지역 <b className="text-slate-700">{totalSpots}곳</b> 표시
            {hasRoute && (
              <>
                {" "}
                · 경로 {corridorM}m 이내 <b className="text-slate-700">{nearRoute.length}곳</b>
              </>
            )}
          </p>
          {!hasRoute ? (
            <p className="py-3 text-center text-sm text-slate-500">출발지와 목적지를 선택하면 경로에서 가까운 지점을 골라 보여 줍니다.</p>
          ) : nearRoute.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-500">경로 {corridorM}m 이내에는 사고다발지역이 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-auto pr-1">
              {nearRoute.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(a.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      selectedId === a.id ? "border-violet-400 bg-violet-50" : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{a.name.replace(/^서울\s*/, "")}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${SEVERITY[a.severity].cls}`}>
                        {SEVERITY[a.severity].label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      사고 {a.accidents}건 · 사망 {a.deaths} · 중상 {a.seriousInjuries} · 경상 {a.minorInjuries}
                      {a.injuryReports > 0 && ` · 부상신고 ${a.injuryReports}`}
                    </p>
                    <p className="text-[11px] text-slate-400">경로에서 {a.distanceM}m</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-2 space-y-0.5 text-[10px] text-slate-400">
        <p>출처: 한국도로교통공단 자전거 교통사고 다발지역{year ? ` (기준연도 ${year})` : ""}</p>
        {meta?.criteria && <p>선정 기준: {meta.criteria}</p>}
        <p>
          위험·주의 등급은 앱 자체 기준(위험: 사망 또는 중상 3명 이상 또는 8건 이상). 경로가 예시이므로 &lsquo;경로 주변&rsquo;도 예시
          경로 기준입니다.
        </p>
      </div>
    </Card>
  );
}
