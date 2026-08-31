-- 수업일지 숙제 성취도에 명시적인 "미기록" 상태를 추가합니다.
-- 기존 기본값 pending은 유지하고, 현재 스키마/RPC가 예상 상태와 다르면
-- 임의로 덮어쓰지 않고 전체 마이그레이션을 중단합니다.

begin;

do $preflight_and_constraint$
declare
  v_column_type text;
  v_not_null boolean;
  v_default_expr text;
  v_constraint_def text;
  v_constraint_validated boolean;
  v_function_source text;
  v_function_result text;
  v_function_language text;
  v_old_validation_count integer;
  v_new_validation_count integer;
  v_old_constraint constant text := $old_constraint$CHECK (homework_achievement = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'pending'::text]))$old_constraint$;
  v_new_constraint constant text := $new_constraint$CHECK (homework_achievement = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'pending'::text, 'not_recorded'::text]))$new_constraint$;
  v_old_validation constant text :=
    $old_validation$v_homework not in ('A', 'B', 'C', 'pending')$old_validation$;
  v_new_validation constant text :=
    $new_validation$v_homework not in ('A', 'B', 'C', 'pending', 'not_recorded')$new_validation$;
begin
  select
    pg_catalog.format_type(a.atttypid, a.atttypmod),
    a.attnotnull,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
  into
    v_column_type,
    v_not_null,
    v_default_expr
  from pg_catalog.pg_attribute as a
  join pg_catalog.pg_class as t
    on t.oid = a.attrelid
  join pg_catalog.pg_namespace as n
    on n.oid = t.relnamespace
  left join pg_catalog.pg_attrdef as ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  where n.nspname = 'public'
    and t.relname = 'student_lesson_records'
    and a.attname = 'homework_achievement'
    and not a.attisdropped;

  if not found then
    raise exception 'student_lesson_records.homework_achievement 컬럼을 찾을 수 없습니다.'
      using errcode = 'P0002';
  end if;

  if v_column_type is distinct from 'text'
    or v_not_null is distinct from true
    or v_default_expr is distinct from $expected_default$'pending'::text$expected_default$ then
    raise exception
      'homework_achievement 컬럼 정의가 예상과 다릅니다. type=%, not_null=%, default=%',
      v_column_type,
      v_not_null,
      v_default_expr
      using errcode = '55000';
  end if;

  select
    pg_catalog.pg_get_constraintdef(c.oid, true),
    c.convalidated
  into
    v_constraint_def,
    v_constraint_validated
  from pg_catalog.pg_constraint as c
  join pg_catalog.pg_class as t
    on t.oid = c.conrelid
  join pg_catalog.pg_namespace as n
    on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'student_lesson_records'
    and c.conname = 'student_lesson_records_homework_achievement_check'
    and c.contype = 'c';

  if not found then
    raise exception '숙제 성취도 CHECK 제약조건을 찾을 수 없습니다.'
      using errcode = 'P0002';
  end if;

  if v_constraint_validated is distinct from true then
    raise exception '숙제 성취도 CHECK 제약조건이 검증되지 않은 상태입니다.'
      using errcode = '55000';
  end if;

  if v_constraint_def is distinct from v_old_constraint
    and v_constraint_def is distinct from v_new_constraint then
    raise exception '숙제 성취도 CHECK 정의가 예상과 다릅니다: %', v_constraint_def
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.student_lesson_records as slr
    where slr.homework_achievement is null
       or slr.homework_achievement not in ('A', 'B', 'C', 'pending', 'not_recorded')
  ) then
    raise exception '허용 목록 밖의 기존 숙제 성취도 데이터가 있습니다.'
      using errcode = '23514';
  end if;

  select
    p.prosrc,
    pg_catalog.pg_get_function_result(p.oid),
    l.lanname
  into
    v_function_source,
    v_function_result,
    v_function_language
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  join pg_catalog.pg_language as l
    on l.oid = p.prolang
  where n.nspname = 'public'
    and p.proname = 'admin_save_lesson_journal'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_session_id uuid, p_class_id uuid, p_session_date date, p_title text, p_lesson_memo text, p_records jsonb';

  if not found then
    raise exception 'admin_save_lesson_journal RPC를 찾을 수 없습니다.'
      using errcode = 'P0002';
  end if;

  if v_function_result is distinct from 'uuid'
    or v_function_language is distinct from 'plpgsql' then
    raise exception 'admin_save_lesson_journal RPC 형식이 예상과 다릅니다.'
      using errcode = '55000';
  end if;

  v_old_validation_count :=
    (length(v_function_source) - length(replace(v_function_source, v_old_validation, '')))
    / length(v_old_validation);
  v_new_validation_count :=
    (length(v_function_source) - length(replace(v_function_source, v_new_validation, '')))
    / length(v_new_validation);

  if not (
    (v_old_validation_count = 2 and v_new_validation_count = 0)
    or
    (v_old_validation_count = 0 and v_new_validation_count = 2)
  ) then
    raise exception
      'admin_save_lesson_journal 숙제 검증 정의가 예상과 다릅니다. old=%, new=%',
      v_old_validation_count,
      v_new_validation_count
      using errcode = '55000';
  end if;

  if v_constraint_def = v_old_constraint then
    execute $replace_constraint$
      alter table public.student_lesson_records
        drop constraint student_lesson_records_homework_achievement_check,
        add constraint student_lesson_records_homework_achievement_check
          check (homework_achievement in ('A', 'B', 'C', 'pending', 'not_recorded'))
    $replace_constraint$;
  end if;
