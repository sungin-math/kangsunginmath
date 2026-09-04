-- 사진숙제 학습기간별 100% 달성 보상 문구 추가
-- 기존 학습기간, 숙제, 제출, 사진 데이터는 삭제하거나 변경하지 않습니다.

begin;

alter table public.learning_periods
  add column if not exists reward_title text not null default '',
  add column if not exists reward_before_message text not null default '',
  add column if not exists reward_achieved_message text not null default '';

comment on column public.learning_periods.reward_title is '사진숙제 학습기간 100% 달성 보상명';
comment on column public.learning_periods.reward_before_message is '사진숙제 학습기간 100% 달성 전 학생 안내 문구';
comment on column public.learning_periods.reward_achieved_message is '사진숙제 학습기간 100% 달성 후 학생 안내 문구';

-- RLS 정책과 권한은 기존 learning_periods 정책을 그대로 사용합니다.
-- anon 또는 일반 authenticated 사용자에게 추가 권한을 부여하지 않습니다.

commit;
