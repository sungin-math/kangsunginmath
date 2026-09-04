-- 반 학년을 반 이름 추측이 아닌 명시적 컬럼으로 관리하기 위한 운영 마이그레이션
--
-- 안전한 적용/배포 순서
--   1) 관리자에게 잠시 반 신규 등록을 중단하도록 안내합니다.
--   2) 이 SQL을 먼저 실행합니다. 기존 앱의 반 조회는 추가 컬럼 때문에 깨지지 않습니다.
--   3) classes.grade_level을 저장·조회하는 새 앱을 즉시 Netlify에 배포합니다.
--   4) 새 앱 배포 전의 구버전 화면에서는 반을 새로 등록하지 않습니다.
--
-- 새 앱을 SQL보다 먼저 배포하면 아직 없는 grade_level 컬럼 조회가 실패할 수 있으므로
-- 반드시 SQL 적용 후 새 앱을 배포합니다.
-- 기존 반/학생 ID와 사진 숙제의 과거 학년·반 스냅샷은 수정하지 않습니다.

begin;

-- 선행 사진 숙제 다중 반 마이그레이션이 없으면 일부만 적용하지 않고 중단합니다.
do $precheck$
declare
  lesson_function_oid oid;
  lesson_function_source text;
  lesson_function_is_definer boolean;
  lesson_function_config text[];
begin
  if to_regclass('public.classes') is null
     or to_regclass('public.students') is null
     or to_regclass('public.class_sessions') is null
     or to_regclass('public.student_lesson_records') is null then
    raise exception '반·학생 또는 수업일지 기본 테이블을 찾을 수 없습니다.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'archived_at'
  ) then
    raise exception 'students.archived_at 컬럼을 찾을 수 없습니다.'
      using errcode = 'P0002';
  end if;

  if to_regprocedure(
    'public.admin_save_photo_homework(uuid,uuid,date,date,date,text,text,text,uuid[])'
  ) is null then
    raise exception
      '사진 숙제 다중 반 저장 함수가 없습니다. apply-photo-homework-class-targets.sql을 먼저 적용해주세요.'
      using errcode = 'P0002';
  end if;

  if to_regclass('public.photo_homework_target_classes') is null then
    raise exception
      '사진 숙제 대상 반 테이블이 없습니다. apply-photo-homework-class-targets.sql을 먼저 적용해주세요.'
      using errcode = 'P0002';
  end if;

  select p.oid, p.prosrc, p.prosecdef, p.proconfig
  into
    lesson_function_oid,
    lesson_function_source,
    lesson_function_is_definer,
    lesson_function_config
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_lesson_journal'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_session_id uuid, p_class_id uuid, p_session_date date, p_title text, p_lesson_memo text, p_records jsonb';

  if lesson_function_oid is null then
    raise exception
      '운영 수업일지 저장 함수를 찾을 수 없습니다. 최신 수업일지 SQL을 먼저 적용해주세요.'
      using errcode = 'P0002';
  end if;

  -- 최신 not_recorded 지원 함수의 핵심 검증/스냅샷 로직인지 확인합니다.
  if position('''not_recorded''' in lesson_function_source) = 0
     or position('student_id_snapshot' in lesson_function_source) = 0
     or position('class_id_snapshot' in lesson_function_source) = 0
     or position('grade_snapshot' in lesson_function_source) = 0
     or position('p_session_id is null' in lesson_function_source) = 0 then
    raise exception
      '수업일지 저장 함수가 예상한 최신 not_recorded 버전과 다릅니다. 자동 교체를 중단합니다.'
      using errcode = '55000';
  end if;

  -- 최초 적용 시 이름 추론 버전, 재실행 시 새 grade_level 버전만 허용합니다.
  if not (
    (
      position('regexp_match(v_class_name' in lesson_function_source) > 0
      and position('c.grade_level' in lesson_function_source) = 0
    )
    or
    (
      position('c.grade_level' in lesson_function_source) > 0
      and position('regexp_match(v_class_name' in lesson_function_source) = 0
    )
  ) then
    raise exception
      '수업일지 저장 함수의 학년 처리 방식이 예상과 다릅니다. 자동 교체를 중단합니다.'
      using errcode = '55000';
  end if;

  if not lesson_function_is_definer
     or not coalesce(
       lesson_function_config @> array['search_path=""']::text[],
       false
     ) then
    raise exception
      '수업일지 저장 함수의 SECURITY DEFINER 또는 고정 search_path 설정이 예상과 다릅니다.'
      using errcode = '55000';
  end if;

  if pg_catalog.has_function_privilege('anon', lesson_function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', lesson_function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', lesson_function_oid, 'EXECUTE') then
    raise exception
      '수업일지 저장 함수의 실행 권한이 예상과 다릅니다.'
      using errcode = '55000';
  end if;
