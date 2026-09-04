-- 기존 운영 DB의 학생 평문 비밀번호를 bcrypt 해시로 일괄 변환합니다.
-- 이 파일은 반, 숙제, 영상, 조회 기록을 변경하지 않습니다.
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter extension pgcrypto set schema extensions;

alter table public.students
  add column if not exists password_hash text,
  add column if not exists archived_at timestamptz;

create index if not exists students_active_name_idx
  on public.students (name)
  where archived_at is null;

-- 이전 password 열이 남아 있을 때만 변환합니다.
-- bcrypt 형식으로 이미 저장된 값은 그대로 옮겨 다시 해시하지 않습니다.
do $migration$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'password'
  ) then
    execute $sql$
      update public.students
      set password_hash = case
        when password ~ '^\$2[abxy]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' then password
        else extensions.crypt(password, extensions.gen_salt('bf'))
      end
      where password_hash is null
    $sql$;
  end if;

  if exists (select 1 from public.students where password_hash is null) then
    raise exception '비밀번호가 없는 학생이 있어 마이그레이션을 중단했습니다.';
  end if;
end;
$migration$;

alter table public.students
  alter column password_hash set not null;

drop function if exists public.login_student(text, text);

create or replace function public.login_student(student_name text, student_password text)
returns table(id uuid, name text, class_id uuid, school text)
language sql
security definer
set search_path = pg_catalog, public, extensions
as $$
  select students.id, students.name, students.class_id, students.school
  from public.students
  where students.archived_at is null
    and students.name = student_name
    and students.password_hash = extensions.crypt(student_password, students.password_hash)
  limit 1;
$$;

create or replace function public.admin_create_student(
  student_name text,
  student_school text,
  student_class_id uuid,
  initial_password text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  new_student_id uuid;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'tjddls9288@naver.com' then
    raise exception '관리자 권한이 없는 계정입니다.' using errcode = '42501';
  end if;

  if nullif(btrim(student_name), '') is null
    or nullif(btrim(initial_password), '') is null then
    raise exception '학생 이름과 초기 비밀번호를 입력해주세요.' using errcode = '22023';
  end if;

  insert into public.students (name, school, class_id, password_hash)
  values (
    btrim(student_name),
    coalesce(btrim(student_school), ''),
    student_class_id,
    extensions.crypt(initial_password, extensions.gen_salt('bf'))
  )
  returning id into new_student_id;

  return new_student_id;
end;
$$;

create or replace function public.admin_reset_student_password(
  target_student_id uuid,
  new_password text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'tjddls9288@naver.com' then
    raise exception '관리자 권한이 없는 계정입니다.' using errcode = '42501';
  end if;

  if nullif(btrim(new_password), '') is null then
    raise exception '새 비밀번호를 입력해주세요.' using errcode = '22023';
  end if;

  update public.students
  set password_hash = extensions.crypt(new_password, extensions.gen_salt('bf'))
  where id = target_student_id;

  if not found then
    raise exception '학생을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.login_student(text, text) from public;
grant execute on function public.login_student(text, text) to anon, authenticated;

revoke all on function public.admin_create_student(text, text, uuid, text) from public;
revoke all on function public.admin_create_student(text, text, uuid, text) from anon;
grant execute on function public.admin_create_student(text, text, uuid, text) to authenticated;

revoke all on function public.admin_reset_student_password(uuid, text) from public;
revoke all on function public.admin_reset_student_password(uuid, text) from anon;
grant execute on function public.admin_reset_student_password(uuid, text) to authenticated;

-- 로그인 함수가 password_hash를 사용하도록 바뀐 뒤 평문 열을 제거합니다.
alter table public.students drop column if exists password;

commit;
