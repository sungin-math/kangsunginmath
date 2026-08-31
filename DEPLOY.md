# 강성인수학 사이트 배포 방법

## 1. Supabase 만들기

1. Supabase에서 새 프로젝트를 만듭니다.
2. `SQL Editor`를 열고 이 폴더의 `supabase-schema.sql` 내용을 전부 붙여 넣어 실행합니다.
3. `Authentication` > `Users`에서 선생님 관리자 계정을 하나 만듭니다.
   - 예: `teacher@example.com`
   - 비밀번호는 직접 정합니다.

## 2. 사이트에 Supabase 연결하기

1. Supabase 프로젝트의 `Project Settings` > `API`에서 아래 값을 복사합니다.
   - Project URL
   - anon public key
2. 배포용 값은 **Netlify 환경변수**에 넣습니다. (3단계에서 등록)
   `public/supabase-config.js`는 저장소에 두지 않고, 빌드할 때
   `scripts/generate-config.js`가 환경변수로 만들어 냅니다.

로컬에서 파일을 직접 열어보며 작업할 때만 `public/supabase-config.js`를
아래 내용으로 손수 만들어 둡니다. 이 파일은 Git에 올라가지 않습니다.

```js
window.KSIMATH_SUPABASE = {
  url: "복사한 Project URL",
  anonKey: "복사한 anon public key",
  adminEmail: "선생님 관리자 이메일",
};
```

`url`에는 `https://프로젝트아이디.supabase.co`까지만 넣습니다.
`/rest/v1`이 붙은 주소를 넣으면 데이터가 불러와지지 않습니다.

## 3. 학생들이 접속할 주소 만들기

GitHub 저장소를 Netlify에 연결해 자동 배포합니다.
`main`에 push하면 Netlify가 알아서 다시 배포합니다.

### 처음 한 번만 하는 설정

1. Netlify에 로그인합니다.
2. `Add new site` > `Import an existing project` > `GitHub`을 선택하고
   `sungin-math/kangsunginmath` 저장소를 고릅니다.
3. 빌드 설정은 `netlify.toml`에 이미 들어 있으므로 그대로 둡니다.
   - Build command: `node scripts/generate-config.js`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. `Site configuration` > `Environment variables`에 아래를 등록합니다.

| 이름 | 용도 |
|---|---|
| `SUPABASE_URL` | 브라우저 설정 생성 + Function |
| `SUPABASE_ANON_KEY` | 브라우저 설정 생성 + Function |
| `SUPABASE_SERVICE_ROLE_KEY` | Function 전용. 브라우저에 나가지 않습니다 |
| `STUDENT_SESSION_SECRET` | Function 전용. 학생 세션 서명 키 |
| `ADMIN_EMAIL` | 선택. 로그인 화면 이메일 칸 기본값 |

`SUPABASE_URL`과 `SUPABASE_ANON_KEY`가 비어 있으면 **빌드가 실패합니다.**
설정 없이 배포되면 앱이 데모 모드로 뜨면서 진짜 데이터가 안 보이는데,
그 상태로 학생에게 주소가 나가는 것보다 배포가 멈추는 편이 안전하기 때문입니다.

### 그 뒤로는

`git push origin main` 하면 끝입니다. 파일을 직접 올릴 일은 없습니다.

### 무엇이 실제로 공개되는가

Netlify는 저장소 전체를 내려받아 빌드하지만,
`netlify.toml`의 `publish = "public"` 설정 때문에
**웹에서 접근 가능한 것은 `public/` 안의 파일뿐입니다.**

| 위치 | 빌드에 포함 | 공개 |
|---|---|---|
| `public/` | O | O — 학생·관리자가 쓰는 화면 |
| `netlify/functions/` | O | 함수 URL로만 (`/.netlify/functions/...`) |
| `scripts/` | O | X — 빌드 중에만 실행 |
| `*.sql`, `*.md` | O | X |

예전에는 `publish = "."` 이라 저장소 전체가 서빙됐고, SQL 마이그레이션과
학생 실명·성적이 든 파일까지 누구나 내려받을 수 있었습니다.

`insert-*.sql`과 지침서는 `.gitignore`로 저장소에서도 제외했으므로
Netlify가 아예 내려받지 않습니다.

**새로 추가하는 파일은 웹에서 접근해야 할 때만 `public/`에 넣으세요.**

### 배포 후 확인

주소를 학생에게 보내기 전에 아래를 확인합니다. 앞의 두 개가 200이면
설정이 적용되지 않은 것이니 학생에게 주소를 보내지 마세요.

```
https://사이트주소/supabase-schema.sql          → 404 여야 함
https://사이트주소/insert-2026-g1-final-scores.sql → 404 여야 함
https://사이트주소/                              → 200
https://사이트주소/app.js                        → 200
```

### 이전 배포본 정리

Netlify는 예전 배포를 지우지 않고 각각 고유 주소로 보관합니다.
`publish`를 바꾸기 전에 만들어진 배포에는 SQL 파일이 그대로 남아 있으므로,
Netlify 대시보드 `Deploys`에서 과거 배포를 삭제해야 완전히 닫힙니다.

## 4. 로그인 방식

- 학생: 선생님이 사이트 관리자 화면에서 만든 `이름 / 비밀번호`로 로그인합니다.
- 관리자: Supabase Authentication에 만든 `이메일 / 비밀번호`로 로그인합니다.

## 5. 시청 기록

관리자 화면의 `시청 기록` 메뉴에서 학생이 어떤 영상의 `유튜브로 이동` 버튼을 눌렀는지 확인할 수 있습니다.

영상은 유튜브에서 재생되므로, 사이트에서 확인할 수 있는 것은 실제 재생 완료 여부가 아니라 링크 클릭 기록입니다.

## 6. 학생 명단 관리

관리자 화면의 `학생 관리`에서 학생 이름, 학교, 비밀번호, 소속 반을 등록합니다.
등록된 학생은 학년별, 반별, 학교별로 필터링해서 볼 수 있습니다.

## 참고

지금 구조는 작은 학원 운영에 맞춘 간단한 방식입니다. 학생 비밀번호는 Supabase 데이터베이스 안에 저장되므로, 학생들이 평소 쓰는 중요한 비밀번호를 재사용하지 않게 안내하는 것이 좋습니다.
