-- 기존 Supabase 프로젝트의 SQL Editor에서 이 파일 전체를 한 번 실행하세요.
-- 데이터나 테이블은 변경하지 않고 관리자 RLS 정책만 교체합니다.
begin;

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.homeworks enable row level security;
alter table public.videos enable row level security;
alter table public.video_views enable row level security;

drop policy if exists "Admin can manage classes" on public.classes;
drop policy if exists "Admin can manage students" on public.students;
drop policy if exists "Admin can manage homeworks" on public.homeworks;
drop policy if exists "Admin can manage videos" on public.videos;
drop policy if exists "Admin can read video views" on public.video_views;
drop policy if exists "Admin can delete video views" on public.video_views;
drop policy if exists "Admin can manage video views" on public.video_views;

create policy "Admin can manage classes"
on public.classes for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Admin can manage students"
on public.students for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Admin can manage homeworks"
on public.homeworks for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Admin can manage videos"
on public.videos for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

create policy "Admin can manage video views"
on public.video_views for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'tjddls9288@naver.com');

commit;

-- 기존 "Anyone can read ..." 정책과 "Students can record video views" 정책은
-- 학생용 화면 및 영상 클릭 기록 유지를 위해 변경하지 않습니다.
