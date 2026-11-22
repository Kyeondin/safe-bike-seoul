"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { RouteInfo } from "@/lib/mockData";
import type { Place } from "@/lib/places";
import { AVAILABILITY_STYLE, availabilityOf } from "@/lib/stationStyle";
import type { AccidentSpot, NearbyStation } from "@/lib/types";

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

type Props = {
  origin: Place | null;
  destination: Place | null;
  route: RouteInfo | null;
  stations: NearbyStation[];
  /** 대여소 검색 반경을 그릴 기준점 */
  searchCenter: { lat: number; lng: number } | null;
  searchRadius: number;
  /** 서울 전체 사고다발지역 */
  accidents: AccidentSpot[];
  /** 경로 주변으로 판정된 사고다발지역 id (강조 표시) */
  nearRouteAccidentIds: Set<string>;
  selectedAccidentId: string | null;
  onSelectAccident: (id: string) => void;
  showStations: boolean;
  showAccidents: boolean;
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
};

type Status = "loading" | "ready" | "error" | "no-key";
type Layer = { setMap(m: kakao.maps.Map | null): void };

const SEVERITY_COLOR = { high: "#dc2626", medium: "#f59e0b", low: "#eab308" } as const;

const ll = (p: { lat: number; lng: number }) => new kakao.maps.LatLng(p.lat, p.lng);

/** 레이어 묶음을 지도에서 제거하고 새로 그리는 헬퍼 */
function useLayerGroup() {
  const ref = useRef<Layer[]>([]);
  return (next: Layer[]) => {
    ref.current.forEach((l) => l.setMap(null));
    ref.current = next;
  };
}

