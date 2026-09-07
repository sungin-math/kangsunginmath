-- 같은 반에 같은 주소의 영상이 두 번 등록되는 것을 막습니다.
--
-- 왜 필요한가
--   등록 버튼에 저장 중 잠금이 없었습니다. 느린 통신에서 두 번 누르면
--   같은 영상이 두 개 만들어집니다. 2026-09-07 기준 운영 DB에 실제로
--   두 건 있었습니다. 둘 다 반·주소·제목·날짜가 완전히 같았습니다.
--
--     8월9일 일요일 고1M A3 1교시
--     8월10일 월요일 고1A A3 2교시
--
--   화면 쪽 잠금은 같은 날 배포했지만, 그것만으로는 부족합니다.
--   창을 두 개 띄우거나 잠금이 걸리기 전에 두 번째 요청이 나가면
--   똑같이 생깁니다. 마지막으로 막는 것은 DB여야 합니다.
--
-- 왜 (class_id, url)이고 url 하나가 아닌가
--   한 번 찍은 영상을 두 반에 같이 올리는 경우를 막지 않기 위해서입니다.
--   지금 데이터에 그런 경우는 없지만(반이 다른데 주소가 같은 묶음 0개),
--   실수를 막자고 정상적인 사용까지 막을 이유는 없습니다.
--   반을 지우면 class_id가 null이 되는데, Postgres에서 null은 서로 다른
--   값으로 치므로 그 행들은 제약에 걸리지 않습니다. 의도한 동작입니다.
--
--   주소 표기가 다르면(youtu.be / youtube.com) 여전히 통과합니다.
--   지금은 288개가 전부 youtu.be라 문제가 되지 않습니다.

begin;

-- 1단계. 이미 있는 중복을 한 개로 합칩니다.
--
-- 남길 행은 시청 기록이 더 많은 쪽입니다. 기록이 같으면 id가 작은 쪽으로
-- 정합니다. created_at이 date라 둘의 날짜가 같아서 시간으로는 못 고릅니다.
create temporary table video_duplicates on commit drop as
with ranked as (
  select v.id,
         first_value(v.id) over (
           partition by v.class_id, v.url
           order by (select count(*) from public.video_views vv where vv.video_id = v.id) desc,
                    v.id
         ) as keep_id
    from public.videos v
   where v.class_id is not null
)
select id, keep_id from ranked where id <> keep_id;

-- 2단계. 지울 영상에 달린 시청 기록을 남길 영상으로 옮깁니다.
--
-- 이 단계를 빼면 안 됩니다. video_views.video_id는 on delete cascade라
-- 영상을 지우는 순간 그 영상의 시청 기록도 같이 사라집니다. 누가 봤는지가
-- 기록의 목적인데 중복을 정리하다가 그것을 잃게 됩니다.
update public.video_views vv
   set video_id = d.keep_id
  from video_duplicates d
 where vv.video_id = d.id;

-- 3단계. 중복 행을 지웁니다.
delete from public.videos v
 using video_duplicates d
 where v.id = d.id;

-- 4단계. 앞으로 막습니다.
alter table public.videos drop constraint if exists videos_class_id_url_key;
alter table public.videos add constraint videos_class_id_url_key unique (class_id, url);

comment on constraint videos_class_id_url_key on public.videos is
  '같은 반에 같은 주소를 두 번 등록하지 못하게 합니다. 등록 버튼 이중 클릭으로 실제 중복이 생긴 적이 있습니다.';

-- 적용 이력. 아직 schema_migrations 표가 없을 수 있어 있을 때만 남깁니다.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (name, applied_at)
    values ('migrations/apply-video-duplicate-guard.sql', now())
    on conflict (name) do nothing;
  end if;
end $$;

commit;


-- 확인용 조회
--
--   -- 중복이 남아 있는지 (행이 없어야 합니다)
--   select class_id, url, count(*)
--     from public.videos
--    where class_id is not null
--    group by class_id, url
--   having count(*) > 1;
--
--   -- 영상 수 (288 -> 286 이어야 합니다)
--   select count(*) from public.videos;
--
--   -- 시청 기록 수 (합치기 전과 같아야 합니다)
--   select count(*) from public.video_views;
--
--   -- 제약이 걸렸는지
--   select conname from pg_constraint
--    where conrelid = 'public.videos'::regclass and contype = 'u';
