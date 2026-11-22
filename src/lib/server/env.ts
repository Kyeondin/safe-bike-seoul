import "server-only";

// 서버 전용 키. NEXT_PUBLIC_ 접두사가 없으므로 Next.js가 브라우저 번들에 넣지 않으며,
// "server-only" import 덕분에 클라이언트 컴포넌트에서 이 파일을 import하면 빌드가 실패합니다.
const SECRET_NAMES = ["SEOUL_API_KEY", "DATA_GO_KR_API_KEY", "KAKAO_REST_API_KEY"] as const;
type SecretName = (typeof SECRET_NAMES)[number];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function getSecret(name: SecretName): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigError(`${name}가 .env.local에 설정되어 있지 않습니다.`);
  return value;
}

export function isConfigured(name: SecretName): boolean {
  return Boolean(process.env[name]?.trim());
}

export const seoulAllowHttp = () => process.env.SEOUL_ALLOW_HTTP?.trim().toLowerCase() === "true";

// 로그·에러 메시지에 키가 섞여 나가지 않도록 모든 서버 키 값을 가림 (URL 인코딩된 형태 포함)
export function redact(text: string): string {
  let out = text;
  for (const name of SECRET_NAMES) {
    const v = process.env[name]?.trim();
    if (!v) continue;
    for (const form of new Set([v, encodeURIComponent(v), safeDecode(v)])) {
      if (form) out = out.split(form).join("***");
    }
  }
  return out;
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
