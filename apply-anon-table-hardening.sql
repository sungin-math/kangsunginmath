-- anon 역할의 테이블 권한 회수 (이중 방어)
--
-- RLS는 정책이 없으면 에러 대신 0건을 돌려줍니다. 그래서 아래 테이블들은
-- 지금도 anon으로 조회하면 200 []이 나오고 실제로 새는 데이터는 없습니다.
--
-- 문제는 그 방어가 RLS 하나에만 걸려 있다는 점입니다. 나중에 허용 정책을
-- 하나 잘못 추가하거나 RLS를 끄는 순간 곧바로 열립니다. 테이블 권한까지
-- 회수해두면 그런 경우에도 버팁니다. student_scores와 login_attempts는
-- 이미 이렇게 돼 있어서, 조회하면 []이 아니라 42501이 납니다.
--
-- anon에서만 회수합니다. authenticated는 그대로 둡니다.
-- 관리자 화면이 authenticated로 이 테이블들을 읽기 때문입니다.
--
-- 지금 anon으로 동작하는 조회가 없으므로(전부 0건) 깨지는 기능은 없습니다.
--
--
-- classes / videos / homeworks는 제외했습니다.
-- 이 셋은 "Anyone can read" 정책으로 실제 데이터를 돌려주고 있고,
-- 학생 화면이 anon key로 직접 읽습니다. 학생은 Supabase 인증 사용자가
-- 아니라 자체 세션 토큰만 갖기 때문입니다. 권한을 회수하면 학생 화면이
-- 즉시 깨집니다. 이 셋을 닫으려면 로그인·시청기록처럼 Netlify Function
-- 경유로 바꿔야 하며, 별도 작업입니다.

begin;

revoke all on table public.students                   from anon;
revoke all on table public.student_notes              from anon;
revoke all on table public.counseling_records         from anon;
revoke all on table public.video_views                from anon;
revoke all on table public.learning_periods           from anon;
revoke all on table public.photo_homeworks            from anon;
revoke all on table public.photo_homework_assignments from anon;
revoke all on table public.photo_submission_photos    from anon;
revoke all on table public.photo_deletion_logs        from anon;

commit;


-- 확인용 조회 (실행하지 않아도 됩니다)
--
-- 회수 후 anon으로 조회하면 200 []이 아니라 401 42501이 납니다.
--
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee = 'anon' and table_schema = 'public'
--    order by table_name;
--
-- 여기 남아 있어야 정상인 것: classes, videos, homeworks
--
--
-- 앞으로 테이블을 새로 만들 때 주의:
-- Supabase 기본 설정은 새 테이블 권한을 anon에도 부여합니다.
-- 학생 화면이 직접 읽어야 하는 테이블이 아니라면 만든 직후
-- revoke all on table public.새테이블 from anon; 을 함께 실행하세요.
