-- 사진 숙제를 같은 학년의 여러 반에 선택 배정하기 위한 운영 마이그레이션
--
-- 안전 원칙
--   1) 기존 photo_homework_assignments 및 제출/사진/삭제 이력은 변경하거나 삭제하지 않습니다.
--   2) 기존 숙제의 대상 반은 이미 저장된 배정 스냅샷에서만 역산합니다.
--   3) 신규 숙제는 반드시 admin_save_photo_homework() RPC로 저장합니다.
--   4) 숙제 수정 시 새로 추가한 반의 현재 재학생만 추가 배정합니다.
--   5) 대상 반 제외는 제출·검토 이력이 전혀 없는 미제출 배정만 안전하게 정리합니다.

begin;

-- 선행 마이그레이션 누락 시 일부만 적용되지 않도록 먼저 확인합니다.
do $precheck$
begin
  if to_regclass('public.classes') is null
     or to_regclass('public.students') is null
     or to_regclass('public.learning_periods') is null
     or to_regclass('public.photo_homeworks') is null
     or to_regclass('public.photo_homework_assignments') is null
     or to_regclass('public.photo_submission_rounds') is null
     or to_regclass('public.photo_submission_photos') is null
     or to_regclass('public.photo_deletion_logs') is null then
    raise exception
      '사진 숙제 기본 테이블이 없습니다. 기존 사진 숙제 SQL을 먼저 적용해주세요.'
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

-- class_id는 반이 삭제되어도 당시 반 이름/학년 스냅샷을 남기기 위해 NULL을 허용합니다.
create table if not exists public.photo_homework_target_classes (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null
    references public.photo_homeworks(id) on delete cascade,
  class_id uuid
    references public.classes(id) on delete set null,
  class_name_snapshot text not null
    check (btrim(class_name_snapshot) <> ''),
  grade_level_snapshot text not null
    check (grade_level_snapshot in ('고1', '고2', '고3')),
  created_at timestamptz not null default now(),
  constraint photo_homework_target_class_unique
    unique (homework_id, class_id)
);

comment on table public.photo_homework_target_classes is
  '사진 숙제별 선택 대상 반. 기존 학생 배정과 별도로 대상 반 선택 상태를 보존합니다.';
comment on column public.photo_homework_target_classes.class_name_snapshot is
  '숙제 대상 반으로 지정할 당시의 반 이름';
comment on column public.photo_homework_target_classes.grade_level_snapshot is
  '숙제 대상 반으로 지정할 당시 학습기간의 학년';

create index if not exists photo_homework_target_classes_class_idx
  on public.photo_homework_target_classes (class_id, homework_id);

-- 기존 숙제는 현재 학생 반을 다시 계산하지 않습니다.
-- 과거 배정 당시 저장된 assigned_class_id/name만 대상 반으로 옮깁니다.
insert into public.photo_homework_target_classes (
  homework_id,
  class_id,
  class_name_snapshot,
  grade_level_snapshot,
  created_at
)
select
  a.homework_id,
  a.assigned_class_id,
  coalesce(nullif(min(a.assigned_class_name), ''), c.name),
  h.grade_level,
  min(a.created_at)
from public.photo_homework_assignments as a
join public.photo_homeworks as h
  on h.id = a.homework_id
join public.classes as c
  on c.id = a.assigned_class_id
where a.assigned_class_id is not null
group by
  a.homework_id,
  a.assigned_class_id,
  c.name,
  h.grade_level
on conflict (homework_id, class_id) do nothing;

-- 새 연결 테이블은 기존 사진 숙제 테이블과 동일하게 관리자 이메일만 접근합니다.
alter table public.photo_homework_target_classes enable row level security;

drop policy if exists "Photo homework target classes admin only"
  on public.photo_homework_target_classes;

create policy "Photo homework target classes admin only"
on public.photo_homework_target_classes
for all
to authenticated
using (
  (select lower(coalesce(auth.jwt() ->> 'email', '')))
    = 'tjddls9288@naver.com'
)
with check (
  (select lower(coalesce(auth.jwt() ->> 'email', '')))
    = 'tjddls9288@naver.com'
);

