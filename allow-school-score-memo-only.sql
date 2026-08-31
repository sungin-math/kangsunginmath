-- 점수 없이 등급이나 메모만 저장할 수 있도록 점수 필수 조건을 해제합니다.
-- 기존 성적 데이터는 변경하거나 삭제하지 않습니다.
begin;

alter table public.student_scores
  alter column score drop not null;

commit;
