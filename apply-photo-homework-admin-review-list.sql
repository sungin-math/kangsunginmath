-- 관리자 사진 숙제 제출 확인 목록을 한 번의 RPC로 조회한다.
-- 기존 데이터와 RLS 정책은 변경하지 않는다.

begin;

create or replace function public.admin_list_photo_homework_reviews(
  target_page integer default 1,
  target_page_size integer default 30,
  target_period_id uuid default null,
  target_grade text default null,
  target_class_id uuid default null,
  target_homework_id uuid default null,
  target_student text default null,
  target_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  effective_page integer := greatest(1, coalesce(target_page, 1));
  effective_page_size integer := least(30, greatest(10, coalesce(target_page_size, 30)));
  effective_grade text := nullif(btrim(coalesce(target_grade, '')), '');
  effective_student text := nullif(left(btrim(coalesce(target_student, '')), 100), '');
  effective_status text := nullif(btrim(coalesce(target_status, '')), '');
  total_count bigint := 0;
  pending_count bigint := 0;
  total_pages integer := 1;
  result_items jsonb := '[]'::jsonb;
begin
  if lower(coalesce((select auth.jwt() ->> 'email'), '')) <> 'tjddls9288@naver.com' then
    raise exception '관리자 권한이 없습니다.' using errcode = '42501';
  end if;

  if effective_grade is not null and effective_grade not in ('고1', '고2', '고3') then
    raise exception '잘못된 학년입니다.' using errcode = '22023';
  end if;

  if effective_status is not null
     and effective_status not in ('not_submitted', 'pending', 'completed', 'redo') then
    raise exception '잘못된 제출 상태입니다.' using errcode = '22023';
  end if;

  select
    count(*) filter (
      where effective_status is null or a.status = effective_status
    ),
    count(*) filter (where a.status = 'pending')
  into total_count, pending_count
  from public.photo_homework_assignments as a
  inner join public.photo_homeworks as h on h.id = a.homework_id
  where (target_period_id is null or h.period_id = target_period_id)
    and (effective_grade is null or a.assigned_grade_level = effective_grade)
    and (target_class_id is null or a.assigned_class_id = target_class_id)
    and (target_homework_id is null or a.homework_id = target_homework_id)
    and (
      effective_student is null
      or position(lower(effective_student) in lower(coalesce(a.student_name_snapshot, ''))) > 0
    );

  total_pages := greatest(1, ceil(total_count::numeric / effective_page_size)::integer);
  effective_page := least(effective_page, total_pages);

  with page_assignments as materialized (
    select
      a.*,
      to_jsonb(h) as homework
    from public.photo_homework_assignments as a
    inner join public.photo_homeworks as h on h.id = a.homework_id
    where (target_period_id is null or h.period_id = target_period_id)
      and (effective_grade is null or a.assigned_grade_level = effective_grade)
      and (target_class_id is null or a.assigned_class_id = target_class_id)
      and (target_homework_id is null or a.homework_id = target_homework_id)
      and (
        effective_student is null
        or position(lower(effective_student) in lower(coalesce(a.student_name_snapshot, ''))) > 0
      )
      and (effective_status is null or a.status = effective_status)
    order by
      case when a.status = 'pending' then 0 else 1 end,
      a.created_at desc,
      a.id desc
    limit effective_page_size
    offset (effective_page - 1) * effective_page_size
  ),
  photo_stats as (
    select
      p.assignment_id,
      count(*)::integer as photo_count
    from public.photo_submission_photos as p
    inner join page_assignments as page on page.id = p.assignment_id
    where p.deleted_at is null
    group by p.assignment_id
  ),
  round_stats as (
    select
      r.assignment_id,
      count(*)::integer as round_count,
      max(r.submitted_at) as latest_round_at
    from public.photo_submission_rounds as r
    inner join page_assignments as page on page.id = r.assignment_id
    group by r.assignment_id
  ),
  page_items as (
    select
      to_jsonb(page)
        || jsonb_build_object(
          'photo_count', coalesce(photos.photo_count, 0),
          'round_count', coalesce(rounds.round_count, 0),
          'latest_submitted_at', rounds.latest_round_at
        ) as item,
      case when page.status = 'pending' then 0 else 1 end as pending_priority,
      page.created_at,
      page.id
    from page_assignments as page
    left join photo_stats as photos on photos.assignment_id = page.id
    left join round_stats as rounds on rounds.assignment_id = page.id
  )
  select coalesce(
    jsonb_agg(item order by pending_priority, created_at desc, id desc),
    '[]'::jsonb
  )
  into result_items
  from page_items;

  return jsonb_build_object(
    'items', result_items,
    'page', effective_page,
    'pageSize', effective_page_size,
    'total', total_count,
    'pendingCount', pending_count
  );
end;
$function$;

revoke all on function public.admin_list_photo_homework_reviews(
  integer, integer, uuid, text, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.admin_list_photo_homework_reviews(
  integer, integer, uuid, text, uuid, uuid, text, text
) to authenticated;

commit;
