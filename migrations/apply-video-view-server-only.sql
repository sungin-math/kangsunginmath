-- 시청 기록 삽입을 서버 경유로만 처리
--
-- 이전 상태:
--
--   create policy "Students can record video views"
--   on public.video_views for insert
--   to anon, authenticated
--   with check (true);
--
-- with check (true)라 조건이 없었습니다. anon key는 브라우저에 그대로
-- 나가 있으므로, 누구든 그 키로 임의의 student_id와 video_id를 붙여
-- 시청 기록을 무제한 넣을 수 있었습니다. 통계가 오염되고 테이블이
-- 계속 커지는 경로였습니다.
--
-- 이제 Netlify Function의 record-video-view가 학생 세션 토큰에서
-- student_id를 정해 service_role로 넣습니다. service_role은 RLS를
-- 우회하므로 대체 정책을 만들 필요가 없습니다.
--
--
-- ※ 실행 순서를 지켜주세요.
--
--   1) 먼저 배포합니다. (git push 후 Netlify 배포 완료 확인)
--   2) 그 다음 이 파일을 실행합니다.
--
--   순서를 바꾸면 그 사이에 접속한 학생의 시청 기록이 유실됩니다.
--   배포 전에 정책을 지우면 옛 코드가 브라우저에서 직접 넣던 경로가
--   막히기 때문입니다. 로그인처럼 전면 중단되지는 않고 기록만
--   조용히 실패합니다(호출부가 catch로 감싸고 있습니다).

begin;

drop policy if exists "Students can record video views" on public.video_views;

commit;


-- 확인용 조회 (실행하지 않아도 됩니다)
--
-- 남은 정책이 관리자용 하나뿐이어야 합니다.
--
--   select policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'video_views';
--
--
-- 되돌리려면:
--
--   create policy "Students can record video views"
--   on public.video_views for insert
--   to anon, authenticated
--   with check (true);
