create or replace function public.admin_complete_photo_assignments(target_assignment_ids uuid[])
returns table(assignment_id uuid, success boolean, message text) language plpgsql security definer set search_path=pg_catalog,public
as E'declare x uuid\x3b
begin
  if lower(coalesce(auth.jwt()->>''email'','''')) <> ''tjddls9288@naver.com'' then raise exception ''관리자 권한이 없습니다.'' using errcode=''42501''\x3b end if\x3b
  foreach x in array target_assignment_ids loop
    update public.photo_homework_assignments set status=''completed'',reviewed_at=now() where id=x and status=''pending''\x3b
    if found then assignment_id:=x\x3b success:=true\x3b message:=''완료''\x3b
    else assignment_id:=x\x3b success:=false\x3b message:=''확인 대기 상태가 아니거나 존재하지 않습니다.''\x3b end if\x3b
    return next\x3b
  end loop\x3b
end\x3b';