end;
$preflight_and_constraint$;

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

    select c.name
      into v_class_name
    from public.classes as c
    where c.id = p_class_id;

    if not found then
      raise exception '선택한 반을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;

    v_grade := (regexp_match(v_class_name, '고[123]'))[1];
    if v_grade is null then
      raise exception '반 이름에서 고1, 고2 또는 고3 학년 정보를 확인할 수 없습니다.'
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

revoke all on function public.admin_save_lesson_journal(uuid, uuid, date, text, text, jsonb)
  from public, anon;
grant execute on function public.admin_save_lesson_journal(uuid, uuid, date, text, text, jsonb)
  to authenticated, service_role;

do $postflight$
declare
  v_column_type text;
  v_not_null boolean;
  v_default_expr text;
  v_constraint_def text;
  v_constraint_validated boolean;
  v_function_source text;
  v_function_oid oid;
  v_function_owner text;
  v_function_security_definer boolean;
  v_function_config text[];
  v_public_execute boolean;
  v_validation_count integer;
  v_new_constraint constant text := $new_constraint$CHECK (homework_achievement = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'pending'::text, 'not_recorded'::text]))$new_constraint$;
  v_new_validation constant text :=
    $new_validation$v_homework not in ('A', 'B', 'C', 'pending', 'not_recorded')$new_validation$;
begin
  select
    pg_catalog.format_type(a.atttypid, a.atttypmod),
    a.attnotnull,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
  into
    v_column_type,
    v_not_null,
    v_default_expr
  from pg_catalog.pg_attribute as a
  join pg_catalog.pg_class as t
    on t.oid = a.attrelid
  join pg_catalog.pg_namespace as n
    on n.oid = t.relnamespace
  left join pg_catalog.pg_attrdef as ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  where n.nspname = 'public'
    and t.relname = 'student_lesson_records'
    and a.attname = 'homework_achievement'
    and not a.attisdropped;

  if not found
    or v_column_type is distinct from 'text'
    or v_not_null is distinct from true
    or v_default_expr is distinct from $expected_default$'pending'::text$expected_default$ then
    raise exception '마이그레이션 후 homework_achievement 컬럼 검증에 실패했습니다.'
      using errcode = '55000';
  end if;

  select
    pg_catalog.pg_get_constraintdef(c.oid, true),
    c.convalidated
  into
    v_constraint_def,
    v_constraint_validated
  from pg_catalog.pg_constraint as c
  join pg_catalog.pg_class as t
    on t.oid = c.conrelid
  join pg_catalog.pg_namespace as n
    on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'student_lesson_records'
    and c.conname = 'student_lesson_records_homework_achievement_check'
    and c.contype = 'c';

  if not found
    or v_constraint_validated is distinct from true
    or v_constraint_def is distinct from v_new_constraint then
    raise exception '마이그레이션 후 숙제 성취도 CHECK 검증에 실패했습니다: %',
      coalesce(v_constraint_def, '<missing>')
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.student_lesson_records as slr
    where slr.homework_achievement is null
       or slr.homework_achievement not in ('A', 'B', 'C', 'pending', 'not_recorded')
  ) then
    raise exception '마이그레이션 후 허용 목록 밖의 숙제 성취도 데이터가 있습니다.'
      using errcode = '23514';
  end if;

  select
    p.prosrc,
    p.oid,
    pg_catalog.pg_get_userbyid(p.proowner),
    p.prosecdef,
    p.proconfig
  into
    v_function_source,
    v_function_oid,
    v_function_owner,
    v_function_security_definer,
    v_function_config
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_lesson_journal'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_session_id uuid, p_class_id uuid, p_session_date date, p_title text, p_lesson_memo text, p_records jsonb';

  if not found then
    raise exception '마이그레이션 후 admin_save_lesson_journal RPC를 찾을 수 없습니다.'
      using errcode = 'P0002';
  end if;

  v_validation_count :=
    (length(v_function_source) - length(replace(v_function_source, v_new_validation, '')))
    / length(v_new_validation);

  if v_validation_count <> 2
    or v_function_owner is distinct from 'postgres'
    or v_function_security_definer is distinct from true
    or v_function_config is distinct from array['search_path=""']::text[] then
    raise exception
      '마이그레이션 후 RPC 속성 검증에 실패했습니다. validation=%, owner=%, security_definer=%, config=%',
      v_validation_count,
      v_function_owner,
      v_function_security_definer,
      v_function_config
      using errcode = '55000';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) as privilege
    where p.oid = v_function_oid
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) into v_public_execute;

  if v_public_execute
    or pg_catalog.has_function_privilege('anon', v_function_oid, 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', v_function_oid, 'EXECUTE') then
    raise exception '마이그레이션 후 RPC 실행 권한 검증에 실패했습니다.'
      using errcode = '42501';
  end if;
end;
$postflight$;

commit;
