-- 주간 보고서 대상 반을 반 설정으로 옮김
--
-- 지금은 app.js에 반 이름이 문자열로 박혀 있습니다.
--
--   const WEEKLY_REPORT_TARGET_CLASS_NAMES = ["고1 수학 A반", "고1 수학 M반"];
--
-- 이 이름으로 반을 찾지 못하면 예외를 던져 보고서 전체가 막힙니다.
-- 반 이름을 한 글자만 바꿔도, 예를 들어 "고1 수학 A반"을 "고1 A반"으로
-- 줄여도 그렇게 됩니다. 반 이름은 관리자 화면에서 언제든 바꿀 수 있는
-- 값인데 코드가 그 값에 묶여 있었습니다.
--
-- 대상 여부를 반 자체의 속성으로 두고, 관리자가 반 수정 화면에서
-- 켜고 끄도록 바꿉니다.

begin;

alter table public.classes
  add column if not exists weekly_report_target boolean not null default false;

comment on column public.classes.weekly_report_target is
  '주간 보고서 집계 대상 여부. 관리자 화면의 반 수정에서 켜고 끕니다.';

-- 지금 보고서가 보고 있는 두 반에 표시를 켭니다.
-- 이 파일을 적용해도 보고서 대상이 달라지지 않게 하기 위해서입니다.
update public.classes
   set weekly_report_target = true
 where name in ('고1 수학 A반', '고1 수학 M반')
   and grade_level = '고1';

commit;


-- 확인용 조회 (실행하지 않아도 됩니다)
--
--   select name, grade_level, weekly_report_target
--     from public.classes
--    order by grade_level, name;
--
-- 두 반이 true로 나와야 합니다. 이름을 이미 바꾸셨다면 0건일 수 있으니
-- 그때는 관리자 화면의 반 수정에서 직접 켜주세요.
--
--
-- ※ 실행 순서
--
--   이 파일을 먼저 실행하고 배포하세요.
--   열이 없는 상태로 새 코드가 배포되면 주간 보고서가 열리지 않습니다.
--   (반을 하나도 찾지 못해 안내 문구가 뜹니다. 다른 화면은 영향 없습니다.)
