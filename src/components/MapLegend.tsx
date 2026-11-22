"use client";

import { useState } from "react";

/**
 * 지도 범례. 카카오 로고·축척(왼쪽 아래)을 가리지 않도록 왼쪽 위에 두고 접을 수 있게 함.
 * 모바일은 기본 접힘, 데스크톱은 기본 펼침 (사용자가 누르면 그 선택을 따름).
 */
export default function MapLegend({ accidentYear }: { accidentYear: number | null }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const body = open === null ? "hidden md:block" : open ? "block" : "hidden";
  const arrow = open === null ? "▾" : open ? "▾" : "▸";

  return (
    <div className="absolute left-2 top-2 z-10 max-w-[calc(100%-4.5rem)] rounded-lg bg-white/95 text-[11px] text-slate-600 shadow">
      <button
        type="button"
        onClick={() => setOpen((v) => !(v ?? window.matchMedia("(min-width: 768px)").matches))}
        className="flex w-full items-center gap-1 px-3 py-1.5 font-bold text-slate-800"
        aria-expanded={open ?? undefined}
      >
        범례 <span className="text-slate-400 md:hidden">{open ? "▾" : "▸"}</span>
        <span className="hidden text-slate-400 md:inline">{arrow}</span>
      </button>
      <div className={`${body} space-y-0.5 px-3 pb-2`}>
        <Row swatch={<span className="h-1 w-4 rounded bg-emerald-600" />}>자전거 경로 (예시)</Row>
        <div className="pt-1 font-bold text-slate-800">따릉이 (실시간)</div>
        <Row swatch={<span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-600" />}>대여 가능 (3대 이상)</Row>
        <Row swatch={<span className="h-2.5 w-2.5 rounded-full border-2 border-amber-500" />}>잔여 적음 (1~2대)</Row>
        <Row swatch={<span className="h-2.5 w-2.5 rounded-full border-2 border-slate-400 bg-slate-100" />}>대여 불가 (0대)</Row>
        <div className="pt-1 font-bold text-slate-800">
          사고다발지역 <span className="font-normal text-violet-600">(과거 통계{accidentYear ? ` · ${accidentYear}년` : ""})</span>
        </div>
        <Row swatch={<span className="h-2.5 w-2.5 rounded-full bg-red-600" />}>위험</Row>
        <Row swatch={<span className="h-2.5 w-2.5 rounded-full bg-amber-500" />}>주의</Row>
        <Row swatch={<span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />}>참고</Row>
        <Row swatch={<span className="rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">⚠5</span>}>경로 주변 (사고 건수)</Row>
      </div>
    </div>
  );
}

function Row({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {swatch} {children}
    </div>
  );
}
