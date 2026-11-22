// 장소 타입과 앱 첫 화면의 기본 출발지·목적지 (실제 장소 좌표)

export type Place = {
  id: string;
  name: string;
  address: string;
  category?: string;
  lat: number;
  lng: number;
};

export const DEFAULT_ORIGIN: Place = { id: "default-origin", name: "서울숲", address: "서울 성동구 뚝섬로 273", lat: 37.5444, lng: 127.0374 };
export const DEFAULT_DESTINATION: Place = {
  id: "default-destination",
  name: "반포 한강공원",
  address: "서울 서초구 신반포로11길 40",
  lat: 37.5105,
  lng: 126.9957,
};
