create or replace function public.admin_review_photo_assignment(target_assignment_id uuid, target_status text, target_feedback text default '')
returns void language plpgsql security definer set search_path=pg_catalog,public
as E'declare current_status text\x3b
begin
  if lower(coalesce(auth.jwt()->>''email'','''')) <> ''tjddls9288@naver.com'' then raise exception ''관리자 권한이 없습니다.'' using errcode=''42501''\x3b end if\x3b
  if target_status not in (''completed'',''redo'') then raise exception ''잘못된 상태입니다.'' using errcode=''22023''\x3b end if\x3b
  select status into current_status from public.photo_homework_assignments where id=target_assignment_id for update\x3b
  if current_status is null then raise exception ''제출 정보를 찾을 수 없습니다.'' using errcode=''P0002''\x3b end if\x3b
  if target_status=''completed'' and current_status<>''pending'' then raise exception ''확인 대기 상태만 완료 처리할 수 있습니다.'' using errcode=''55000''\x3b end if\x3b
  if target_status=''redo'' and current_status not in (''pending'',''completed'') then raise exception ''제출된 숙제만 다시 풀기로 변경할 수 있습니다.'' using errcode=''55000''\x3b end if\x3b
  update public.photo_homework_assignments set status=target_status, admin_feedback=coalesce(target_feedback,''''), reviewed_at=now() where id=target_assignment_id\x3b
end\x3b';
