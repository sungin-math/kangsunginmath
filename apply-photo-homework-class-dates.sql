-- 사진 숙제 수업일 2, 3 추가
-- 안전 적용용: 기존 데이터, 제출 사진, 제출 회차, 상태, 피드백, 삭제 이력은 삭제하지 않습니다.
-- 기존 public.photo_homeworks.lesson_date 컬럼은 수업일 1이자 성취도 계산 기준일로 계속 사용합니다.

alter table public.photo_homeworks
  add column if not exists lesson_date_2 date,
  add column if not exists lesson_date_3 date;

comment on column public.photo_homeworks.lesson_date is '수업일 1. 사진 숙제 성취도 계산 기준일';
comment on column public.photo_homeworks.lesson_date_2 is '수업일 2. 학생 참고용 선택 날짜';
comment on column public.photo_homeworks.lesson_date_3 is '수업일 3. 학생 참고용 선택 날짜';

create or replace function public.validate_photo_homework_period()
returns trigger language plpgsql
set search_path = pg_catalog, public
as E'declare period_start date;
  period_end date;
begin
  select start_date, end_date
    into period_start, period_end
  from public.learning_periods
  where id = new.period_id and grade_level = new.grade_level;

  if period_start is null then
    raise exception ''학습 기간과 대상 학년이 일치하지 않습니다.'' using errcode = ''23514'';
  end if;

  if new.lesson_date < period_start or new.lesson_date > period_end then
    raise exception ''수업일 1은 학습 기간 안에 있어야 합니다.'' using errcode = ''23514'';
  end if;

  if new.lesson_date_2 is not null and (new.lesson_date_2 < period_start or new.lesson_date_2 > period_end) then
    raise exception ''수업일 2는 학습 기간 안에 있어야 합니다.'' using errcode = ''23514'';
  end if;

  if new.lesson_date_3 is not null and (new.lesson_date_3 < period_start or new.lesson_date_3 > period_end) then
    raise exception ''수업일 3은 학습 기간 안에 있어야 합니다.'' using errcode = ''23514'';
  end if;

  return new;
end;';

drop trigger if exists validate_photo_homework_period_trigger on public.photo_homeworks;

create trigger validate_photo_homework_period_trigger
before insert or update on public.photo_homeworks
for each row execute function public.validate_photo_homework_period();
