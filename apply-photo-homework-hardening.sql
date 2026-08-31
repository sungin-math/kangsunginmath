-- 종료되거나 비활성화된 학습기간의 학생 사진 추가/삭제를 DB에서도 차단합니다.
-- 기존 사진, 제출 회차, 상태, 피드백, 삭제 이력은 변경하지 않습니다.
begin;

-- 관리자 제출 확인 목록을 페이지 단위로 조회할 때 사용하는 인덱스입니다.
create index if not exists photo_assignments_status_created_idx
  on public.photo_homework_assignments (status, created_at desc);
create index if not exists photo_assignments_homework_created_idx
  on public.photo_homework_assignments (homework_id, created_at desc);

create or replace function public.server_add_photo(
  target_student_id uuid,
  target_assignment_id uuid,
  target_storage_path text,
  target_original_name text,
  target_mime_type text,
  target_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  a public.photo_homework_assignments%rowtype;
  period_active boolean;
  period_end date;
  r_id uuid;
  r_no integer;
  p_id uuid;
begin
  select *
  into a
  from public.photo_homework_assignments
  where id = target_assignment_id
    and student_id = target_student_id
  for update;

  if not found then
    raise exception '배정된 숙제가 아닙니다.' using errcode = '42501';
  end if;

  select lp.is_active, lp.end_date
  into period_active, period_end
  from public.photo_homeworks h
  join public.learning_periods lp on lp.id = h.period_id
  where h.id = a.homework_id
  for share of lp;

  if not found then
    raise exception '학습기간 정보를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if not period_active
     or (now() at time zone 'Asia/Seoul')::date > period_end then
    raise exception '종료되거나 비활성화된 학습기간에는 사진을 제출할 수 없습니다.'
      using errcode = '55000';
  end if;

  if a.status = 'completed' then
    raise exception '확인 완료된 숙제입니다.' using errcode = '55000';
  end if;

  if target_storage_path not like (target_student_id::text || '/' || a.homework_id::text || '/%')
     or target_storage_path like '%..%' then
    raise exception '잘못된 사진 저장 경로입니다.' using errcode = '42501';
  end if;

  if target_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
     or target_file_size < 1
     or target_file_size > 10485760 then
    raise exception '허용되지 않은 사진입니다.' using errcode = '22023';
  end if;

  if a.status in ('not_submitted', 'redo') then
    select coalesce(max(round_number), 0) + 1
    into r_no
    from public.photo_submission_rounds
    where assignment_id = a.id;

    insert into public.photo_submission_rounds (assignment_id, round_number)
    values (a.id, r_no)
    returning id into r_id;
  else
    select id
    into r_id
    from public.photo_submission_rounds
    where assignment_id = a.id
    order by round_number desc
    limit 1;

    if r_id is null then
      insert into public.photo_submission_rounds (assignment_id, round_number)
      values (a.id, 1)
      returning id into r_id;
    end if;
  end if;

  insert into public.photo_submission_photos (
    round_id,
    assignment_id,
    student_id,
    storage_path,
    original_file_name,
    mime_type,
    file_size
  )
  values (
    r_id,
    a.id,
    target_student_id,
    target_storage_path,
    btrim(target_original_name),
    target_mime_type,
    target_file_size
  )
  returning id into p_id;

  update public.photo_homework_assignments
  set status = 'pending', reviewed_at = null
  where id = a.id;

  return p_id;
end;
$function$;

create or replace function public.server_delete_photo(
  target_student_id uuid,
  target_photo_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  p public.photo_submission_photos%rowtype;
  a public.photo_homework_assignments%rowtype;
  period_active boolean;
  period_end date;
  r_no integer;
  remaining integer;
begin
  select *
  into p
  from public.photo_submission_photos
  where id = target_photo_id
    and student_id = target_student_id
    and deleted_at is null
  for update;

  if not found then
    raise exception '사진을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select *
  into a
  from public.photo_homework_assignments
  where id = p.assignment_id
  for update;

  if not found then
    raise exception '숙제 배정 정보를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select lp.is_active, lp.end_date
  into period_active, period_end
  from public.photo_homeworks h
  join public.learning_periods lp on lp.id = h.period_id
  where h.id = a.homework_id
  for share of lp;

  if not found then
    raise exception '학습기간 정보를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if not period_active
     or (now() at time zone 'Asia/Seoul')::date > period_end then
    raise exception '종료되거나 비활성화된 학습기간에는 사진을 삭제할 수 없습니다.'
      using errcode = '55000';
  end if;

  if a.status = 'completed' then
    raise exception '완료된 숙제의 사진은 삭제할 수 없습니다.' using errcode = '55000';
  end if;

  select round_number
  into r_no
  from public.photo_submission_rounds
  where id = p.round_id;

  update public.photo_submission_photos
  set deleted_at = now()
  where id = p.id;

  insert into public.photo_deletion_logs (
    photo_id,
    assignment_id,
    student_id,
    round_number,
    original_file_name,
    storage_path
  )
  values (
    p.id,
    p.assignment_id,
    p.student_id,
    r_no,
    p.original_file_name,
    p.storage_path
  );

  select count(*)
  into remaining
  from public.photo_submission_photos
  where assignment_id = p.assignment_id
    and deleted_at is null;

  if remaining = 0 then
    update public.photo_homework_assignments
    set status = 'not_submitted'
    where id = p.assignment_id;
  end if;

  return p.storage_path;
end;
$function$;

-- 브라우저 역할에는 실행 권한을 주지 않고 서버(service_role)만 호출합니다.
revoke all on function public.server_add_photo(uuid, uuid, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.server_delete_photo(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.server_add_photo(uuid, uuid, text, text, text, bigint)
  to service_role;
grant execute on function public.server_delete_photo(uuid, uuid)
  to service_role;

-- 사진 숙제 테이블의 기존 RLS와 관리자 이메일 정책은 변경하지 않습니다.
commit;
