// Netlify 빌드 중 public/supabase-config.js를 환경변수로 생성합니다.
//
// 이 파일을 저장소에 두지 않는 이유:
//   - 키를 바꿀 때 커밋이 필요 없습니다.
//   - 공개 저장소에 접속 정보를 남기지 않습니다.
//
// 필요한 환경변수 (Netlify → Site configuration → Environment variables):
//   SUPABASE_URL       필수
//   SUPABASE_ANON_KEY  필수
//   ADMIN_EMAIL        선택 (로그인 화면의 이메일 입력 칸 기본값)
//
// 로컬에서는 실행하지 않아도 됩니다. public/supabase-config.js를 직접
// 만들어 두면 그대로 쓰이고, 이 스크립트는 Netlify에서만 돌아갑니다.

const fs = require("node:fs");
const path = require("node:path");

const OUTPUT_PATH = path.join(__dirname, "..", "public", "supabase-config.js");

function required(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    console.error(`\n[generate-config] 환경변수 ${name}이(가) 비어 있습니다.`);
    console.error("[generate-config] Netlify → Site configuration → Environment variables에서 등록한 뒤 다시 배포하세요.");
    console.error("[generate-config] 이 값이 없으면 앱이 Supabase에 연결되지 않고 데모 모드로 뜨기 때문에 빌드를 중단합니다.\n");
    process.exit(1);
  }
  return value;
}

// app.js의 cleanSupabaseUrl과 같은 규칙입니다.
// /rest/v1이 붙은 주소를 넣어도 동작하도록 정리합니다.
function cleanUrl(url) {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

const config = {
  url: cleanUrl(required("SUPABASE_URL")),
  anonKey: required("SUPABASE_ANON_KEY"),
};

const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
if (adminEmail) config.adminEmail = adminEmail;

const contents = `// 이 파일은 빌드할 때 scripts/generate-config.js가 생성합니다.
// 직접 고치지 마세요. 값을 바꾸려면 Netlify 환경변수를 수정하고 다시 배포합니다.
window.KSIMATH_SUPABASE = ${JSON.stringify(config, null, 2)};
`;

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, contents, "utf8");

// 키 값 자체는 빌드 로그에 남기지 않습니다.
console.log(`[generate-config] public/supabase-config.js 생성 완료`);
console.log(`[generate-config]   url        : ${config.url}`);
console.log(`[generate-config]   anonKey    : (${config.anonKey.length}자, 로그에 남기지 않음)`);
console.log(`[generate-config]   adminEmail : ${config.adminEmail || "(미설정 — 로그인 화면 기본값 사용)"}`);