end;
$precheck$;

-- 기존 행을 그대로 둔 채 nullable 컬럼부터 추가하고 검증 완료 후 NOT NULL로 전환합니다.
alter table public.classes
  add column if not exists grade_level text;

-- 학년 값이 아직 없는 기존 반만 반 이름에서 한 번 변환합니다.
-- 둘 이상의 학년 표기가 섞인 모호한 이름은 자동 결정하지 않고 NULL로 남겨 아래에서 롤백합니다.
update public.classes as c
set grade_level = case
  when c.name ~ '고1([^0-9]|$)'
       and c.name !~ '고2([^0-9]|$)'
       and c.name !~ '고3([^0-9]|$)' then '고1'
  when c.name ~ '고2([^0-9]|$)'
       and c.name !~ '고1([^0-9]|$)'
       and c.name !~ '고3([^0-9]|$)' then '고2'
  when c.name ~ '고3([^0-9]|$)'
       and c.name !~ '고1([^0-9]|$)'
       and c.name !~ '고2([^0-9]|$)' then '고3'
  else null
end
where c.grade_level is null;

-- 하나라도 판별하지 못했거나 허용되지 않은 값이면 예외를 발생시켜 위 변경을 전부 롤백합니다.
do $verify_backfill$
declare
  invalid_count integer;
  invalid_names text;
begin
  select
    count(*)::integer,
    string_agg(c.name, ', ' order by c.name)
  into invalid_count, invalid_names
  from public.classes as c
  where c.grade_level is null
     or c.grade_level not in ('고1', '고2', '고3');

  if invalid_count > 0 then
    raise exception
      '학년을 판별할 수 없는 반이 %개 있습니다: %. 반 이름에 고1/고2/고3 중 하나만 포함되도록 수정한 뒤 다시 실행해주세요.',
      invalid_count,
      coalesce(invalid_names, '')
      using errcode = '23514';
  end if;
end;
$verify_backfill$;

-- CHECK는 이름으로 존재 여부를 확인해 재실행해도 중복 생성하지 않습니다.
do $add_grade_check$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as con
    where con.conrelid = 'public.classes'::regclass
      and con.conname = 'classes_grade_level_check'
  ) then
    alter table public.classes
      add constraint classes_grade_level_check
      check (grade_level in ('고1', '고2', '고3'))
      not valid;
  end if;
end;
$add_grade_check$;

alter table public.classes
  validate constraint classes_grade_level_check;

alter table public.classes
  alter column grade_level set not null;

comment on column public.classes.grade_level is
  '반의 명시적 대상 학년. 고1, 고2, 고3 중 하나';

create index if not exists classes_grade_level_name_idx
  on public.classes (grade_level, name);

