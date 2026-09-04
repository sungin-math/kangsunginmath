-- 운영 중인 student_scores를 내신 성적 관리 구조로 확장합니다.
-- 기존 점수 행은 삭제하거나 변경하지 않으며 새 분류 열은 NULL로 남습니다.
begin;

alter table public.student_scores
  add column if not exists school_year integer,
  add column if not exists grade_level text,
  add column if not exists semester text,
  add column if not exists exam_type text;

alter table public.student_scores
  alter column exam_date drop not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_scores'::regclass
      and conname = 'student_scores_school_year_check'
  ) then
    alter table public.student_scores
      add constraint student_scores_school_year_check
      check (school_year between 2000 and 2100) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_scores'::regclass
      and conname = 'student_scores_grade_level_check'
  ) then
    alter table public.student_scores
      add constraint student_scores_grade_level_check
      check (grade_level in ('고1', '고2', '고3')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_scores'::regclass
      and conname = 'student_scores_semester_check'
  ) then
    alter table public.student_scores
      add constraint student_scores_semester_check
      check (semester in ('1학기', '2학기')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_scores'::regclass
      and conname = 'student_scores_exam_type_check'
  ) then
    alter table public.student_scores
      add constraint student_scores_exam_type_check
      check (exam_type in ('중간고사', '기말고사')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_scores'::regclass
      and conname = 'student_scores_score_range_check_v2'
  ) then
    alter table public.student_scores
      add constraint student_scores_score_range_check_v2
      check (score >= 0 and max_score > 0 and score <= max_score) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.student_scores'::regclass
      and conname = 'student_scores_school_exam_unique'
  ) then
    alter table public.student_scores
      add constraint student_scores_school_exam_unique
      unique (student_id, school_year, grade_level, semester, exam_type);
  end if;
end;
$constraints$;

alter table public.student_scores enable row level security;

drop policy if exists "Admin can manage student scores" on public.student_scores;

create policy "Admin can manage student scores"
on public.student_scores for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

revoke all on table public.student_scores from anon;
grant select, insert, update, delete on table public.student_scores to authenticated;

commit;
