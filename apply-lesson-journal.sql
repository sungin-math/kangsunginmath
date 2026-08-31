-- 관리자 전용 수업일지 기능
-- 기존 테이블과 데이터는 수정하거나 삭제하지 않습니다.

begin;

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  class_id_snapshot uuid not null,
  session_date date not null,
  title text not null check (btrim(title) <> ''),
  lesson_memo text,
  class_name_snapshot text not null check (btrim(class_name_snapshot) <> ''),
  grade_snapshot text not null check (grade_snapshot in ('고1', '고2', '고3')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_live_class_matches_snapshot
    check (class_id is null or class_id = class_id_snapshot)
);

create table if not exists public.student_lesson_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  student_id uuid references public.students(id) on delete set null,
  student_id_snapshot uuid not null,
  student_name_snapshot text not null check (btrim(student_name_snapshot) <> ''),
  school_snapshot text,
  class_name_snapshot text not null check (btrim(class_name_snapshot) <> ''),
  grade_snapshot text not null check (grade_snapshot in ('고1', '고2', '고3')),
  attendance_status text not null default 'present'
    check (attendance_status in ('present', 'late', 'absent', 'early_leave', 'makeup')),
  homework_achievement text not null default 'pending'
    check (homework_achievement in ('A', 'B', 'C', 'pending', 'not_recorded')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_lesson_records_live_student_matches_snapshot
    check (student_id is null or student_id = student_id_snapshot),
  constraint student_lesson_records_session_live_student_unique unique (session_id, student_id),
  constraint student_lesson_records_session_student_unique unique (session_id, student_id_snapshot)
);

create index if not exists class_sessions_session_date_idx
  on public.class_sessions (session_date desc);
create index if not exists class_sessions_class_snapshot_date_idx
  on public.class_sessions (class_id_snapshot, session_date desc);
create index if not exists student_lesson_records_student_session_idx
  on public.student_lesson_records (student_id_snapshot, session_id);
create index if not exists student_lesson_records_live_student_session_idx
  on public.student_lesson_records (student_id, session_id);

create or replace function public.set_lesson_journal_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists class_sessions_set_updated_at on public.class_sessions;
create trigger class_sessions_set_updated_at
before update on public.class_sessions
for each row execute function public.set_lesson_journal_updated_at();

drop trigger if exists student_lesson_records_set_updated_at on public.student_lesson_records;
create trigger student_lesson_records_set_updated_at
before update on public.student_lesson_records
for each row execute function public.set_lesson_journal_updated_at();

alter table public.class_sessions enable row level security;
alter table public.student_lesson_records enable row level security;

drop policy if exists "Lesson journal admin select" on public.class_sessions;
drop policy if exists "Lesson journal admin insert" on public.class_sessions;
drop policy if exists "Lesson journal admin update" on public.class_sessions;
drop policy if exists "Lesson record admin select" on public.student_lesson_records;
drop policy if exists "Lesson record admin insert" on public.student_lesson_records;
drop policy if exists "Lesson record admin update" on public.student_lesson_records;

create policy "Lesson journal admin select"
on public.class_sessions
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Lesson journal admin insert"
on public.class_sessions
for insert
to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Lesson journal admin update"
on public.class_sessions
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Lesson record admin select"
on public.student_lesson_records
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Lesson record admin insert"
on public.student_lesson_records
for insert
to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Lesson record admin update"
on public.student_lesson_records
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

-- 새 Supabase Data API 권한 정책에도 대응합니다.
-- 브라우저는 조회만 직접 수행하고, 저장은 아래 관리자 RPC만 사용합니다.
revoke all on table public.class_sessions from public, anon;
revoke all on table public.student_lesson_records from public, anon;
revoke all on table public.class_sessions from authenticated;
revoke all on table public.student_lesson_records from authenticated;
grant select on table public.class_sessions to authenticated;
grant select on table public.student_lesson_records to authenticated;
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

revoke all on function public.set_lesson_journal_updated_at() from public, anon, authenticated;
revoke all on function public.admin_save_lesson_journal(uuid, uuid, date, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_save_lesson_journal(uuid, uuid, date, text, text, jsonb)
  to authenticated, service_role;

comment on table public.class_sessions is
  '관리자 전용 수업일지 본문. 반 이름과 학년은 저장 당시 스냅샷으로 보존';
comment on table public.student_lesson_records is
  '수업일지의 학생별 출결, 숙제 성취도, 메모. 학생 정보는 저장 당시 스냅샷으로 보존';
comment on column public.class_sessions.class_id_snapshot is
  '반이 나중에 삭제되어도 과거 조회·수정을 유지하기 위한 저장 당시 반 UUID';
comment on column public.student_lesson_records.student_id_snapshot is
  '학생이 나중에 삭제되어도 과거 조회·수정을 유지하기 위한 저장 당시 학생 UUID';

commit;
