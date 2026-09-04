-- 선택 실행용: 초기 사진 숙제 학습 기간 3건
-- apply-photo-homework-management.sql 실행 후 사용할 수 있습니다.
-- 같은 기간 이름과 학년이 이미 있으면 아무것도 변경하지 않습니다.

insert into public.learning_periods(name,grade_level,start_date,end_date,is_active)
values
 ('2학기 중간고사 필인교재 복습','고1','2026-07-03','2026-08-26',true),
 ('2학기 중간고사 필인교재 복습','고2','2026-07-03','2026-08-26',true),
 ('2학기 중간고사 필인교재 복습','고3','2026-07-03','2026-08-26',true)
on conflict(name,grade_level) do nothing;