-- 사진 숙제 저장 동작·권한·트랜잭션 처리는 유지하고,
-- 선택 반의 학년 검증만 classes.grade_level 기준으로 교체합니다.
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

  select
    count(*)::integer,
    count(*) filter (
      where (
        -- 기존 대상 반은 현재 학년이 바뀌어도 저장 당시 학년 스냅샷으로 유지합니다.
        target_homework_id is not null
        and exists (
          select 1
          from public.photo_homework_target_classes as existing_target
          where existing_target.homework_id = target_homework_id
            and existing_target.class_id = c.id
            and existing_target.grade_level_snapshot = period_grade
        )
      ) or (
        -- 신규 숙제 또는 이번에 새로 추가하는 반만 현재 classes.grade_level을 검사합니다.
        not exists (
          select 1
          from public.photo_homework_target_classes as any_existing_target
          where any_existing_target.homework_id = target_homework_id
            and any_existing_target.class_id = c.id
        )
        and c.grade_level = period_grade
      )
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

-- CREATE OR REPLACE는 기존 ACL을 보존하지만, 의도를 명시적으로 다시 고정합니다.
revoke all on function public.admin_save_photo_homework(
  uuid, uuid, date, date, date, text, text, text, uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_photo_homework(
  uuid, uuid, date, date, date, text, text, text, uuid[]
) to authenticated;

-- 운영 중인 수업일지 저장 함수의 보안·검증·스냅샷 동작은 그대로 유지합니다.
-- 신규 일지의 학년만 반 이름 정규식 대신 classes.grade_level에서 직접 읽습니다.
-- 기존 일지 수정 분기는 저장 당시 class_name_snapshot/grade_snapshot만 계속 사용합니다.
create or replace function public.admin_save_lesson_journal(
  p_session_id uuid,
  p_class_id uuid,
  p_session_date date,
  p_title text,
  p_lesson_memo text,
  p_records jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_saved_class_id uuid;
  v_class_name text;
  v_grade text;
  v_expected_count integer;
  v_received_count integer;
  v_distinct_count integer;
  v_record jsonb;
  v_student_id uuid;
  v_student_name text;
  v_school text;
  v_attendance text;
  v_homework text;
  v_memo text;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'tjddls9288@naver.com' then
    raise exception '관리자 권한이 없는 계정입니다.' using errcode = '42501';
  end if;

  if p_session_date is null then
    raise exception '수업 날짜를 입력해주세요.' using errcode = '22023';
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception '수업 제목 또는 내용을 입력해주세요.' using errcode = '22023';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception '학생별 기록 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  v_received_count := jsonb_array_length(p_records);
  if v_received_count = 0 then
    raise exception '저장할 학생 기록이 없습니다.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or nullif(item.value ->> 'student_id', '') is null
       or item.value ->> 'student_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or item.value ->> 'attendance_status' is null
       or item.value ->> 'homework_achievement' is null
  ) then
    raise exception '학생별 기록 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  select count(distinct (item.value ->> 'student_id')::uuid)
    into v_distinct_count
  from jsonb_array_elements(p_records) as item(value);

  if v_distinct_count <> v_received_count then
    raise exception '동일한 학생 기록이 중복되어 있습니다.' using errcode = '23505';
  end if;

  if p_session_id is null then
    if p_class_id is null then
      raise exception '대상 반을 선택해주세요.' using errcode = '22023';
    end if;

    select c.name, c.grade_level
      into v_class_name, v_grade
    from public.classes as c
    where c.id = p_class_id;

    if not found then
      raise exception '선택한 반을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;

    if v_grade is null or v_grade not in ('고1', '고2', '고3') then
      raise exception '선택한 반의 학년 정보를 확인할 수 없습니다.'
        using errcode = '22023';
    end if;

    select count(*)
      into v_expected_count
    from public.students as s
    where s.class_id = p_class_id
      and s.archived_at is null;

    if v_expected_count = 0 then
      raise exception '선택한 반에 재학 중인 학생이 없습니다.' using errcode = '22023';
    end if;

    if v_received_count <> v_expected_count then
      raise exception '현재 반 학생 전체 기록이 포함되지 않았습니다. 학생 목록을 다시 불러와주세요.'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_records) as item
      left join public.students as s
        on s.id = (item ->> 'student_id')::uuid
      where s.id is null
         or s.class_id is distinct from p_class_id
         or s.archived_at is not null
    ) then
      raise exception '선택한 반의 재학 학생이 아닌 기록이 포함되어 있습니다.'
        using errcode = '42501';
    end if;

    insert into public.class_sessions (
      class_id,
      class_id_snapshot,
      session_date,
      title,
      lesson_memo,
      class_name_snapshot,
      grade_snapshot
    )
    values (
      p_class_id,
      p_class_id,
      p_session_date,
      btrim(p_title),
      nullif(btrim(coalesce(p_lesson_memo, '')), ''),
      v_class_name,
      v_grade
    )
    returning id into v_session_id;

    for v_record in select value from jsonb_array_elements(p_records)
    loop
      v_student_id := (v_record ->> 'student_id')::uuid;
      v_attendance := v_record ->> 'attendance_status';
      v_homework := v_record ->> 'homework_achievement';
      v_memo := nullif(btrim(coalesce(v_record ->> 'memo', '')), '');

      if v_attendance is null
        or v_attendance not in ('present', 'late', 'absent', 'early_leave', 'makeup') then
        raise exception '허용되지 않은 출결 상태입니다.' using errcode = '22023';
      end if;

      if v_homework is null
        or v_homework not in ('A', 'B', 'C', 'pending', 'not_recorded') then
        raise exception '허용되지 않은 숙제 성취도입니다.' using errcode = '22023';
      end if;

      select s.name, coalesce(s.school, '')
        into v_student_name, v_school
      from public.students as s
      where s.id = v_student_id
        and s.class_id = p_class_id
        and s.archived_at is null;

      if not found then
        raise exception '저장할 학생 정보를 확인할 수 없습니다.' using errcode = 'P0002';
      end if;

      insert into public.student_lesson_records (
        session_id,
        student_id,
        student_id_snapshot,
        student_name_snapshot,
        school_snapshot,
        class_name_snapshot,
        grade_snapshot,
        attendance_status,
        homework_achievement,
        memo
      )
      values (
        v_session_id,
        v_student_id,
        v_student_id,
        v_student_name,
        v_school,
        v_class_name,
        v_grade,
        v_attendance,
        v_homework,
        v_memo
      );
    end loop;
  else
    select cs.class_id_snapshot, cs.class_name_snapshot, cs.grade_snapshot
      into v_saved_class_id, v_class_name, v_grade
    from public.class_sessions as cs
    where cs.id = p_session_id
    for update;

    if not found then
      raise exception '수정할 수업일지를 찾을 수 없습니다.' using errcode = 'P0002';
    end if;

    if p_class_id is distinct from v_saved_class_id then
      raise exception '학생 기록이 생성된 수업일지의 대상 반은 변경할 수 없습니다.'
        using errcode = '22023';
    end if;

    select count(*)
      into v_expected_count
    from public.student_lesson_records as slr
    where slr.session_id = p_session_id;

    if v_received_count <> v_expected_count then
      raise exception '기존 학생 기록 전체가 포함되지 않았습니다. 수업일지를 다시 불러와주세요.'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_records) as item
      left join public.student_lesson_records as slr
        on slr.session_id = p_session_id
       and slr.student_id_snapshot = (item ->> 'student_id')::uuid
      where slr.id is null
    ) then
      raise exception '기존 수업일지에 포함되지 않은 학생 기록이 있습니다.'
        using errcode = '42501';
    end if;

    update public.class_sessions
    set session_date = p_session_date,
        title = btrim(p_title),
        lesson_memo = nullif(btrim(coalesce(p_lesson_memo, '')), '')
    where id = p_session_id;

    for v_record in select value from jsonb_array_elements(p_records)
    loop
      v_student_id := (v_record ->> 'student_id')::uuid;
      v_attendance := v_record ->> 'attendance_status';
      v_homework := v_record ->> 'homework_achievement';
      v_memo := nullif(btrim(coalesce(v_record ->> 'memo', '')), '');

      if v_attendance is null
        or v_attendance not in ('present', 'late', 'absent', 'early_leave', 'makeup') then
        raise exception '허용되지 않은 출결 상태입니다.' using errcode = '22023';
      end if;

      if v_homework is null
        or v_homework not in ('A', 'B', 'C', 'pending', 'not_recorded') then
        raise exception '허용되지 않은 숙제 성취도입니다.' using errcode = '22023';
      end if;

      update public.student_lesson_records
      set attendance_status = v_attendance,
          homework_achievement = v_homework,
          memo = v_memo
      where session_id = p_session_id
        and student_id_snapshot = v_student_id;

      if not found then
        raise exception '수정할 학생 기록을 찾을 수 없습니다.' using errcode = 'P0002';
      end if;
    end loop;

    v_session_id := p_session_id;
  end if;

  return v_session_id;
