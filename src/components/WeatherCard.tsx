"use client";

import { Card, StatusBox } from "@/components/InfoCards";
import type { CurrentWeather, ShortTermForecast } from "@/lib/types";
import { feelsLike, forecastIcon, ridingAdvice, weatherIcon } from "@/lib/weatherAdvice";

const ADVICE_STYLE = {
  good: "bg-emerald-50 text-emerald-800",
  caution: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
} as const;

// 기상청 시각은 모두 KST — 사용자의 시간대와 무관하게 한국 시각으로 표시
const KST = "Asia/Seoul";
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { timeZone: KST, hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: KST, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const kstHour = (iso: string) => Number(new Date(iso).toLocaleString("en-US", { timeZone: KST, hour: "2-digit", hour12: false })) % 24;
const kstDay = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: KST, day: "numeric" });

type Props = {
  placeName: string | null;
  current: { data: CurrentWeather | null; loading: boolean; error: string | null };
  forecast: { data: ShortTermForecast | null; loading: boolean; error: string | null };
};

export default function WeatherCard({ placeName, current, forecast }: Props) {
  const w = current.data;
  const f = forecast.data;
  const fmt = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? "-" : `${v}${unit}`);

  if (!placeName) {
    return (
      <Card title="날씨" icon="🌤️" live>
        <StatusBox loading={false} error={null} empty="출발지를 선택하면 해당 지역 날씨를 보여 줍니다." />
      </Card>
    );
  }

  const maxPop = f?.hours.reduce((m, h) => Math.max(m, h.pop ?? 0), 0) ?? 0;
  const maxPopHour = f?.hours.find((h) => (h.pop ?? 0) === maxPop);

  return (
    <Card title="날씨" icon="🌤️" live>
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">
        📍 <b className="text-slate-700">{placeName}</b> 기준
        {(f?.grid ?? w?.grid) && (
          <span className="text-slate-400">
            {" "}
            · 기상청 격자 ({(f?.grid ?? w?.grid)!.nx}, {(f?.grid ?? w?.grid)!.ny})
          </span>
        )}
      </p>

      {/* ── 현재 관측 (초단기실황) ── */}
      <section aria-label="현재 관측">
        <SectionTitle label="지금" time={w ? `${fmtTime(w.observedAt)} 관측` : null} hint="초단기실황: 이미 측정된 값" />
        {!w ? (
          <StatusBox loading={current.loading} error={current.error} />
        ) : (
          <div className={current.loading ? "opacity-50" : ""}>
            <div className="flex items-center gap-4">
              <div className="text-4xl" aria-hidden>
                {weatherIcon(w)}
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900">{fmt(w.temperature, "°")}</div>
                <div className="text-xs text-slate-500">
                  강수 {w.precipitationType} · 체감 {fmt(feelsLike(w.temperature, w.windSpeed), "°")}
                </div>
              </div>
              <dl className="ml-auto grid grid-cols-3 gap-1.5 text-center">
                {[
                  ["바람", fmt(w.windSpeed, "m/s")],
                  ["습도", fmt(w.humidity, "%")],
                  ["강수", fmt(w.rain1h, "mm")],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-slate-50 px-1.5 py-1">
                    <dt className="text-[10px] text-slate-500">{k}</dt>
                    <dd className="text-xs font-semibold text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ul className="mt-2 space-y-1">
              {ridingAdvice(w, f?.hours).map((a) => (
                <li key={a.text} className={`rounded-lg px-3 py-1.5 text-xs ${ADVICE_STYLE[a.level]}`}>
                  💡 {a.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── 단기예보: 시간별 기온·강수확률 ── */}
      <section aria-label="단기예보" className="mt-4 border-t border-slate-100 pt-3">
        <SectionTitle
          label="시간별 예보"
          time={f ? `${fmtDateTime(f.issuedAt)} 발표` : null}
          hint="발표시각: 기상청이 예보를 낸 시각 · 아래 각 열의 시각이 예보시각"
        />
        {!f ? (
          <StatusBox loading={forecast.loading} error={forecast.error} />
        ) : f.hours.length === 0 ? (
          <StatusBox loading={false} error={null} empty="표시할 예보가 없습니다." />
        ) : (
          <div className={forecast.loading ? "opacity-50" : ""}>
            <div className="-mx-1 overflow-x-auto pb-1">
              <table className="w-max border-separate border-spacing-x-1 text-center">
                <caption className="sr-only">예보시각별 기온과 강수확률</caption>
                <thead>
                  <tr>
                    <th scope="row" className="sr-only">
                      예보시각
                    </th>
                    {f.hours.map((h, i) => {
                      const newDay = i > 0 && kstDay(h.forecastAt) !== kstDay(f.hours[i - 1].forecastAt);
                      return (
                        <th
                          key={h.forecastAt}
                          scope="col"
                          className={`min-w-10 rounded-t-md pt-1 text-[11px] font-semibold ${i === 0 ? "bg-sky-50 text-sky-700" : "text-slate-600"}`}
                        >
                          {newDay && <div className="text-[9px] font-bold text-violet-600">{kstDay(h.forecastAt)}</div>}
                          {i === 0 ? "지금" : `${kstHour(h.forecastAt)}시`}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="sr-only">
                      날씨
                    </th>
                    {f.hours.map((h, i) => (
                      <td key={h.forecastAt} className={`text-lg ${i === 0 ? "bg-sky-50" : ""}`} title={`${h.sky ?? ""} ${h.precipitationType}`}>
                        {forecastIcon(h)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="sr-only">
                      기온
                    </th>
                    {f.hours.map((h, i) => (
                      <td key={h.forecastAt} className={`text-sm font-bold text-slate-900 ${i === 0 ? "bg-sky-50" : ""}`}>
                        {fmt(h.temperature, "°")}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="sr-only">
                      강수확률
                    </th>
                    {f.hours.map((h, i) => {
                      const pop = h.pop ?? 0;
                      return (
                        <td key={h.forecastAt} className={`rounded-b-md pb-1 align-bottom ${i === 0 ? "bg-sky-50" : ""}`}>
                          <div className="mx-auto flex h-8 w-2.5 items-end overflow-hidden rounded-sm bg-slate-100" aria-hidden>
                            <div className={pop >= 60 ? "w-full bg-blue-600" : pop >= 30 ? "w-full bg-blue-400" : "w-full bg-blue-200"} style={{ height: `${pop}%` }} />
                          </div>
                          <div className={`text-[11px] font-semibold ${pop >= 30 ? "text-blue-600" : "text-slate-400"}`}>{fmt(h.pop, "%")}</div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              향후 {f.hours.length}시간 최고 강수확률{" "}
              <b className={maxPop >= 30 ? "text-blue-600" : "text-slate-800"}>{maxPop}%</b>
              {maxPopHour && maxPop > 0 && <span className="text-slate-400"> ({fmtDateTime(maxPopHour.forecastAt)} 예보)</span>}
            </p>
          </div>
        )}
      </section>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
        <dt className="font-semibold">관측시각</dt>
        <dd>{w ? `${fmtDateTime(w.observedAt)} (초단기실황 — 실제 측정값)` : "-"}</dd>
        <dt className="font-semibold">발표시각</dt>
        <dd>{f ? `${fmtDateTime(f.issuedAt)} (단기예보 — 하루 8회 02·05·08·11·14·17·20·23시 발표)` : "-"}</dd>
        <dt className="font-semibold">예보시각</dt>
        <dd>{f && f.hours.length ? `${fmtDateTime(f.hours[0].forecastAt)} ~ ${fmtDateTime(f.hours.at(-1)!.forecastAt)} (1시간 간격)` : "-"}</dd>
        <dt className="font-semibold">출처</dt>
        <dd>기상청 단기예보 조회서비스 · 모든 시각은 한국 시간(KST)</dd>
      </dl>
    </Card>
  );
}

function SectionTitle({ label, time, hint }: { label: string; time: string | null; hint: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-xs font-bold text-slate-700" title={hint}>
        {label}
      </h3>
      {time && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{time}</span>}
    </div>
  );
}
