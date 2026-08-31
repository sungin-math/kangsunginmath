drop trigger if exists validate_photo_homework_period_trigger on public.photo_homeworks;

create trigger validate_photo_homework_period_trigger before insert or update on public.photo_homeworks
for each row execute function public.validate_photo_homework_period();

drop trigger if exists photo_homework_assign_students on public.photo_homeworks;

create trigger photo_homework_assign_students
after insert on public.photo_homeworks
for each row execute function public.assign_photo_homework_students();

revoke all on function public.assign_photo_homework_students() from public,anon,authenticated;

revoke all on function public.validate_photo_homework_period() from public,anon,authenticated;

revoke all on function public.server_add_photo(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;

revoke all on function public.server_delete_photo(uuid,uuid) from public,anon,authenticated;

grant execute on function public.server_add_photo(uuid,uuid,text,text,text,bigint) to service_role;

grant execute on function public.server_delete_photo(uuid,uuid) to service_role;

revoke all on function public.admin_review_photo_assignment(uuid,text,text) from public,anon;

revoke all on function public.admin_complete_photo_assignments(uuid[]) from public,anon;

grant execute on function public.admin_review_photo_assignment(uuid,text,text) to authenticated;

grant execute on function public.admin_complete_photo_assignments(uuid[]) to authenticated;
