-- 관리자 시청 기록의 최근 30일 조회 및 학생별 페이지 조회 성능 개선
--
-- 안전성:
-- - 기존 video_views 행을 추가·수정·삭제하지 않습니다.
-- - 테이블 구조, 외래 키, RLS 및 기존 정책을 변경하지 않습니다.
-- - IF NOT EXISTS를 사용하므로 같은 이름의 인덱스가 이미 있으면 다시 만들지 않습니다.
-- - 전체 작업은 하나의 트랜잭션으로 적용됩니다.

begin;

-- 최근 30일 기록을 clicked_at 내림차순으로 조회할 때 사용합니다.
create index if not exists video_views_clicked_at_desc_idx
  on public.video_views (clicked_at desc);

-- 학생 ID로 필터링한 시청 기록을 최신순으로 조회할 때 사용합니다.
create index if not exists video_views_student_id_clicked_at_desc_idx
  on public.video_views (student_id, clicked_at desc);

commit;