-- 2026년 이후 생성한 Supabase 프로젝트의 명시적 Data API 권한 방식도 지원합니다.
revoke all on table public.photo_homework_target_classes
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.photo_homework_target_classes
  to authenticated;
grant all
  on table public.photo_homework_target_classes
  to service_role;

-- 구버전 app.js가 RPC 적용 뒤에도 photo_homeworks에 직접 INSERT하여
-- 학생 배정이 0명인 숙제를 만드는 일을 명시적 오류로 차단합니다.
create or replace function public.require_photo_homework_admin_save_rpc()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if current_setting('app.photo_homework_admin_save', true) is distinct from 'on' then
    raise exception
      '사진 숙제 등록 방식이 변경되었습니다. 사이트를 새로고침한 뒤 다시 등록해주세요.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

drop trigger if exists require_photo_homework_admin_save_rpc_trigger
  on public.photo_homeworks;

create trigger require_photo_homework_admin_save_rpc_trigger
before insert on public.photo_homeworks
for each row
execute function public.require_photo_homework_admin_save_rpc();

-- 기존의 '학년 전체 자동 배정' 트리거는 제거합니다.
-- 트리거 함수 자체는 과거 스키마와의 호환을 위해 남기되 직접 실행 권한은 주지 않습니다.
drop trigger if exists photo_homework_assign_students
  on public.photo_homeworks;

