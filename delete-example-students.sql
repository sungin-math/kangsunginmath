-- 선택 실행용: 초기 예제 학생 3명만 삭제합니다.
-- Supabase SQL Editor에서 먼저 SELECT 결과를 확인한 뒤,
-- 삭제하려는 경우에만 아래 DELETE 구문을 실행하세요.

select id, name, school, class_id, created_at
from public.students
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
);

-- 아래 구문은 위의 고정 UUID 3개만 대상으로 합니다.
-- 학생 삭제 시 해당 학생의 video_views 행은 외래 키 설정에 따라 함께 삭제됩니다.
delete from public.students
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
)
returning id, name, school;
