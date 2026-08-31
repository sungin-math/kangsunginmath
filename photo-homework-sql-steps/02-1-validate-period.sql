create or replace function public.validate_photo_homework_period()
returns trigger language plpgsql set search_path=pg_catalog,public
as E'declare period_grade text\x3b period_start date\x3b period_end date\x3b
begin
  select grade_level,start_date,end_date into period_grade,period_start,period_end from public.learning_periods where id=new.period_id\x3b
  if period_grade is null or period_grade <> new.grade_level then
    raise exception ''학습 기간과 대상 학년이 일치하지 않습니다.'' using errcode=''23514''\x3b
  end if\x3b
  if new.lesson_date < period_start or new.lesson_date > period_end then
    raise exception ''수업 날짜는 학습 기간 안에 있어야 합니다.'' using errcode=''23514''\x3b
  end if\x3b
  if tg_op=''UPDATE'' and (new.grade_level<>old.grade_level or new.period_id<>old.period_id)
     and exists(select 1 from public.photo_homework_assignments where homework_id=old.id) then
    raise exception ''학생 배정 후에는 학습 기간과 학년을 변경할 수 없습니다.'' using errcode=''55000''\x3b
  end if\x3b
  return new\x3b
end\x3b';
