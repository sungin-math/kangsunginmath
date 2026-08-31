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
2. `supabase-config.js` 파일을 열어 아래처럼 바꿉니다.

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

가장 쉬운 배포 방법은 Netlify입니다.

1. Netlify에 로그인합니다.
2. `Add new site` > `Deploy manually`를 선택합니다.
3. 이 폴더 전체를 업로드합니다.
4. 만들어진 주소를 학생들에게 보내면 됩니다.

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