-- 관리자 세션으로 호출하는 원자적 저장 함수입니다.
-- target_homework_id가 NULL이면 신규 생성, UUID이면 기존 숙제 수정입니다.
-- 반환값은 저장된 photo_homeworks.id입니다.
create or replace function public.admin_save_photo_homework(
  target_homework_id uuid,
  target_period_id uuid,
  target_lesson_date date,
  target_lesson_date_2 date,
  target_lesson_date_3 date,
  target_title text,
  target_problem_range text,
  target_memo text,
  target_class_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  saved_homework_id uuid;
  existing_period_id uuid;
  period_grade text;
  period_start date;
  period_end date;
  normalized_class_ids uuid[];
  added_class_ids uuid[] := array[]::uuid[];
  requested_class_count integer;
  found_class_count integer;
  matching_grade_count integer;
  clean_title text := btrim(coalesce(target_title, ''));
  clean_problem_range text := btrim(coalesce(target_problem_range, ''));
  clean_memo text := coalesce(target_memo, '');
begin
  if lower(coalesce(auth.jwt() ->> 'email', ''))
       <> 'tjddls9288@naver.com' then
    raise exception '관리자 권한이 없습니다.' using errcode = '42501';
  end if;

  select coalesce(array_agg(selected.class_id order by selected.class_id), array[]::uuid[])
  into normalized_class_ids
  from (
    select distinct input.class_id
    from unnest(coalesce(target_class_ids, array[]::uuid[])) as input(class_id)
    where input.class_id is not null
  ) as selected;

  requested_class_count := cardinality(normalized_class_ids);

  if requested_class_count = 0 then
    raise exception '대상 반을 하나 이상 선택해주세요.' using errcode = '22023';
  end if;

  if target_period_id is null then
    raise exception '학습 기간을 선택해주세요.' using errcode = '22023';
  end if;

  if target_lesson_date is null then
    raise exception '수업일 1을 입력해주세요.' using errcode = '22023';
  end if;

  if clean_title = '' then
    raise exception '숙제 제목을 입력해주세요.' using errcode = '22023';
  end if;

  if clean_problem_range = '' then
    raise exception '문항 범위를 입력해주세요.' using errcode = '22023';
  end if;

  select lp.grade_level, lp.start_date, lp.end_date
  into period_grade, period_start, period_end
  from public.learning_periods as lp
  where lp.id = target_period_id
  for share;

  if not found then
    raise exception '선택한 학습 기간을 찾을 수 없습니다.' using errcode = '23503';
  end if;

  if target_lesson_date < period_start
     or target_lesson_date > period_end then
    raise exception '수업일 1은 학습 기간 안에 있어야 합니다.' using errcode = '23514';
  end if;

  if target_lesson_date_2 is not null
     and (
       target_lesson_date_2 < period_start
       or target_lesson_date_2 > period_end
     ) then
    raise exception '수업일 2는 학습 기간 안에 있어야 합니다.' using errcode = '23514';
  end if;

  if target_lesson_date_3 is not null
     and (
       target_lesson_date_3 < period_start
       or target_lesson_date_3 > period_end
     ) then
    raise exception '수업일 3은 학습 기간 안에 있어야 합니다.' using errcode = '23514';
  end if;

  -- classes에는 별도 학년 컬럼이 없으므로 기존 규칙과 같이 반 이름에서 학년을 검증합니다.
  -- '고1'이 '고10'에 잘못 일치하지 않도록 뒤의 숫자 경계도 확인합니다.
  select
    count(*)::integer,
    count(*) filter (
      where c.name ~ (period_grade || '([^0-9]|$)')
    )::integer
  into found_class_count, matching_grade_count
  from public.classes as c
  where c.id = any(normalized_class_ids);

  if found_class_count <> requested_class_count then
    raise exception '존재하지 않는 반이 포함되어 있습니다.' using errcode = '23503';
  end if;

  if matching_grade_count <> requested_class_count then
    raise exception '학습 기간의 학년과 다른 반은 선택할 수 없습니다.' using errcode = '23514';
  end if;

  if target_homework_id is null then
    -- BEFORE INSERT 보호 트리거가 이 RPC 호출만 허용하도록 트랜잭션 범위 표식을 설정합니다.
    perform set_config('app.photo_homework_admin_save', 'on', true);

    insert into public.photo_homeworks (
      period_id,
      grade_level,
      lesson_date,
      lesson_date_2,
      lesson_date_3,
      title,
      problem_range,
      memo
    )
    values (
      target_period_id,
      period_grade,
      target_lesson_date,
      target_lesson_date_2,
      target_lesson_date_3,
      clean_title,
      clean_problem_range,
      clean_memo
    )
    returning id into saved_homework_id;

    added_class_ids := normalized_class_ids;
  else
    select h.period_id
    into existing_period_id
    from public.photo_homeworks as h
    where h.id = target_homework_id
    for update;

    if not found then
      raise exception '수정할 사진 숙제를 찾을 수 없습니다.' using errcode = 'P0002';
    end if;

    saved_homework_id := target_homework_id;

    -- 기존 정책과 동일하게 학생 배정 뒤에는 학습기간(따라서 학년)을 바꾸지 않습니다.
    if existing_period_id is distinct from target_period_id
       and exists (
         select 1
         from public.photo_homework_assignments as a
         where a.homework_id = saved_homework_id
       ) then
      raise exception '학생 배정 후에는 학습 기간과 학년을 변경할 수 없습니다.'
        using errcode = '55000';
    end if;

    select coalesce(array_agg(selected.class_id order by selected.class_id), array[]::uuid[])
    into added_class_ids
    from unnest(normalized_class_ids) as selected(class_id)
    where not exists (
      select 1
      from public.photo_homework_target_classes as target
      where target.homework_id = saved_homework_id
        and target.class_id = selected.class_id
    );

    -- 제출/검토 흔적이 하나라도 있는 반은 대상에서 제외할 수 없습니다.
    if exists (
      select 1
      from public.photo_homework_target_classes as target
      join public.photo_homework_assignments as a
        on a.homework_id = target.homework_id
       and a.assigned_class_id = target.class_id
      where target.homework_id = saved_homework_id
        and target.class_id is not null
        and not (target.class_id = any(normalized_class_ids))
        and (
          a.status <> 'not_submitted'
          or btrim(coalesce(a.admin_feedback, '')) <> ''
          or a.reviewed_at is not null
          or exists (
            select 1
            from public.photo_submission_rounds as r
            where r.assignment_id = a.id
          )
          or exists (
            select 1
            from public.photo_submission_photos as p
            where p.assignment_id = a.id
          )
          or exists (
            select 1
            from public.photo_deletion_logs as d
            where d.assignment_id = a.id
          )
        )
    ) then
      raise exception
        '제출 또는 검토 이력이 있는 반은 대상에서 제외할 수 없습니다.'
        using errcode = '55000';
    end if;

    -- 이력이 전혀 없는 미제출 배정만 대상 반 제외와 함께 안전하게 정리합니다.
    delete from public.photo_homework_assignments as a
    using public.photo_homework_target_classes as target
    where target.homework_id = saved_homework_id
      and target.class_id is not null
      and not (target.class_id = any(normalized_class_ids))
      and a.homework_id = target.homework_id
      and a.assigned_class_id = target.class_id
      and a.status = 'not_submitted'
      and btrim(coalesce(a.admin_feedback, '')) = ''
      and a.reviewed_at is null
      and not exists (
        select 1
        from public.photo_submission_rounds as r
        where r.assignment_id = a.id
      )
      and not exists (
        select 1
        from public.photo_submission_photos as p
        where p.assignment_id = a.id
      )
      and not exists (
        select 1
        from public.photo_deletion_logs as d
        where d.assignment_id = a.id
      );

    delete from public.photo_homework_target_classes as target
    where target.homework_id = saved_homework_id
      and target.class_id is not null
      and not (target.class_id = any(normalized_class_ids));

    update public.photo_homeworks as h
    set
      period_id = target_period_id,
      grade_level = period_grade,
      lesson_date = target_lesson_date,
      lesson_date_2 = target_lesson_date_2,
      lesson_date_3 = target_lesson_date_3,
      title = clean_title,
      problem_range = clean_problem_range,
      memo = clean_memo,
      updated_at = now()
    where h.id = saved_homework_id;
  end if;

  -- 선택한 반을 저장합니다. 기존 행의 스냅샷은 변경하지 않습니다.
  insert into public.photo_homework_target_classes (
    homework_id,
    class_id,
    class_name_snapshot,
    grade_level_snapshot
  )
  select
    saved_homework_id,
    c.id,
    c.name,
    period_grade
  from public.classes as c
  where c.id = any(normalized_class_ids)
  on conflict (homework_id, class_id) do nothing;

  -- 신규 생성 시에는 선택한 모든 반, 수정 시에는 이번에 추가된 반의 학생만 배정합니다.
  if cardinality(added_class_ids) > 0 then
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
      saved_homework_id,
      s.id,
      period_grade,
      s.class_id,
      c.name,
      s.name,
      coalesce(s.school, '')
    from public.students as s
    join public.classes as c
      on c.id = s.class_id
    where s.archived_at is null
      and s.class_id = any(added_class_ids)
    on conflict (homework_id, student_id) do nothing;
  end if;

  perform set_config('app.photo_homework_admin_save', 'off', true);
  return saved_homework_id;
end;
$function$;

-- 함수는 관리자 Supabase 세션(authenticated)에서만 호출합니다.
revoke all on function public.admin_save_photo_homework(
  uuid, uuid, date, date, date, text, text, text, uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_photo_homework(
  uuid, uuid, date, date, date, text, text, text, uuid[]
) to authenticated;

-- 두 함수는 트리거 전용이며 API에서 직접 호출하지 못하게 합니다.
revoke all on function public.require_photo_homework_admin_save_rpc()
  from public, anon, authenticated, service_role;
revoke all on function public.assign_photo_homework_students()
  from public, anon, authenticated, service_role;

commit;

-- 적용 후 확인용(읽기 전용): 기존 숙제별 대상 반 수와 기존 배정 수를 비교합니다.
select
  h.id as homework_id,
  h.title,
  count(distinct target.class_id) as target_class_count,
  count(distinct a.id) as existing_assignment_count
from public.photo_homeworks as h
left join public.photo_homework_target_classes as target
  on target.homework_id = h.id
left join public.photo_homework_assignments as a
  on a.homework_id = h.id
group by h.id, h.title, h.created_at
order by h.created_at desc;
