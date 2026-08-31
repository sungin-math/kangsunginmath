-- 기존 운영 프로젝트에 학생 기록 기능을 추가합니다.
-- 기존 학생, 반, 숙제, 영상, 조회 기록 데이터는 변경하지 않습니다.
begin;

create table if not exists public.student_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  exam_date date not null,
  exam_name text not null,
  subject text default '',
  score numeric(6, 2) not null check (score >= 0),
  max_score numeric(6, 2) not null default 100 check (max_score > 0 and score <= max_score),
  grade text default '',
  memo text default '',
  created_at timestamptz not null default now()
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

alter table public.student_scores enable row level security;
alter table public.student_notes enable row level security;
alter table public.counseling_records enable row level security;

drop policy if exists "Admin can manage student scores" on public.student_scores;
drop policy if exists "Admin can manage student notes" on public.student_notes;
drop policy if exists "Admin can manage counseling records" on public.counseling_records;

create policy "Admin can manage student scores"
on public.student_scores for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Admin can manage student notes"
on public.student_notes for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Admin can manage counseling records"
on public.counseling_records for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

commit;
