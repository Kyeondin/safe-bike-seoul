"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import KakaoMap from "@/components/KakaoMap";
import MapLegend from "@/components/MapLegend";
import PlaceSearch from "@/components/PlaceSearch";
import { AccidentCard, type AccidentNearRoute } from "@/components/InfoCards";
import RouteCard from "@/components/RouteCard";
import WeatherCard from "@/components/WeatherCard";
import StationPanel, { type StationTab } from "@/components/StationPanel";
import { useApi } from "@/hooks/useApi";
import { useNearbyStations } from "@/hooks/useNearbyStations";
import { distanceToPathM } from "@/lib/geo";
import type { AccidentMeta, AccidentSpot, BikeRouteResult, CurrentWeather, ShortTermForecast } from "@/lib/types";
import { DEFAULT_DESTINATION, DEFAULT_ORIGIN, type Place } from "@/lib/places";

/** 경로에서 이 거리 이내의 사고다발지역을 '경로 주변'으로 봄 */
const ACCIDENT_CORRIDOR_M = 500;

export default function SafeBikeApp() {
  const [origin, setOrigin] = useState<Place | null>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<Place | null>(DEFAULT_DESTINATION);
  const [showStations, setShowStations] = useState(true);
  const [showAccidents, setShowAccidents] = useState(true);
  const [selectedAccidentId, setSelectedAccidentId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const [stationTab, setStationTab] = useState<StationTab>("origin");
  const [radius, setRadius] = useState(800);
  const [reloadKey, setReloadKey] = useState(0);

  // 모바일에서 목록 항목을 고르면 지도가 화면 밖에 있을 수 있으므로 지도로 스크롤
  const mapAreaRef = useRef<HTMLElement>(null);
  const revealMap = useCallback(() => {
    const el = mapAreaRef.current;
    if (!el || window.matchMedia("(min-width: 768px)").matches) return;
    if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // 실데이터: 선택한 기준점(출발지/목적지) 주변 따릉이 대여소, 거리순
  const stationCenter = stationTab === "origin" ? origin : destination;
  const nearby = useNearbyStations(stationCenter, radius, reloadKey);

  // 실데이터: 카카오 자전거 경로. 출발지 주변 대여소를 선택했으면 그 대여소에서, 아니면 출발지에서 출발
  const startStation =
    stationTab === "origin" ? (nearby.stations.find((st) => st.id === selectedStationId) ?? null) : null;
  const routeStart = startStation ?? origin;
  const routeQuery =
    routeStart && destination && (routeStart.lat !== destination.lat || routeStart.lng !== destination.lng)
      ? `/api/route?fromLat=${routeStart.lat}&fromLng=${routeStart.lng}&toLat=${destination.lat}&toLng=${destination.lng}`
      : null;
  const routeApi = useApi<BikeRouteResult>(routeQuery);
  const routes = useMemo(() => routeApi.data?.routes ?? [], [routeApi.data]);
  const primaryRoute = routes[0] ?? null;

  // 실데이터: 출발지(없으면 목적지) 기준 기상청 초단기실황
  const weatherPlace = origin ?? destination;
  const weatherQuery = weatherPlace ? `lat=${weatherPlace.lat.toFixed(4)}&lng=${weatherPlace.lng.toFixed(4)}` : null;
  const weather = useApi<CurrentWeather>(weatherQuery && `/api/weather?${weatherQuery}`);
  // 실데이터: 같은 좌표 → 서버에서 기상청 격자 변환 → 단기예보 12시간
  const forecast = useApi<ShortTermForecast>(weatherQuery && `/api/forecast?${weatherQuery}&hours=12`);

  // 과거 통계: 서울 전체 사고다발지역(최신 기준연도)을 한 번 받아 지도에 모두 표시하고,
  // 경로에서 ACCIDENT_CORRIDOR_M 이내인 지점만 골라 가까운 순으로 목록에 보여 줌
  const accidentsAll = useApi<AccidentSpot[], AccidentMeta>("/api/accidents");
  const accidentsNearRoute = useMemo<AccidentNearRoute[]>(() => {
    if (!primaryRoute || !accidentsAll.data) return [];
    return accidentsAll.data
      .map((a) => ({ ...a, distanceM: distanceToPathM(a, primaryRoute.path) }))
      .filter((a) => a.distanceM <= ACCIDENT_CORRIDOR_M)
      .sort((a, b) => a.distanceM - b.distanceM || b.accidents - a.accidents);
  }, [primaryRoute, accidentsAll.data]);
  // 경로별 비교용: 각 경로 ACCIDENT_CORRIDOR_M 이내 사고다발지역 수
  const accidentCountByRoute = useMemo(() => {
    if (!accidentsAll.data) return null;
    const all = accidentsAll.data;
    return Object.fromEntries(
      routes.map((r) => [r.id, all.filter((a) => distanceToPathM(a, r.path) <= ACCIDENT_CORRIDOR_M).length]),
    );
  }, [routes, accidentsAll.data]);
  const nearRouteAccidentIds = useMemo(() => new Set(accidentsNearRoute.map((a) => a.id)), [accidentsNearRoute]);
  const selectAccident = useCallback(
    (id: string) => {
      setSelectedAccidentId((cur) => (cur === id ? null : id));
      revealMap();
    },
    [revealMap],
  );

  const selectStation = useCallback(
    (id: string) => {
      setSelectedStationId((cur) => (cur === id ? null : id));
      revealMap();
    },
    [revealMap],
  );

  const changeOrigin = (p: Place | null) => {
    setOrigin(p);
    setStationTab("origin"); // 출발지를 바꾸면 출발지 주변 대여소를 바로 보여 줌
    setSelectedStationId(null);
  };
  const changeDestination = (p: Place | null) => {
    setDestination(p);
    setSelectedStationId(null);
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setSelectedStationId(null);
    setSearchKey((k) => k + 1); // 검색창 입력값도 함께 교체
  };

  return (
    // 모바일: 페이지 전체 스크롤 (검색 → 지도 → 카드 순). 데스크톱(md+): 왼쪽 패널만 스크롤, 지도 고정
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 md:h-dvh">
      <div className="bg-amber-400 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-950 md:text-xs">
        ⚠️ 사고다발지역은 <b>과거 통계</b>이며, 이 앱은 경로의 <b>안전성을 평가하거나 보장하지 않습니다</b>.
      </div>

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        {/* 모바일에서는 contents로 풀어서 header·카드 목록이 지도 위아래로 배치되게 함 */}
        <aside className="contents border-slate-200 md:order-1 md:flex md:min-h-0 md:w-[400px] md:flex-none md:flex-col md:border-r">
          <header className="order-1 border-b border-slate-200 bg-white px-4 py-3">
            <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <span className="text-emerald-600">●</span> Safe Bike Seoul
            </h1>
            <p className="text-xs text-slate-500">서울 안전 자전거 경로 안내</p>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 space-y-2" key={searchKey}>
                <PlaceSearch label="출발지" color="#2563eb" value={origin} onChange={changeOrigin} />
                <PlaceSearch label="목적지" color="#dc2626" value={destination} onChange={changeDestination} />
              </div>
              <button
                type="button"
                onClick={swap}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                aria-label="출발지와 목적지 바꾸기"
                title="출발지 ↔ 목적지"
              >
                ⇅
              </button>
            </div>
          </header>

          <div className="order-3 space-y-3 p-4 md:flex-1 md:overflow-y-auto">
            <RouteCard
              hasEndpoints={Boolean(routeQuery)}
              startName={startStation ? `${startStation.name} (대여소)` : (origin?.name ?? null)}
              destinationName={destination?.name ?? null}
              result={routeApi.data}
              loading={routeApi.loading}
              error={routeApi.error}
              errorInfo={routeApi.errorInfo}
              accidentCounts={accidentCountByRoute}
              corridorM={ACCIDENT_CORRIDOR_M}
              accidentYear={accidentsAll.meta?.accidentYear ?? null}
            />
            <WeatherCard placeName={weatherPlace?.name ?? null} current={weather} forecast={forecast} />
            <StationPanel
              tab={stationTab}
              onTabChange={(t) => {
                setStationTab(t);
                setSelectedStationId(null);
              }}
              originName={origin?.name ?? null}
              destinationName={destination?.name ?? null}
              radius={radius}
              onRadiusChange={setRadius}
              {...nearby}
              onRefresh={() => setReloadKey((k) => k + 1)}
              visible={showStations}
              onToggleVisible={setShowStations}
              selectedId={selectedStationId}
              onSelect={selectStation}
            />
            <AccidentCard
              nearRoute={accidentsNearRoute}
              totalSpots={accidentsAll.data?.length ?? 0}
              corridorM={ACCIDENT_CORRIDOR_M}
              hasRoute={Boolean(primaryRoute)}
              meta={accidentsAll.meta}
              loading={accidentsAll.loading}
              error={accidentsAll.error}
              visible={showAccidents}
              onToggle={setShowAccidents}
              selectedId={selectedAccidentId}
              onSelect={selectAccident}
            />
          </div>
        </aside>

        <main ref={mapAreaRef} className="relative order-2 h-[50vh] min-h-72 shrink-0 md:h-auto md:flex-1">
          <KakaoMap
            origin={origin}
            destination={destination}
            routes={routes}
            stations={nearby.stations}
            searchCenter={stationCenter}
            searchRadius={radius}
            accidents={accidentsAll.data ?? []}
            nearRouteAccidentIds={nearRouteAccidentIds}
            selectedAccidentId={selectedAccidentId}
            onSelectAccident={selectAccident}
            showStations={showStations}
            showAccidents={showAccidents}
            selectedStationId={selectedStationId}
            onSelectStation={selectStation}
          />
          <MapLegend accidentYear={accidentsAll.meta?.accidentYear ?? null} />
        </main>
      </div>
    </div>
  );
}
