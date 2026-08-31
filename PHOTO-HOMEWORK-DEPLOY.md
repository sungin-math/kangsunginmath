# 사진 숙제 기능 적용 안내

## 1. Supabase SQL 적용

1. Supabase 대시보드에서 현재 운영 프로젝트를 엽니다.
2. SQL Editor에서 아래 SQL 파일을 순서대로 실행합니다.
   1. `apply-photo-homework-management.sql`
      - 사진 숙제용 기본 테이블, RLS 정책, Storage 버킷, 서버 함수 생성
   2. `apply-photo-homework-class-dates.sql`
      - 사진 숙제 수업일 2, 수업일 3 컬럼 추가
   3. `apply-photo-homework-period-rewards.sql`
      - 학습 기간별 100% 달성 보상 문구 컬럼 추가
   4. `apply-student-archive.sql`
      - 학생 삭제 대신 보관·복원할 수 있는 컬럼과 보관 학생 로그인 차단 적용
   5. `apply-photo-homework-hardening.sql`
      - 종료 기간 제출 차단과 제출 확인 페이지 조회용 인덱스 적용
   6. `apply-photo-homework-stats-fix.sql`
      - 보관 학생의 신규 숙제 배정을 차단하고 사진숙제 통계 기준 보호
3. Table Editor에 아래 6개 테이블이 생성되었는지 확인합니다.
   - `learning_periods`
   - `photo_homeworks`
   - `photo_homework_assignments`
   - `photo_submission_rounds`
   - `photo_submission_photos`
   - `photo_deletion_logs`
4. `photo_homeworks` 테이블에 `lesson_date_2`, `lesson_date_3` 컬럼이 있는지 확인합니다.
5. `learning_periods` 테이블에 `reward_title`, `reward_before_message`, `reward_achieved_message` 컬럼이 있는지 확인합니다.
6. `students` 테이블에 `archived_at` 컬럼이 있는지 확인합니다.
7. Storage에서 `photo-homework-private` 버킷이 `Private`인지 확인합니다.
8. Storage의 `objects` 정책에 anon 또는 일반 authenticated 사용자를 전체 허용하는 광범위한 기존 정책이 없는지 확인합니다. 이 기능은 브라우저용 Storage 정책을 추가하지 않습니다.

위 SQL은 기존 학생, 반, 숙제, 영상, 성적, 상담 데이터를 삭제하지 않습니다. `add column if not exists`, `create table if not exists`, `on conflict`를 사용하므로 이미 적용된 항목은 중복 생성되지 않습니다. 초기 기간 3건은 `(기간 이름, 학년)` 기준으로 중복 없이 생성됩니다.
초기 기간만 다시 확인·생성하려면 `create-initial-photo-homework-periods.sql`을 별도로 실행해도 중복되지 않습니다.

## 2. Netlify 환경변수

Netlify의 Site configuration → Environment variables에 다음 값을 등록합니다.

- `SUPABASE_URL`: 기존 Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: 기존 anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings의 service role key
- `STUDENT_SESSION_SECRET`: 임의의 길고 예측하기 어려운 문자열(최소 32바이트 권장)

`SUPABASE_SERVICE_ROLE_KEY`와 `STUDENT_SESSION_SECRET`는 `supabase-config.js`, `app.js` 등 브라우저 파일에 넣지 않습니다.

## 3. 배포

Netlify Function이 포함되므로 Git 연동 배포 또는 Netlify CLI의 프로덕션 배포를 사용합니다. 단순 파일 드래그 배포는 서버 함수가 누락될 수 있습니다.

배포 순서:

1. Supabase SQL 실행
2. Netlify 환경변수 등록
3. 전체 프로젝트를 Netlify에 프로덕션 배포
4. 학생과 관리자 모두 로그아웃 후 다시 로그인
5. Android/iOS PWA가 설치되어 있다면 앱을 완전히 닫았다가 다시 실행

## 4. 보안 확인

- 버킷의 Public 설정이 꺼져 있어야 합니다.
- 브라우저 개발자 도구에 service role key가 없어야 합니다.
- signed URL의 만료 시간은 5분입니다.
- 학생 세션 토큰의 기본 수명은 2시간입니다. 학생이 로그인 유지 옵션을 선택하면 최대 30일 동안 저장됩니다.
- Service Worker는 Netlify Function, Supabase API, Storage 사진 및 signed URL을 캐시하지 않습니다.
