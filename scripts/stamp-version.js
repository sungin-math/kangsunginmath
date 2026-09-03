// 정적 파일 버전을 내용 해시로 찍습니다.
//
// 예전에는 배포할 때마다 사람이 다섯 군데를 손으로 맞췄습니다.
//
//   public/index.html         styles.css?v= , app.js?v=
//   public/service-worker.js  CACHE_VERSION , styles.css?v= , app.js?v=
//
// 하나라도 빠뜨리면 서비스워커가 옛 app.js를 계속 내보냅니다. 학생 기기에는
// 바뀐 코드가 영영 도착하지 않는데, 오류가 나지 않으니 알아채기도 어렵습니다.
//
// 이제 public/ 안의 내용으로 해시를 만들어 빌드할 때 찍습니다.
// 내용이 바뀌면 값이 바뀌고 안 바뀌면 그대로입니다. 사람이 정할 것이 없습니다.
//
// 저장소에는 v=dev로 두어, 로컬에서 public/index.html을 그냥 열어도 됩니다.
// 이 스크립트를 로컬에서 실행하면 그 자리에 해시가 찍혀 git에 변경으로
// 잡힙니다. 되돌리려면 git checkout public/index.html public/service-worker.js.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const INDEX_PATH = path.join(PUBLIC_DIR, "index.html");
const SW_PATH = path.join(PUBLIC_DIR, "service-worker.js");

// 이 둘은 이 스크립트가 고쳐 쓰므로 해시 대상에서 뺍니다. 넣으면 순환합니다.
const EXCLUDED = new Set([INDEX_PATH, SW_PATH]);

const VERSIONED_ASSET_PATTERN = /((?:styles\.css|app\.js)\?v=)[A-Za-z0-9._-]+/g;
const CACHE_NAME_PATTERN = /(ksimath-static-)[A-Za-z0-9._-]+/g;

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(full);
      return EXCLUDED.has(full) ? [] : [full];
    })
    .sort();
}

// 줄바꿈만 다른 것은 같은 내용으로 봅니다.
// Windows에서 git이 체크아웃하면 CRLF가 되고 Netlify(리눅스)에서는 LF라,
// 정규화하지 않으면 같은 코드인데 값이 달라집니다. 이미지 같은 이진 파일은
// 건드리면 안 되므로 확장자로 구분합니다.
const TEXT_EXTENSIONS = new Set([".js", ".css", ".html", ".json", ".webmanifest", ".svg", ".txt", ".md"]);

function contentForHash(file) {
  const buffer = fs.readFileSync(file);
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return buffer;
  return Buffer.from(buffer.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

// supabase-config.js도 포함됩니다. generate-config.js가 먼저 돌기 때문에
// 키나 URL이 바뀌어도 캐시가 갱신됩니다.
function assetVersion(files) {
  const hash = crypto.createHash("sha256");
  files.forEach((file) => {
    // 경로도 넣습니다. 파일 이름만 바뀌어도 값이 달라져야 합니다.
    hash.update(path.relative(PUBLIC_DIR, file).replace(/\\/g, "/"));
    hash.update(contentForHash(file));
  });
  return hash.digest("hex").slice(0, 12);
}

function stamp(filePath, version) {
  const before = fs.readFileSync(filePath, "utf8");
  const after = before
    .replace(VERSIONED_ASSET_PATTERN, `$1${version}`)
    .replace(CACHE_NAME_PATTERN, `$1${version}`);
  if (before !== after) fs.writeFileSync(filePath, after, "utf8");
  return after;
}

// 찍은 뒤 파일마다 기대한 개수만큼 바뀌었는지 확인합니다.
//
// 두 파일의 결과를 합쳐서 세면 안 됩니다. 한쪽이 통째로 비어도 다른 쪽이
// 맞으면 통과해버리는데, 그게 바로 잡아야 할 경우입니다.
//
// 예전 방식이 위험했던 이유가 "빠뜨려도 조용히 넘어간다"는 점이었으므로
// 여기서는 어긋나면 빌드를 세웁니다.
const EXPECTATIONS = [
  { file: INDEX_PATH, label: "public/index.html", assets: 2, cacheNames: 0 },
  { file: SW_PATH, label: "public/service-worker.js", assets: 2, cacheNames: 1 },
];

function assetRefs(text) {
  return [...text.matchAll(/((?:styles\.css|app\.js)\?v=[A-Za-z0-9._-]+)/g)].map((match) => match[1]);
}

function cacheNames(text) {
  return [...text.matchAll(/ksimath-static-[A-Za-z0-9._-]+/g)].map((match) => match[0]);
}

function fail(lines) {
  console.error("");
  lines.forEach((line) => console.error(`[stamp-version] ${line}`));
  console.error(`[stamp-version] 이대로 배포하면 서비스워커가 옛 파일을 계속 내보냅니다.`);
  console.error("");
  process.exit(1);
}

const files = collectFiles(PUBLIC_DIR);
const version = assetVersion(files);
const texts = new Map(EXPECTATIONS.map((item) => [item.label, stamp(item.file, version)]));

EXPECTATIONS.forEach((expectation) => {
  const text = texts.get(expectation.label);
  const refs = assetRefs(text);
  const names = cacheNames(text);
  const wrong = [...refs, ...names].filter((item) => !item.endsWith(version));
  if (refs.length !== expectation.assets || names.length !== expectation.cacheNames || wrong.length) {
    fail([
      `${expectation.label}의 버전 문자열이 기대와 다릅니다.`,
      `  기대: styles.css?v= / app.js?v= ${expectation.assets}개, ksimath-static- ${expectation.cacheNames}개`,
      `  실제: 각각 ${refs.length}개, ${names.length}개`,
      wrong.length ? `  값이 안 바뀐 것: ${wrong.join(", ")}` : `  기대한 값: ${version}`,
    ]);
  }
});

// 서비스워커의 fetch 핸들러는 STATIC_FILES와 요청 URL을 pathname+search로
// 정확히 비교하므로 두 파일의 ?v= 값이 같아야 합니다. 위 검사가 이미
// 파일마다 "전부 이번 버전인가"를 보므로 따로 대조하지 않습니다.
// 어긋난 값은 찍는 과정에서 교정되기 때문에, 대조 검사를 넣어도 통과 뒤에는
// 절대 실패할 수 없습니다. 그런 검사는 검사가 있다는 착각만 남깁니다.

console.log(`[stamp-version] 정적 파일 버전 ${version} (대상 ${files.length}개 파일의 내용 해시)`);
console.log(`[stamp-version]   public/index.html`);
console.log(`[stamp-version]   public/service-worker.js (CACHE_VERSION = ksimath-static-${version})`);
