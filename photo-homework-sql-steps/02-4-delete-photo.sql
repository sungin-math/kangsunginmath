create or replace function public.server_delete_photo(target_student_id uuid, target_photo_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog,public
as E'declare p public.photo_submission_photos%rowtype\x3b a public.photo_homework_assignments%rowtype\x3b period_active boolean\x3b period_end date\x3b r_no integer\x3b remaining integer\x3b
begin
  select * into p from public.photo_submission_photos where id=target_photo_id and student_id=target_student_id and deleted_at is null for update\x3b
  if not found then raise exception ''사진을 찾을 수 없습니다.'' using errcode=''P0002''\x3b end if\x3b
  select * into a from public.photo_homework_assignments where id=p.assignment_id for update\x3b
  if not found then raise exception ''숙제 배정 정보를 찾을 수 없습니다.'' using errcode=''P0002''\x3b end if\x3b
  select lp.is_active,lp.end_date into period_active,period_end
  from public.photo_homeworks h join public.learning_periods lp on lp.id=h.period_id
  where h.id=a.homework_id for share of lp\x3b
  if not found then raise exception ''학습기간 정보를 찾을 수 없습니다.'' using errcode=''P0002''\x3b end if\x3b
  if not period_active or (now() at time zone ''Asia/Seoul'')::date > period_end then
    raise exception ''종료되거나 비활성화된 학습기간에는 사진을 삭제할 수 없습니다.'' using errcode=''55000''\x3b
  end if\x3b
  if a.status=''completed'' then raise exception ''완료된 숙제의 사진은 삭제할 수 없습니다.'' using errcode=''55000''\x3b end if\x3b
  select round_number into r_no from public.photo_submission_rounds where id=p.round_id\x3b
  update public.photo_submission_photos set deleted_at=now() where id=p.id\x3b
  insert into public.photo_deletion_logs(photo_id,assignment_id,student_id,round_number,original_file_name,storage_path)
  values(p.id,p.assignment_id,p.student_id,r_no,p.original_file_name,p.storage_path)\x3b
  select count(*) into remaining from public.photo_submission_photos where assignment_id=p.assignment_id and deleted_at is null\x3b
  if remaining=0 then update public.photo_homework_assignments set status=''not_submitted'' where id=p.assignment_id\x3b end if\x3b
  return p.storage_path\x3b
end\x3b';
