-- 사진 숙제 관리 기능 (기존 데이터/테이블을 삭제하지 않음)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.learning_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  grade_level text not null check (grade_level in ('고1','고2','고3')),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint learning_period_dates_check check (start_date <= end_date),
  constraint learning_period_name_grade_unique unique (name, grade_level)
);

create table if not exists public.photo_homeworks (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.learning_periods(id) on delete restrict,
  grade_level text not null check (grade_level in ('고1','고2','고3')),
  lesson_date date not null,
  title text not null check (btrim(title) <> ''),
  problem_range text not null check (btrim(problem_range) <> ''),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_homework_period_grade_unique unique (id, period_id, grade_level)
);

create table if not exists public.photo_homework_assignments (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.photo_homeworks(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  assigned_grade_level text not null check (assigned_grade_level in ('고1','고2','고3')),
  assigned_class_id uuid references public.classes(id) on delete set null,
  assigned_class_name text not null default '',
  student_name_snapshot text not null,
  school_snapshot text not null default '',
  status text not null default 'not_submitted' check (status in ('not_submitted','pending','completed','redo')),
  admin_feedback text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint photo_assignment_student_unique unique (homework_id, student_id)
);

create table if not exists public.photo_submission_rounds (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.photo_homework_assignments(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  submitted_at timestamptz not null default now(),
  constraint photo_submission_round_unique unique (assignment_id, round_number)
);

create table if not exists public.photo_submission_photos (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.photo_submission_rounds(id) on delete cascade,
  assignment_id uuid not null references public.photo_homework_assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  storage_path text not null unique check (storage_path !~ '\\.\\.'),
  original_file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.photo_deletion_logs (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid,
  assignment_id uuid not null references public.photo_homework_assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  round_number integer not null,
  original_file_name text not null,
  storage_path text not null,
  deleted_at timestamptz not null default now()
);

create index if not exists photo_homeworks_period_date_idx on public.photo_homeworks(period_id, lesson_date);
create index if not exists photo_assignments_student_status_idx on public.photo_homework_assignments(student_id, status);
create index if not exists photo_assignments_class_idx on public.photo_homework_assignments(assigned_class_id);
create index if not exists photo_assignments_status_created_idx on public.photo_homework_assignments(status, created_at desc);
create index if not exists photo_assignments_homework_created_idx on public.photo_homework_assignments(homework_id, created_at desc);
create index if not exists photo_rounds_assignment_idx on public.photo_submission_rounds(assignment_id, round_number desc);
create index if not exists photo_photos_assignment_idx on public.photo_submission_photos(assignment_id, uploaded_at);
create index if not exists photo_logs_assignment_idx on public.photo_deletion_logs(assignment_id, deleted_at);

create or replace function public.validate_photo_homework_period()
returns trigger language plpgsql set search_path=pg_catalog,public
as E'declare period_grade text\x3b period_start date\x3b period_end date\x3b
begin
  select grade_level,start_date,end_date into period_grade,period_start,period_end from public.learning_periods where id=new.period_id\x3b
  if period_grade is null or period_grade <> new.grade_level then
    raise exception ''학습 기간과 대상 학년이 일치하지 않습니다.'' using errcode=''23514''\x3b
  end if\x3b
  if new.lesson_date < period_start or new.lesson_date > period_end then
    raise exception ''수업 날짜는 학습 기간 안에 있어야 합니다.'' using errcode=''23514''\x3b
  end if\x3b
  if tg_op=''UPDATE'' and (new.grade_level<>old.grade_level or new.period_id<>old.period_id)
     and exists(select 1 from public.photo_homework_assignments where homework_id=old.id) then
    raise exception ''학생 배정 후에는 학습 기간과 학년을 변경할 수 없습니다.'' using errcode=''55000''\x3b
  end if\x3b
  return new\x3b
end\x3b';

drop trigger if exists validate_photo_homework_period_trigger on public.photo_homeworks;
create trigger validate_photo_homework_period_trigger before insert or update on public.photo_homeworks
for each row execute function public.validate_photo_homework_period();

alter table public.learning_periods enable row level security;
alter table public.photo_homeworks enable row level security;
alter table public.photo_homework_assignments enable row level security;
alter table public.photo_submission_rounds enable row level security;
alter table public.photo_submission_photos enable row level security;
alter table public.photo_deletion_logs enable row level security;

drop policy if exists "Photo homework admin only" on public.learning_periods;
create policy "Photo homework admin only" on public.learning_periods
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_homeworks;
create policy "Photo homework admin only" on public.photo_homeworks
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_homework_assignments;
create policy "Photo homework admin only" on public.photo_homework_assignments
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_submission_rounds;
create policy "Photo homework admin only" on public.photo_submission_rounds
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_submission_photos;
create policy "Photo homework admin only" on public.photo_submission_photos
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

drop policy if exists "Photo homework admin only" on public.photo_deletion_logs;
create policy "Photo homework admin only" on public.photo_deletion_logs
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

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

drop trigger if exists photo_homework_assign_students on public.photo_homeworks;
create trigger photo_homework_assign_students
after insert on public.photo_homeworks
for each row execute function public.assign_photo_homework_students();

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

-- private bucket: public=false. 이미 있으면 그대로 유지하면서 비공개로 강제한다.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('photo-homework-private','photo-homework-private',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

-- 브라우저 역할에는 Storage 직접 정책을 만들지 않는다. 서버(service_role)만 접근한다.
drop policy if exists "Public photo homework access" on storage.objects;
drop policy if exists "Anon photo homework access" on storage.objects;

-- 초기 운영 기간: 같은 이름+학년이 있으면 중복 생성하지 않는다.
insert into public.learning_periods(name,grade_level,start_date,end_date,is_active)
values
 ('2학기 중간고사 필인교재 복습','고1','2026-07-03','2026-08-26',true),
 ('2학기 중간고사 필인교재 복습','고2','2026-07-03','2026-08-26',true),
 ('2학기 중간고사 필인교재 복습','고3','2026-07-03','2026-08-26',true)
on conflict(name,grade_level) do nothing;
