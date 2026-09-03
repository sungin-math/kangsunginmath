create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter extension pgcrypto set schema extensions;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level text not null check (grade_level in ('고1', '고2', '고3')),
  memo text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  school text default '',
  class_id uuid references public.classes(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.students add column if not exists school text default '';
alter table public.students add column if not exists archived_at timestamptz;
create index if not exists students_active_name_idx
  on public.students (name)
  where archived_at is null;

create table if not exists public.homeworks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  content text not null,
  class_id uuid references public.classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  title text not null,
  url text not null,
  created_at date not null default current_date
);

create table if not exists public.video_views (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  clicked_at timestamptz not null default now()
);

create table if not exists public.student_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_year integer check (school_year between 2000 and 2100),
  grade_level text check (grade_level in ('고1', '고2', '고3')),
  semester text check (semester in ('1학기', '2학기')),
  exam_type text check (exam_type in ('중간고사', '기말고사')),
  exam_date date,
  exam_name text not null,
  subject text default '',
  score numeric(6, 2) check (score >= 0),
  max_score numeric(6, 2) not null default 100 check (max_score > 0 and score <= max_score),
  grade text default '',
  memo text default '',
  created_at timestamptz not null default now(),
  constraint student_scores_school_exam_unique unique (student_id, school_year, grade_level, semester, exam_type)
);

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  category text not null default '기타',
  importance text not null default '일반' check (importance in ('일반', '중요')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.counseling_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  counseling_date date not null,
  target text not null default '학생',
  content text not null,
  follow_up text default '',
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.homeworks enable row level security;
alter table public.videos enable row level security;
alter table public.video_views enable row level security;
alter table public.student_scores enable row level security;
alter table public.student_notes enable row level security;
alter table public.counseling_records enable row level security;

-- 관리자 이메일 단일 출처.
-- 아래 정책들과 RPC가 모두 이 함수를 부릅니다. 예전에는 이메일 문자열이
-- 정책마다 박혀 있어서, 바꿀 때 한 군데만 빠뜨려도 그 테이블만 조용히
-- 권한이 어긋났습니다.
--
-- 정책은 행마다 평가되므로 설정 테이블을 읽는 함수로 만들면 조회할 때마다
-- 행 수만큼 조회가 붙습니다. 상수를 돌려주는 immutable 함수는 계획 단계에서
-- 값으로 접혀 실행 비용이 0입니다.
--
-- 이메일을 바꾸려면 이 함수만 고치고, Netlify 환경변수 ADMIN_EMAIL도
-- 같은 값으로 맞춘 뒤 다시 배포하세요. (apply-admin-email-single-source.sql)
create or replace function public.admin_email()
returns text
language sql
immutable
as $$ select 'tjddls9288@naver.com'::text $$;

revoke all on function public.admin_email() from public;
grant execute on function public.admin_email() to anon, authenticated, service_role;

drop policy if exists "Anyone can read classes" on public.classes;
drop policy if exists "Anyone can read homeworks" on public.homeworks;
drop policy if exists "Anyone can read videos" on public.videos;
drop policy if exists "Admin can manage classes" on public.classes;
drop policy if exists "Admin can manage students" on public.students;
drop policy if exists "Admin can manage homeworks" on public.homeworks;
drop policy if exists "Admin can manage videos" on public.videos;
drop policy if exists "Students can record video views" on public.video_views;
drop policy if exists "Admin can read video views" on public.video_views;
drop policy if exists "Admin can delete video views" on public.video_views;
drop policy if exists "Admin can manage video views" on public.video_views;
drop policy if exists "Admin can manage student scores" on public.student_scores;
drop policy if exists "Admin can manage student notes" on public.student_notes;
drop policy if exists "Admin can manage counseling records" on public.counseling_records;

create policy "Anyone can read classes"
on public.classes for select
using (true);

create policy "Anyone can read homeworks"
on public.homeworks for select
using (true);

create policy "Anyone can read videos"
on public.videos for select
using (true);

create policy "Admin can manage classes"
on public.classes for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

create policy "Admin can manage students"
on public.students for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

create policy "Admin can manage homeworks"
on public.homeworks for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

create policy "Admin can manage videos"
on public.videos for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

-- 학생용 INSERT 정책은 없습니다.
--
-- 예전에는 아래 정책이 있었습니다.
--
--   create policy "Students can record video views"
--   on public.video_views for insert
--   to anon, authenticated
--   with check (true);
--
-- 조건이 없어서, 브라우저에 공개된 anon key만 있으면 누구나 임의의
-- student_id로 시청 기록을 무제한 넣을 수 있었습니다.
--
-- 이제 Netlify Function의 record-video-view가 학생 세션 토큰에서
-- student_id를 정해 service_role로 넣습니다. service_role은 RLS를
-- 우회하므로 학생용 정책이 필요 없습니다.
-- (apply-video-view-server-only.sql)

create policy "Admin can manage video views"
on public.video_views for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

create policy "Admin can manage student scores"
on public.student_scores for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

create policy "Admin can manage student notes"
on public.student_notes for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

create policy "Admin can manage counseling records"
on public.counseling_records for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email())
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email());

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

revoke all on function public.login_student(text, text) from public;
grant execute on function public.login_student(text, text) to anon, authenticated;

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
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> public.admin_email() then
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
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> public.admin_email() then
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

revoke all on function public.admin_create_student(text, text, uuid, text) from public;
revoke all on function public.admin_create_student(text, text, uuid, text) from anon;
grant execute on function public.admin_create_student(text, text, uuid, text) to authenticated;

revoke all on function public.admin_reset_student_password(uuid, text) from public;
revoke all on function public.admin_reset_student_password(uuid, text) from anon;
grant execute on function public.admin_reset_student_password(uuid, text) to authenticated;