export default function KakaoMap(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const [status, setStatus] = useState<Status>(KAKAO_KEY ? "loading" : "no-key");
  const replaceRouteLayers = useLayerGroup();
  const replaceStationLayers = useLayerGroup();
  const replaceAccidentLayers = useLayerGroup();

  const initMap = () => {
    window.kakao?.maps.load(() => {
      if (!containerRef.current || mapRef.current) return;
      const map = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(37.5326, 127.0246),
        level: 7,
      });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      mapRef.current = map;
      setStatus("ready");
    });
  };

  // 컨테이너 크기 변화 시 지도 레이아웃 재계산
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => mapRef.current?.relayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const {
    origin,
    destination,
    route,
    stations,
    searchCenter,
    searchRadius,
    accidents,
    showStations,
    showAccidents,
    selectedStationId,
    onSelectStation,
    nearRouteAccidentIds,
    selectedAccidentId,
    onSelectAccident,
  } = props;

  // 1) 경로 + 출발/도착 핀. 이 값들이 바뀔 때만 화면 범위를 맞춤
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const layers: Layer[] = [];
    const bounds = new kakao.maps.LatLngBounds();

    if (route) {
      const path = route.path.map(ll);
      // 외곽선 + 본선으로 경로를 두 번 그려 가독성 확보
      layers.push(new kakao.maps.Polyline({ map, path, strokeWeight: 9, strokeColor: "#ffffff", strokeOpacity: 0.9 }));
      layers.push(new kakao.maps.Polyline({ map, path, strokeWeight: 5, strokeColor: "#16a34a", strokeOpacity: 0.95 }));
      path.forEach((p) => bounds.extend(p));
    }

    const pin = (p: Place, label: string, color: string) => {
      const el = document.createElement("div");
      el.className = "flex flex-col items-center";
      const tag = document.createElement("div");
      tag.className = "whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-white shadow-lg";
      tag.style.background = color;
      tag.textContent = `${label} · ${p.name}`;
      const tail = document.createElement("div");
      tail.className = "h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent";
      tail.style.borderTopColor = color;
      el.append(tag, tail);
      layers.push(new kakao.maps.CustomOverlay({ map, position: ll(p), content: el, yAnchor: 1, zIndex: 10 }));
      bounds.extend(ll(p));
    };
    if (origin) pin(origin, "출발", "#2563eb");
    if (destination) pin(destination, "도착", "#dc2626");

    if (origin && destination) map.setBounds(bounds, 60, 60, 60, 60);
    else if (origin || destination) {
      map.setCenter(ll((origin ?? destination)!));
      map.setLevel(4);
    }
    replaceRouteLayers(layers);
  }, [status, origin, destination, route]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) 따릉이 대여소 마커 + 검색 반경
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const layers: Layer[] = [];

    if (showStations) {
      if (searchCenter) {
        layers.push(
          new kakao.maps.Circle({
            map,
            center: ll(searchCenter),
            radius: searchRadius,
            strokeWeight: 1.5,
            strokeColor: "#059669",
            strokeOpacity: 0.7,
            strokeStyle: "dash",
            fillColor: "#10b981",
            fillOpacity: 0.06,
          }),
        );
      }
      stations.forEach((s) => {
        const selected = s.id === selectedStationId;
        const style = AVAILABILITY_STYLE[availabilityOf(s.bikes)];
        const el = document.createElement("button");
        el.type = "button";
        el.className = `flex items-center gap-0.5 rounded-full border-2 px-1.5 py-0.5 text-xs font-bold shadow-md transition ${
          selected ? `${style.markerSelected} scale-125` : style.marker
        }`;
        el.textContent = `🚲${s.bikes}`;
        el.title = `${s.name} · 자전거 ${s.bikes}대 / 거치대 ${s.docks}개`;
        el.onclick = () => onSelectStation(s.id);
        layers.push(new kakao.maps.CustomOverlay({ map, position: ll(s), content: el, yAnchor: 0.5, zIndex: selected ? 6 : 3 }));
      });
    }
    replaceStationLayers(layers);
  }, [status, stations, showStations, searchCenter, searchRadius, selectedStationId, onSelectStation]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3) 사고다발지역: 전체는 범위(폴리곤)+작은 점, 경로 주변은 건수 배지로 강조
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const layers: Layer[] = [];
    if (showAccidents) {
      accidents.forEach((a) => {
        const color = SEVERITY_COLOR[a.severity];
        const near = nearRouteAccidentIds.has(a.id);
        const selected = a.id === selectedAccidentId;

        if (a.polygon.length > 2) {
          layers.push(
            new kakao.maps.Polygon({
              map,
              path: a.polygon.map(ll),
              strokeWeight: selected ? 3 : near ? 2 : 1,
              strokeColor: color,
              strokeOpacity: near || selected ? 0.9 : 0.5,
              strokeStyle: near || selected ? "solid" : "shortdash",
              fillColor: color,
              fillOpacity: selected ? 0.3 : near ? 0.2 : 0.08,
              zIndex: 1,
            }),
          );
        }

        const el = document.createElement("button");
        el.type = "button";
        el.title = `${a.name} · 사고 ${a.accidents}건 (사망 ${a.deaths}, 중상 ${a.seriousInjuries}) · 과거 통계`;
        el.style.background = color;
        el.onclick = () => onSelectAccident(a.id);
        if (near || selected) {
          el.className = `flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full border-2 border-white px-1 text-xs font-bold text-white shadow-md ${
            selected ? "scale-125 ring-2 ring-violet-500" : ""
          }`;
          el.textContent = `⚠${a.accidents}`;
        } else {
          el.className = "h-3 w-3 rounded-full border border-white opacity-80 shadow";
          el.setAttribute("aria-label", el.title);
        }
        layers.push(
          new kakao.maps.CustomOverlay({ map, position: ll(a), content: el, yAnchor: 0.5, zIndex: selected ? 7 : near ? 4 : 2 }),
        );
      });
    }
    replaceAccidentLayers(layers);
  }, [status, accidents, showAccidents, nearRouteAccidentIds, selectedAccidentId, onSelectAccident]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3-1) 사고다발지역을 고르면 그 위치로 이동
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !selectedAccidentId) return;
    const a = accidents.find((x) => x.id === selectedAccidentId);
    if (!a) return;
    if (map.getLevel() > 4) map.setLevel(4);
    map.panTo(ll(a));
  }, [status, selectedAccidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4) 목록에서 대여소를 고르면 지도를 그 위치로 이동
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !selectedStationId) return;
    const s = stations.find((x) => x.id === selectedStationId);
    if (!s) return;
    if (map.getLevel() > 4) map.setLevel(4);
    map.panTo(ll(s));
  }, [status, selectedStationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full">
      {KAKAO_KEY && (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`}
          strategy="afterInteractive"
          onReady={initMap}
          onError={() => setStatus("error")}
        />
      )}
      <div ref={containerRef} className="h-full w-full bg-slate-200" />

      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-sm rounded-xl bg-white p-5 text-center shadow">
            {status === "loading" && <p className="text-sm text-slate-600">카카오맵을 불러오는 중…</p>}
            {status === "no-key" && (
              <>
                <p className="font-semibold text-slate-800">카카오 JavaScript 키가 없습니다</p>
                <p className="mt-2 text-sm text-slate-600">
                  <code className="rounded bg-slate-100 px-1">.env.local</code>에{" "}
                  <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_KAKAO_JS_KEY</code>를 설정한 뒤 개발 서버를 다시
                  시작하세요.
                </p>
              </>
            )}
            {status === "error" && (
              <>
                <p className="font-semibold text-slate-800">카카오맵 SDK를 불러오지 못했습니다</p>
                <p className="mt-2 text-sm text-slate-600">
                  키가 올바른지, 카카오 개발자 콘솔의 플랫폼 → Web 사이트 도메인에{" "}
                  <code className="rounded bg-slate-100 px-1">http://localhost:3000</code>이 등록되어 있는지 확인하세요.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
