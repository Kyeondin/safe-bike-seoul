// 카카오맵 JavaScript SDK 최소 타입 선언 (이 앱에서 사용하는 API만)
declare namespace kakao.maps {
  function load(callback: () => void): void;

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
  }

  interface MapOptions {
    center: LatLng;
    level?: number;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
    setCenter(latlng: LatLng): void;
    panTo(latlng: LatLng): void;
    getLevel(): number;
    setLevel(level: number, options?: { animate?: boolean }): void;
    relayout(): void;
    addControl(control: ZoomControl, position: number): void;
  }

  class ZoomControl {
    constructor();
  }

  const ControlPosition: { RIGHT: number; TOPRIGHT: number };

  interface PolylineOptions {
    map?: Map | null;
    path: LatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
  }

  class Polyline {
    constructor(options: PolylineOptions);
    setMap(map: Map | null): void;
  }

  interface CircleOptions {
    map?: Map | null;
    center: LatLng;
    radius: number;
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    fillColor?: string;
    fillOpacity?: number;
  }

  class Circle {
    constructor(options: CircleOptions);
    setMap(map: Map | null): void;
  }

  interface PolygonOptions {
    map?: Map | null;
    path: LatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  }

  class Polygon {
    constructor(options: PolygonOptions);
    setMap(map: Map | null): void;
  }

  interface CustomOverlayOptions {
    map?: Map | null;
    position: LatLng;
    content: HTMLElement | string;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
  }
}

interface Window {
  kakao?: typeof kakao;
}
