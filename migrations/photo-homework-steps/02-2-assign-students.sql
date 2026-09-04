create or replace function public.assign_photo_homework_students()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as E'begin
  insert into public.photo_homework_assignments (
    homework_id, student_id, assigned_grade_level, assigned_class_id,
    assigned_class_name, student_name_snapshot, school_snapshot
  )
  select new.id, s.id, new.grade_level, s.class_id, coalesce(c.name,''''), s.name, coalesce(s.school,'''')
  from public.students s
  left join public.classes c on c.id = s.class_id
  where c.name ~ new.grade_level
  on conflict (homework_id, student_id) do nothing\x3b
  return new\x3b
end\x3b';
