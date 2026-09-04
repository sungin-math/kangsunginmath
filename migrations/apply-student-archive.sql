-- 학생 보관 기능을 운영 DB에 안전하게 추가합니다.
-- 기존 학생과 관련 기록은 삭제하거나 변경하지 않습니다.
begin;

alter table public.students
  add column if not exists archived_at timestamptz;

comment on column public.students.archived_at is
  'NULL이면 재학/활성 학생, 값이 있으면 관리자에 의해 보관된 학생';

-- 로그인 시 사용하는 활성 학생 범위를 빠르게 찾도록 돕습니다.
create index if not exists students_active_name_idx
  on public.students (name)
  where archived_at is null;

-- 보관된 학생은 이름/비밀번호가 맞아도 로그인할 수 없습니다.
create or replace function public.login_student(student_name text, student_password text)
returns table(id uuid, name text, class_id uuid, school text)
language sql
security definer
set search_path = pg_catalog, public, extensions
as $function$
  select students.id, students.name, students.class_id, students.school
  from public.students
  where students.archived_at is null
    and students.name = student_name
    and students.password_hash = extensions.crypt(student_password, students.password_hash)
  limit 1;
$function$;

revoke all on function public.login_student(text, text) from public;
grant execute on function public.login_student(text, text) to anon, authenticated;

-- students 테이블의 기존 RLS와 관리자 이메일 정책은 그대로 사용합니다.
commit;
