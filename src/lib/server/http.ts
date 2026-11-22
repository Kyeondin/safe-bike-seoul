import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ConfigError, redact } from "./env";

/** 클라이언트에 그대로 보여 줘도 되는 메시지를 가진 에러 (업스트림 URL·키를 담지 않음) */
export class UpstreamError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public readonly status = 502,
    /** 업스트림이 돌려준 HTTP 상태와 오류 메시지 (키는 가려진 상태) */
    public readonly upstream?: { status: number; message: string | null },
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** 업스트림 오류 본문에서 사람이 읽을 메시지만 추출 (JSON의 message/msg/errorType) */
function upstreamMessage(body: string): string | null {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const parts = [j.errorType, j.message ?? j.msg].filter((v) => typeof v === "string" && v);
    return parts.length ? redact(parts.join(": ")).slice(0, 200) : null;
  } catch {
    return null;
  }
}

export class BadRequestError extends Error {
  readonly status = 400;
}

type FetchOptions = { headers?: Record<string, string>; timeoutMs?: number };

/** 업스트림 호출. 실패 시 URL(키 포함 가능)을 노출하지 않는 UpstreamError로 변환 */
export async function fetchText(source: string, url: string, opts: FetchOptions = {}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: opts.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    console.error(`[${source}] fetch failed:`, redact(String((err as Error)?.cause ?? err)));
    throw new UpstreamError(source, timedOut ? "외부 API 응답 시간이 초과되었습니다." : "외부 API에 연결할 수 없습니다.", 504);
  }
  const body = await res.text();
  if (!res.ok) {
    console.error(`[${source}] HTTP ${res.status}:`, redact(body.slice(0, 300)));
    const status = res.status === 401 || res.status === 403 ? 502 : res.status === 429 ? 429 : 502;
    const msg =
      res.status === 401 || res.status === 403
        ? "외부 API 인증에 실패했습니다. 서버의 API 키를 확인하세요."
        : res.status === 429
          ? "외부 API 호출 한도를 초과했습니다."
          : `외부 API 오류 (HTTP ${res.status})`;
    throw new UpstreamError(source, msg, status, { status: res.status, message: upstreamMessage(body) });
  }
  return body;
}

export async function fetchJson<T>(source: string, url: string, opts?: FetchOptions): Promise<T> {
  const text = await fetchText(source, url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`[${source}] non-JSON response:`, redact(text.slice(0, 300)));
    // 공공데이터포털은 인증 오류를 JSON 요청에도 XML로 돌려줌
    const authMsg = text.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>/)?.[1];
    if (authMsg) throw new UpstreamError(source, `외부 API 인증 오류: ${authMsg}`);
    // 서울 열린데이터광장도 인증 오류 등은 JSON 요청에 XML로 응답: <RESULT><CODE>INFO-100</CODE><MESSAGE>...</MESSAGE>
    const seoulCode = text.match(/<CODE>([^<]+)<\/CODE>/)?.[1];
    if (seoulCode) {
      const msg = text.match(/<MESSAGE>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/MESSAGE>/)?.[1]?.trim() ?? "";
      throw new UpstreamError(source, seoulErrorMessage(seoulCode, msg));
    }
    const errMsg = text.match(/<errMsg>([^<]+)<\/errMsg>/)?.[1];
    throw new UpstreamError(source, `외부 API 응답 형식 오류${errMsg ? `: ${errMsg}` : ""}`);
  }
}

/** 서울 열린데이터광장 결과 코드 → 사용자 메시지 */
export function seoulErrorMessage(code: string, message: string) {
  if (code === "INFO-100") return "외부 API 인증에 실패했습니다. 서버의 서울시 API 키를 확인하세요. (INFO-100)";
  if (code === "INFO-300") return "서울시 API 키가 사용 제한 상태입니다. (INFO-300)";
  return `서울시 API 오류: ${code}${message ? ` ${message}` : ""}`;
}

/** 공공데이터포털 serviceKey: 이미 URL 인코딩된 키(Encoding 키)면 그대로, 아니면 인코딩 */
export function encodeServiceKey(key: string) {
  return /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
}

/** 간단한 메모리 TTL 캐시 + 동시 요청 합치기 (외부 API 호출 한도 보호) */
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { expires: now + ttlMs, value });
  value.catch(() => cache.delete(key)); // 실패는 캐시하지 않음
  return value;
}

/** Route Handler 공통 응답 */
export function ok(data: unknown, meta: Record<string, unknown> = {}) {
  return Response.json({ ok: true, isSample: false, ...meta, data });
}

export function fail(err: unknown) {
  unstable_rethrow(err); // Next.js 내부 제어 흐름 에러는 그대로 전달
  if (err instanceof BadRequestError) {
    return Response.json({ ok: false, error: err.message }, { status: 400 });
  }
  if (err instanceof ConfigError) {
    console.error("[config]", err.message);
    return Response.json({ ok: false, error: "서버 설정 오류: " + err.message }, { status: 503 });
  }
  if (err instanceof UpstreamError) {
    return Response.json(
      { ok: false, source: err.source, error: err.message, ...(err.upstream && { upstream: err.upstream }) },
      { status: err.status },
    );
  }
  console.error("[api] unexpected:", redact(String((err as Error)?.stack ?? err)));
  return Response.json({ ok: false, error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
}

export function numberParam(params: URLSearchParams, name: string, opts: { min: number; max: number; fallback?: number }) {
  const raw = params.get(name);
  if (raw === null || raw === "") {
    if (opts.fallback !== undefined) return opts.fallback;
    throw new BadRequestError(`'${name}' 파라미터가 필요합니다.`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < opts.min || n > opts.max) {
    throw new BadRequestError(`'${name}'는 ${opts.min}~${opts.max} 범위의 숫자여야 합니다.`);
  }
  return n;
}

/** 서울 대략 범위 (위경도 검증용) */
export const SEOUL_BOUNDS = { latMin: 37.4, latMax: 37.72, lngMin: 126.75, lngMax: 127.2 };

export function latLngParams(params: URLSearchParams) {
  return {
    // 서울 경계 + 여유 0.2° (수도권 인접 지역 허용)
    lat: numberParam(params, "lat", { min: 37.2, max: 37.92 }),
    lng: numberParam(params, "lng", { min: 126.55, max: 127.4 }),
  };
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
