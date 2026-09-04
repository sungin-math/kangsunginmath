-- 사진 숙제 성취도 통계 보정용 운영 마이그레이션
-- 적용 전제:
--   1) apply-student-archive.sql 적용 완료 (students.archived_at 존재)
--   2) apply-photo-homework-class-dates.sql 적용 완료
--      (photo_homeworks.lesson_date_2, lesson_date_3 존재)
--
-- 기존 행은 추가·수정·삭제하지 않습니다.
-- 함수와 트리거만 원자적으로 교체하며, 오류가 발생하면 전체 작업이 롤백됩니다.

begin;

-- 선행 마이그레이션 누락 시 부분 적용되지 않도록 먼저 확인합니다.
do $precheck$
begin
  if to_regclass('public.students') is null
     or to_regclass('public.classes') is null
     or to_regclass('public.learning_periods') is null
     or to_regclass('public.photo_homeworks') is null
     or to_regclass('public.photo_homework_assignments') is null then
    raise exception
      '사진 숙제 기본 테이블이 없습니다. apply-photo-homework-management.sql을 먼저 적용해주세요.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'archived_at'
  ) then
    raise exception
      'students.archived_at 컬럼이 없습니다. apply-student-archive.sql을 먼저 적용해주세요.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'photo_homeworks'
      and column_name = 'lesson_date_2'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'photo_homeworks'
      and column_name = 'lesson_date_3'
  ) then
    raise exception
      '사진 숙제 수업일 2·3 컬럼이 없습니다. apply-photo-homework-class-dates.sql을 먼저 적용해주세요.'
      using errcode = 'P0002';
  end if;
end;
$precheck$;

-- 신규 사진 숙제를 만들 때 현재 재학 중인 학생만 배정합니다.
-- 보관된 학생의 과거 배정과 제출 기록은 그대로 유지됩니다.
create or replace function public.assign_photo_homework_students()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  insert into public.photo_homework_assignments (
    homework_id,
    student_id,
    assigned_grade_level,
    assigned_class_id,
    assigned_class_name,
    student_name_snapshot,
    school_snapshot
  )
  select
    new.id,
    s.id,
    new.grade_level,
    s.class_id,
    coalesce(c.name, ''),
    s.name,
    coalesce(s.school, '')
  from public.students as s
  left join public.classes as c
    on c.id = s.class_id
  where s.archived_at is null
    and c.name ~ new.grade_level
  on conflict (homework_id, student_id) do nothing;

  return new;
end;
$function$;

-- 기간·학년 및 수업일 범위를 검증합니다.
-- 학생 배정이 생긴 뒤에는 과거 통계 기준인 기간과 학년을 바꿀 수 없습니다.
create or replace function public.validate_photo_homework_period()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  period_grade text;
  period_start date;
  period_end date;
begin
  select
    lp.grade_level,
    lp.start_date,
    lp.end_date
  into
    period_grade,
    period_start,
    period_end
  from public.learning_periods as lp
  where lp.id = new.period_id;

  if not found then
    raise exception '선택한 학습 기간을 찾을 수 없습니다.'
      using errcode = '23503';
  end if;

  if period_grade is distinct from new.grade_level then
    raise exception '학습 기간과 대상 학년이 일치하지 않습니다.'
      using errcode = '23514';
  end if;

  if new.lesson_date is null
     or new.lesson_date < period_start
     or new.lesson_date > period_end then
    raise exception '수업일 1은 학습 기간 안에 있어야 합니다.'
      using errcode = '23514';
  end if;

  if new.lesson_date_2 is not null
     and (
       new.lesson_date_2 < period_start
       or new.lesson_date_2 > period_end
     ) then
    raise exception '수업일 2는 학습 기간 안에 있어야 합니다.'
      using errcode = '23514';
  end if;

  if new.lesson_date_3 is not null
     and (
       new.lesson_date_3 < period_start
       or new.lesson_date_3 > period_end
     ) then
    raise exception '수업일 3은 학습 기간 안에 있어야 합니다.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and (
       new.period_id is distinct from old.period_id
       or new.grade_level is distinct from old.grade_level
     )
     and exists (
       select 1
       from public.photo_homework_assignments as a
       where a.homework_id = old.id
     ) then
    raise exception '학생 배정 후에는 학습 기간과 학년을 변경할 수 없습니다.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

-- 기존 트리거를 같은 이름으로 재생성해 중복 없이 새 함수에 연결합니다.
drop trigger if exists validate_photo_homework_period_trigger
  on public.photo_homeworks;

create trigger validate_photo_homework_period_trigger
before insert or update on public.photo_homeworks
for each row
execute function public.validate_photo_homework_period();

drop trigger if exists photo_homework_assign_students
  on public.photo_homeworks;

create trigger photo_homework_assign_students
after insert on public.photo_homeworks
for each row
execute function public.assign_photo_homework_students();

-- 두 함수는 트리거 전용입니다. 브라우저·RPC 역할의 직접 실행을 허용하지 않습니다.
revoke all on function public.assign_photo_homework_students()
  from public, anon, authenticated, service_role;

revoke all on function public.validate_photo_homework_period()
  from public, anon, authenticated, service_role;

commit;
