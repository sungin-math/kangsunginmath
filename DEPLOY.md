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

   > **저장소가 목록에 안 보여도 그냥 진행하지 마세요.**
   >
   > Netlify GitHub 앱에 그 저장소 접근 권한이 없으면 목록에 뜨지 않습니다.
   > 이때 계속 진행하면 Netlify가 **지금 배포본으로 새 저장소를 만들어** 연결합니다.
   > 그 저장소는 업로드된 파일을 그대로 스냅샷 뜬 것이라 `.gitignore`가 적용되지
   > 않고, 학생 실명·성적·성적표 이미지까지 공개 저장소로 나갑니다.
   >
   > 목록에 없으면 화면 아래 `Configure the Netlify app on GitHub`을 눌러
   > `Repository access`에 `kangsunginmath`를 추가하고 돌아와 새로고침하세요.
   >
   > 2026-09-02에 실제로 이 일이 있었습니다. `sungin-math-kangsunginmath`라는
   > 저장소가 자동 생성되어 이틀간 공개됐고, 동시에 push한 코드가 배포되지
   > 않아 로그인 시도 제한이 적용되지 않은 상태였습니다.
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
| `ADMIN_EMAIL` | 관리자 이메일. 브라우저와 Function의 관리자 판정에 쓰입니다 |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL`이 비어 있으면
**빌드가 실패합니다.** 설정 없이 배포되면 앱이 데모 모드로 뜨거나 관리자
로그인이 막히는데, 그 상태로 주소가 나가는 것보다 배포가 멈추는 편이
안전하기 때문입니다.

### 관리자 이메일을 바꿀 때

관리자 이메일은 세 곳에서 판단합니다. **셋이 같아야 합니다.**

| 어디 | 무엇을 보나 |
|---|---|
| 브라우저 | 빌드가 넣어준 `ADMIN_EMAIL` |
| Netlify Function | 환경변수 `ADMIN_EMAIL` |
| Supabase | `public.admin_email()` 함수 |

앞의 둘은 같은 환경변수를 보므로 실제로는 **두 군데**만 맞추면 됩니다.

1. Supabase SQL Editor에서

   ```sql
   create or replace function public.admin_email()
   returns text language sql immutable
   as $$ select '새주소@example.com'::text $$;
   ```

2. Netlify 환경변수 `ADMIN_EMAIL`을 같은 값으로 바꾸고 다시 배포

3. Supabase `Authentication` > `Users`에서 그 이메일로 계정을 만들거나 변경

둘이 어긋나면 **로그인은 되는데 데이터가 하나도 안 보이는** 상태가 됩니다.
브라우저는 통과시켰는데 DB가 막는 경우입니다.

예전에는 이 이메일이 정책과 코드 80여 곳에 문자열로 박혀 있었습니다.

### 그 뒤로는

`git push origin main` 하면 끝입니다. 파일을 직접 올릴 일은 없습니다.

**Netlify에 폴더를 끌어다 놓는 배포는 이제 하지 마세요.** `.gitignore`는 git이
커밋할 때만 동작하므로, 드래그 배포는 제외 대상 파일까지 통째로 올려버립니다.
`git push`만 쓰면 `.gitignore`가 항상 보호막이 됩니다.

배포가 반영됐는지는 이걸로 확인합니다. 머리말 두 줄이 보이면 빌드로 생성된
파일이므로 Git 배포가 올라간 것이고, 안 보이면 옛 드래그 배포본입니다.

```
curl -s https://사이트주소/supabase-config.js | head -2
```

### 캐시 버전은 손대지 않습니다

`public/index.html`과 `public/service-worker.js`에 `?v=dev`,
`ksimath-static-dev`가 들어 있는데 **그대로 두세요.**
빌드할 때 `scripts/stamp-version.js`가 `public/` 내용의 해시로 바꿔 찍습니다.

예전에는 배포할 때마다 사람이 다섯 군데를 손으로 맞췄고, 하나라도
빠뜨리면 서비스워커가 옛 `app.js`를 계속 내보냈습니다. 오류가 나지 않아
알아채기도 어려웠습니다. 이제 내용이 바뀌면 값이 자동으로 바뀝니다.

혹시 버전 문자열의 형태를 바꾸면 빌드가 실패합니다. 조용히 넘어가는 것보다
배포가 멈추는 편이 안전하기 때문입니다.

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
