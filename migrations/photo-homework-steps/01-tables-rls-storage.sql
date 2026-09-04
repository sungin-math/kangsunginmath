-- 사진 숙제 관리 기능 (기존 데이터/테이블을 삭제하지 않음)
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.learning_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  grade_level text not null check (grade_level in ('고1','고2','고3')),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint learning_period_dates_check check (start_date <= end_date),
  constraint learning_period_name_grade_unique unique (name, grade_level)
);

create table if not exists public.photo_homeworks (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.learning_periods(id) on delete restrict,
  grade_level text not null check (grade_level in ('고1','고2','고3')),
  lesson_date date not null,
  title text not null check (btrim(title) <> ''),
  problem_range text not null check (btrim(problem_range) <> ''),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_homework_period_grade_unique unique (id, period_id, grade_level)
);

create table if not exists public.photo_homework_assignments (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.photo_homeworks(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  assigned_grade_level text not null check (assigned_grade_level in ('고1','고2','고3')),
  assigned_class_id uuid references public.classes(id) on delete set null,
  assigned_class_name text not null default '',
  student_name_snapshot text not null,
  school_snapshot text not null default '',
  status text not null default 'not_submitted' check (status in ('not_submitted','pending','completed','redo')),
  admin_feedback text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint photo_assignment_student_unique unique (homework_id, student_id)
);

create table if not exists public.photo_submission_rounds (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.photo_homework_assignments(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  submitted_at timestamptz not null default now(),
  constraint photo_submission_round_unique unique (assignment_id, round_number)
);

create table if not exists public.photo_submission_photos (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.photo_submission_rounds(id) on delete cascade,
  assignment_id uuid not null references public.photo_homework_assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  storage_path text not null unique check (storage_path !~ '\\.\\.'),
  original_file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.photo_deletion_logs (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid,
  assignment_id uuid not null references public.photo_homework_assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  round_number integer not null,
  original_file_name text not null,
  storage_path text not null,
  deleted_at timestamptz not null default now()
);

create index if not exists photo_homeworks_period_date_idx on public.photo_homeworks(period_id, lesson_date);

create index if not exists photo_assignments_student_status_idx on public.photo_homework_assignments(student_id, status);

create index if not exists photo_assignments_class_idx on public.photo_homework_assignments(assigned_class_id);

create index if not exists photo_assignments_status_created_idx on public.photo_homework_assignments(status, created_at desc);

create index if not exists photo_assignments_homework_created_idx on public.photo_homework_assignments(homework_id, created_at desc);

create index if not exists photo_rounds_assignment_idx on public.photo_submission_rounds(assignment_id, round_number desc);

create index if not exists photo_photos_assignment_idx on public.photo_submission_photos(assignment_id, uploaded_at);

create index if not exists photo_logs_assignment_idx on public.photo_deletion_logs(assignment_id, deleted_at);

alter table public.learning_periods enable row level security;

alter table public.photo_homeworks enable row level security;

alter table public.photo_homework_assignments enable row level security;

alter table public.photo_submission_rounds enable row level security;

alter table public.photo_submission_photos enable row level security;

alter table public.photo_deletion_logs enable row level security;

drop policy if exists "Photo homework admin only" on public.learning_periods;

create policy "Photo homework admin only" on public.learning_periods
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_homeworks;

create policy "Photo homework admin only" on public.photo_homeworks
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_homework_assignments;

create policy "Photo homework admin only" on public.photo_homework_assignments
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_submission_rounds;

create policy "Photo homework admin only" on public.photo_submission_rounds
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_submission_photos;

create policy "Photo homework admin only" on public.photo_submission_photos
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_deletion_logs;

create policy "Photo homework admin only" on public.photo_deletion_logs
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

-- private bucket: public=false. 이미 있으면 그대로 유지하면서 비공개로 강제한다.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('photo-homework-private','photo-homework-private',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

-- 브라우저 역할에는 Storage 직접 정책을 만들지 않는다. 서버(service_role)만 접근한다.
drop policy if exists "Public photo homework access" on storage.objects;

drop policy if exists "Anon photo homework access" on storage.objects;

-- 초기 운영 기간: 같은 이름+학년이 있으면 중복 생성하지 않는다.
insert into public.learning_periods(name,grade_level,start_date,end_date,is_active)
values
 ('2학기 중간고사 필인교재 복습','고1','2026-07-03','2026-08-26',true),
 ('2학기 중간고사 필인교재 복습','고2','2026-07-03','2026-08-26',true),
 ('2학기 중간고사 필인교재 복습','고3','2026-07-03','2026-08-26',true)
on conflict(name,grade_level) do nothing;
