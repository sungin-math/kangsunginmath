-- 마이그레이션 적용 이력 기록
--
-- 지금까지는 어떤 SQL을 언제 적용했는지 남는 곳이 없었습니다. 파일이 루트에
-- 30개 넘게 쌓여 있고 이름만으로는 적용 여부를 알 수 없어서, 새로 적용해야
-- 하는지 이미 한 것인지 매번 짐작해야 했습니다.
--
-- 앞으로 마이그레이션 파일은 맨 아래에 자기 이름을 기록합니다.
--
--   insert into public.schema_migrations (name)
--   values ('migrations/apply-무언가.sql')
--   on conflict (name) do nothing;
--
--
-- ※ applied_at이 null인 행에 대하여
--
-- 이 표를 만들기 전에 적용된 파일들입니다. 실제 적용 시점 기록이 없어
-- 지어내지 않고 비워뒀습니다. "적용된 것으로 본다"는 뜻이지 검증된
-- 기록은 아닙니다. 기능이 동작하고 있으므로 적용됐다고 판단했습니다.
--
-- 순서도 복원할 수 없습니다. 대부분 한 커밋에 함께 들어와서 git 이력으로도
-- 알 수 없습니다. 알려진 순서는 migrations/README.md에 적어뒀습니다.

begin;

create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz,
  note       text
);

comment on table public.schema_migrations is
  '적용한 마이그레이션 기록. applied_at이 null이면 이 표를 만들기 전에 적용된 것입니다.';

alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from anon, authenticated;

insert into public.schema_migrations (name, applied_at, note) values
  ('migrations/add-lesson-homework-not-recorded.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/allow-school-score-memo-only.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-admin-email-single-source.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-admin-rls.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-anon-table-hardening.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-class-grade-level.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-lesson-journal.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-login-duplicate-names.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-login-rate-limit.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-admin-review-list.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-class-dates.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-class-targets.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-hardening.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-management.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-period-rewards.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-photo-homework-stats-fix.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-school-score-management.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-student-archive.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-student-records.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-video-view-pagination.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-video-view-server-only.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/apply-weekly-report-target.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/migrate-student-passwords.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/01-tables-rls-storage.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/02-1-validate-period.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/02-2-assign-students.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/02-3-add-photo.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/02-4-delete-photo.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/02-5-admin-review.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/02-6-admin-bulk-complete.sql', null, '이 표를 만들기 전에 적용됨'),
  ('migrations/photo-homework-steps/03-triggers-and-permissions.sql', null, '이 표를 만들기 전에 적용됨'),
  ('supabase-schema.sql', null, '정본 스키마. 이 표를 만들기 전에 적용됨')
on conflict (name) do nothing;

-- 이 파일은 지금 적용되는 것이므로 시각이 남습니다.
-- 앞으로 추가하는 마이그레이션도 이렇게 끝맺으면 됩니다.
insert into public.schema_migrations (name, applied_at)
values ('migrations/apply-schema-migrations-log.sql', now())
on conflict (name) do nothing;

commit;


-- 확인용 조회 (실행하지 않아도 됩니다)
--
--   select name, applied_at, note
--     from public.schema_migrations
--    order by applied_at nulls first, name;
