-- 동명이인 로그인 오작동 수정
--
-- 기존 login_student는 이렇게 끝났습니다.
--
--   where students.name = student_name
--     and students.password_hash = extensions.crypt(...)
--   limit 1;
--
-- 정렬 기준 없이 limit 1이라, 같은 이름의 학생 둘이 같은 비밀번호를
-- 쓰면 누구 계정이 열릴지 정해져 있지 않습니다. 비밀번호가 4자리
-- 숫자라 충돌 확률이 무시할 만큼 낮지도 않고, 걸리면 남의 성적과
-- 출결이 그대로 열립니다.
--
-- 2026-09-02 기준 실제로 동명이인이 두 쌍 있습니다.
--   김도윤 (신성고 / 동안고)
--   김시후 (백영고 / 우성고)
--
-- 새 함수는 limit을 걸지 않고 맞는 학생을 전부 돌려줍니다.
-- 서버가 개수를 보고 판단합니다.
--
--   0명  → 로그인 실패
--   1명  → 로그인 성공
--   2명+ → 학교를 되물음 (409). 학교를 받아 다시 호출하면 1명으로 좁혀집니다.
--
-- 이름이 겹치지 않는 학생은 절차가 전혀 바뀌지 않습니다.
--
--
-- ※ 실행 순서를 지켜주세요.
--
--   1) 이 파일을 먼저 실행합니다. (새 함수 추가. 기존 함수는 그대로 둡니다)
--   2) 배포합니다.
--   3) 로그인이 정상인지 확인한 뒤, 파일 맨 아래 정리용 SQL을 실행합니다.
--
--   1)과 2)를 바꾸면 새 코드가 없는 함수를 부르게 되어 로그인이
--   전면 중단됩니다. login_student를 미리 지워도 마찬가지입니다.

begin;

create or replace function public.login_student_matches(
  student_name text,
  student_password text,
  student_school text default null
)
returns table(id uuid, name text, class_id uuid, school text)
language sql
security definer
set search_path = pg_catalog, public, extensions
as $$
  select students.id, students.name, students.class_id, students.school
  from public.students
  where students.archived_at is null
    and students.name = student_name
    and (
      student_school is null
      or btrim(students.school) = btrim(student_school)
    )
    and students.password_hash = extensions.crypt(student_password, students.password_hash)
  -- limit을 걸지 않습니다. 개수 판단은 서버가 합니다.
  -- 정렬은 학교 되묻기 목록의 순서를 고정하기 위한 것입니다.
  order by students.school, students.id;
$$;

-- 브라우저 역할에는 실행 권한을 주지 않습니다.
-- service_role은 anon 권한을 상속하지 않으므로 명시적으로 부여합니다.
revoke all on function public.login_student_matches(text, text, text) from public, anon, authenticated;
grant execute on function public.login_student_matches(text, text, text) to service_role;

commit;


-- ────────────────────────────────────────────────────────────
-- 3단계: 배포 후 로그인 확인이 끝나면 실행합니다.
--
-- 옛 함수를 지웁니다. 남겨두면 언젠가 다시 쓰이면서 같은 문제가
-- 되살아납니다. 지금은 service_role만 실행할 수 있어 당장 위험하지는
-- 않습니다.
--
--   drop function if exists public.login_student(text, text);
--
--
-- 확인용 조회
--
--   select p.proname, pg_get_function_identity_arguments(p.oid) as 인자
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname like 'login_student%';
--
-- 정리 후에는 login_student_matches 하나만 남아야 합니다.
