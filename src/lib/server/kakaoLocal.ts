import "server-only";
import { getSecret } from "./env";
import { cached, fetchJson, SEOUL_BOUNDS } from "./http";

// 카카오 로컬 API - 키워드로 장소 검색 (REST 키는 Authorization 헤더로 서버에서만 전송)

type KakaoKeywordResponse = {
  meta: { total_count: number; is_end: boolean };
  documents: {
    id: string;
    place_name: string;
    address_name: string;
    road_address_name: string;
    category_group_name: string;
    x: string; // 경도
    y: string; // 위도
  }[];
};

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
};

export function searchPlaces(query: string, size = 10): Promise<PlaceResult[]> {
  const key = getSecret("KAKAO_REST_API_KEY");
  return cached(`kakao:kw:${query}:${size}`, 10 * 60_000, async () => {
    const params = new URLSearchParams({
      query,
      size: String(size),
      // 서울 영역으로 검색 범위 제한 (좌하단 경도,위도,우상단 경도,위도)
      rect: `${SEOUL_BOUNDS.lngMin},${SEOUL_BOUNDS.latMin},${SEOUL_BOUNDS.lngMax},${SEOUL_BOUNDS.latMax}`,
    });
    const json = await fetchJson<KakaoKeywordResponse>(
      "카카오 로컬",
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
      { headers: { Authorization: `KakaoAK ${key}` } },
    );
    return json.documents.map((d) => ({
      id: d.id,
      name: d.place_name,
      address: d.road_address_name || d.address_name,
      category: d.category_group_name,
      lat: Number(d.y),
      lng: Number(d.x),
    }));
  });
}
