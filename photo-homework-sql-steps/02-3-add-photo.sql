create or replace function public.server_add_photo(
  target_student_id uuid, target_assignment_id uuid, target_storage_path text,
  target_original_name text, target_mime_type text, target_file_size bigint
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public
as E'declare a public.photo_homework_assignments%rowtype\x3b period_active boolean\x3b period_end date\x3b r_id uuid\x3b r_no integer\x3b p_id uuid\x3b
begin
  select * into a from public.photo_homework_assignments where id=target_assignment_id and student_id=target_student_id for update\x3b
  if not found then raise exception ''배정된 숙제가 아닙니다.'' using errcode=''42501''\x3b end if\x3b
  select lp.is_active,lp.end_date into period_active,period_end
  from public.photo_homeworks h join public.learning_periods lp on lp.id=h.period_id
  where h.id=a.homework_id for share of lp\x3b
  if not found then raise exception ''학습기간 정보를 찾을 수 없습니다.'' using errcode=''P0002''\x3b end if\x3b
  if not period_active or (now() at time zone ''Asia/Seoul'')::date > period_end then
    raise exception ''종료되거나 비활성화된 학습기간에는 사진을 제출할 수 없습니다.'' using errcode=''55000''\x3b
  end if\x3b
  if a.status=''completed'' then raise exception ''확인 완료된 숙제입니다.'' using errcode=''55000''\x3b end if\x3b
  if target_storage_path not like (target_student_id::text || ''/'' || a.homework_id::text || ''/%'') or target_storage_path like ''%..%'' then
    raise exception ''잘못된 사진 저장 경로입니다.'' using errcode=''42501''\x3b
  end if\x3b
  if target_mime_type not in (''image/jpeg'',''image/png'',''image/webp'') or target_file_size < 1 or target_file_size > 10485760 then
    raise exception ''허용되지 않은 사진입니다.'' using errcode=''22023''\x3b
  end if\x3b
  if a.status in (''not_submitted'',''redo'') then
    select coalesce(max(round_number),0)+1 into r_no from public.photo_submission_rounds where assignment_id=a.id\x3b
    insert into public.photo_submission_rounds(assignment_id,round_number) values(a.id,r_no) returning id into r_id\x3b
  else
    select id into r_id from public.photo_submission_rounds where assignment_id=a.id order by round_number desc limit 1\x3b
    if r_id is null then
      insert into public.photo_submission_rounds(assignment_id,round_number) values(a.id,1) returning id into r_id\x3b
    end if\x3b
  end if\x3b
  insert into public.photo_submission_photos(round_id,assignment_id,student_id,storage_path,original_file_name,mime_type,file_size)
  values(r_id,a.id,target_student_id,target_storage_path,btrim(target_original_name),target_mime_type,target_file_size) returning id into p_id\x3b
  update public.photo_homework_assignments set status=''pending'', reviewed_at=null where id=a.id\x3b
  return p_id\x3b
end\x3b';