end;
$function$;

-- 현재 운영 ACL과 동일하게 익명 실행을 제거하고 관리자 브라우저/서버만 허용합니다.
revoke all on function public.admin_save_lesson_journal(uuid, uuid, date, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_save_lesson_journal(uuid, uuid, date, text, text, jsonb)
  to authenticated, service_role;

-- 교체 결과가 예상한 보안·학년 처리 상태인지 확인합니다.
-- 하나라도 다르면 COMMIT 전에 예외가 발생해 전체 마이그레이션이 롤백됩니다.
do $postflight$
declare
  lesson_function_oid oid;
  lesson_function_owner oid;
  lesson_function_source text;
  lesson_function_is_definer boolean;
  lesson_function_config text[];
  photo_function_oid oid;
  photo_function_source text;
  photo_function_is_definer boolean;
  photo_function_config text[];
  grade_is_not_null boolean;
begin
  if exists (
    select 1
    from public.classes as c
    where c.grade_level is null
       or c.grade_level not in ('고1', '고2', '고3')
  ) then
    raise exception '반 학년 값 검증에 실패했습니다.' using errcode = '23514';
  end if;

  select a.attnotnull
  into grade_is_not_null
  from pg_catalog.pg_attribute as a
  where a.attrelid = 'public.classes'::regclass
    and a.attname = 'grade_level'
    and not a.attisdropped;

  if not coalesce(grade_is_not_null, false) then
    raise exception 'classes.grade_level NOT NULL 적용을 확인할 수 없습니다.'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as con
    where con.conrelid = 'public.classes'::regclass
      and con.conname = 'classes_grade_level_check'
      and con.convalidated
  ) then
    raise exception 'classes.grade_level CHECK 검증을 확인할 수 없습니다.'
      using errcode = '55000';
  end if;

  if to_regclass('public.classes_grade_level_name_idx') is null then
    raise exception '반 학년 조회 인덱스를 확인할 수 없습니다.'
      using errcode = '55000';
  end if;

  select p.oid, p.proowner, p.prosrc, p.prosecdef, p.proconfig
  into
    lesson_function_oid,
    lesson_function_owner,
    lesson_function_source,
    lesson_function_is_definer,
    lesson_function_config
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_lesson_journal'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_session_id uuid, p_class_id uuid, p_session_date date, p_title text, p_lesson_memo text, p_records jsonb';

  if lesson_function_oid is null
     or not lesson_function_is_definer
     or not coalesce(
       lesson_function_config @> array['search_path=""']::text[],
       false
     )
     or position('select c.name, c.grade_level' in lesson_function_source) = 0
     or position('regexp_match(v_class_name' in lesson_function_source) > 0
     or position('''not_recorded''' in lesson_function_source) = 0 then
    raise exception '수업일지 저장 함수 교체 후 본문 또는 보안 설정 검증에 실패했습니다.'
      using errcode = '55000';
  end if;

  if pg_catalog.has_function_privilege('anon', lesson_function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', lesson_function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', lesson_function_oid, 'EXECUTE') then
    raise exception '수업일지 저장 함수 교체 후 실행 권한 검증에 실패했습니다.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_catalog.aclexplode(
      (
        select p.proacl
        from pg_catalog.pg_proc as p
        where p.oid = lesson_function_oid
      )
    ) as acl
    where acl.privilege_type = 'EXECUTE'
      and acl.grantee not in (
        lesson_function_owner,
        'authenticated'::regrole::oid,
        'service_role'::regrole::oid
      )
  ) then
    raise exception '수업일지 저장 함수에 예상하지 않은 실행 권한이 있습니다.'
      using errcode = '55000';
  end if;

  select p.oid, p.prosrc, p.prosecdef, p.proconfig
  into
    photo_function_oid,
    photo_function_source,
    photo_function_is_definer,
    photo_function_config
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_photo_homework'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'target_homework_id uuid, target_period_id uuid, target_lesson_date date, target_lesson_date_2 date, target_lesson_date_3 date, target_title text, target_problem_range text, target_memo text, target_class_ids uuid[]';

  if photo_function_oid is null
     or photo_function_is_definer
     or not coalesce(
       photo_function_config @> array['search_path=pg_catalog']::text[],
       false
     )
     or position('c.grade_level = period_grade' in photo_function_source) = 0
     or position('grade_level_snapshot = period_grade' in photo_function_source) = 0
     or position('c.name ~ (period_grade' in photo_function_source) > 0 then
    raise exception '사진 숙제 저장 함수 교체 후 학년 또는 보안 설정 검증에 실패했습니다.'
      using errcode = '55000';
  end if;

  if pg_catalog.has_function_privilege('anon', photo_function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', photo_function_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', photo_function_oid, 'EXECUTE') then
    raise exception '사진 숙제 저장 함수 교체 후 실행 권한 검증에 실패했습니다.'
      using errcode = '55000';
  end if;
end;
$postflight$;

commit;

-- 적용 후 확인용(읽기 전용): 모든 반에 허용된 학년 값이 들어갔는지 확인합니다.
select id, name, grade_level
from public.classes
order by grade_level, name;
