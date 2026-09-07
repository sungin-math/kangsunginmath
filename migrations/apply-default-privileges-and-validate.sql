-- 새로 만드는 객체의 기본 권한을 닫고, 아직 검증되지 않은 제약을 검증합니다.
--
-- 이 파일은 지금 있는 표의 권한을 건드리지 않습니다.
-- 앞으로 만들 것에만 적용됩니다.

begin;

-- ────────────────────────────────────────────────────────────
-- 1. 새 객체에 anon 권한이 자동으로 붙지 않게 합니다.
--
-- Supabase 기본 설정은 public 스키마에 표를 만들면 anon에게 CRUD를,
-- 함수를 만들면 anon에게 EXECUTE를 자동으로 줍니다. 그래서 표를 만들 때마다
-- 사람이 revoke를 잊지 않아야 했습니다.
--
--   migrations/apply-anon-table-hardening.sql 맨 아래에도
--   "새 표를 만들면 revoke를 함께 실행하세요"라고 적어 뒀습니다.
--   그 당부를 규칙으로 바꿉니다.
--
-- 한 번 잊으면 그 표는 인터넷에서 그냥 읽힙니다. 지금까지는 운이 좋았을 뿐,
-- 실제로 옛 login_student가 anon 실행 권한을 달고 살아 있던 적이 있습니다.
--
-- authenticated는 건드리지 않습니다.
--   로그인한 사람은 선생님 한 명뿐이고, 표마다 RLS가 다시 막습니다.
--   여기서 같이 닫으면 새 표를 만들 때마다 grant를 해야 하는데, 그걸 잊으면
--   이번에는 관리자 화면에서 데이터가 안 보입니다. 조용히 새는 쪽보다는
--   낫지만, 얻는 것에 비해 번거로움이 큽니다.
--
-- 객체를 만드는 역할마다 따로 걸어야 합니다. 기본 권한은 "누가 만들었나"에
-- 붙기 때문입니다. 권한이 없어 실패하는 역할은 건너뜁니다.
do $$
declare
  creator text;
begin
  foreach creator in array array['postgres', 'supabase_admin', 'service_role']
  loop
    begin
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon', creator);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon', creator);
      execute format('alter default privileges for role %I in schema public revoke all on functions from anon', creator);
      raise notice '기본 권한 회수 완료: %', creator;
    exception when others then
      raise notice '건너뜀: % (%)', creator, sqlerrm;
    end;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────
-- 2. not valid로 걸어둔 제약을 검증합니다.
--
-- not valid는 "앞으로 들어오는 행만 검사하고 이미 있는 행은 넘어간다"는
-- 뜻입니다. 표를 오래 잠그지 않으려고 그렇게 걸었습니다.
--
-- 그래서 지금은 이 제약들이 절반만 일하고 있습니다. 옛 행에 이상한 값이
-- 있어도 아무도 모릅니다. validate는 한 번 훑어보고 "이제 전부 맞다"고
-- 표시하는 일입니다. 성적 80건, 반 4개라 순식간입니다.
--
-- 만약 여기서 오류가 나면 옛 데이터에 실제로 규칙을 어긴 행이 있다는
-- 뜻입니다. 그때는 이 트랜잭션이 통째로 되돌아가므로 아무것도 바뀌지
-- 않습니다. 오류 메시지에 나온 제약을 보고 그 행을 먼저 고치세요.
do $$
declare
  target record;
begin
  for target in
    select con.conrelid::regclass as table_name, con.conname
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_namespace ns on ns.oid = con.connamespace
     where ns.nspname = 'public'
       and con.contype = 'c'
       and not con.convalidated
     order by 1, 2
  loop
    execute format('alter table %s validate constraint %I', target.table_name, target.conname);
    raise notice '검증 완료: %.%', target.table_name, target.conname;
  end loop;
end $$;

-- 적용 이력. 아직 schema_migrations 표가 없을 수 있어 있을 때만 남깁니다.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (name, applied_at)
    values ('migrations/apply-default-privileges-and-validate.sql', now())
    on conflict (name) do nothing;
  end if;
end $$;

commit;


-- 확인용 조회
--
--   -- 아직 검증 안 된 check 제약 (행이 없어야 합니다)
--   select con.conrelid::regclass as 표, con.conname as 제약
--     from pg_catalog.pg_constraint con
--     join pg_catalog.pg_namespace ns on ns.oid = con.connamespace
--    where ns.nspname = 'public' and con.contype = 'c' and not con.convalidated;
--
--   -- 새 객체 기본 권한에 anon이 남아 있는지 (anon 항목이 없어야 합니다)
--   select pg_get_userbyid(defaclrole) as 만드는역할,
--          defaclobjtype as 종류,
--          defaclacl as 권한
--     from pg_default_acl d
--     join pg_namespace n on n.oid = d.defaclnamespace
--    where n.nspname = 'public';
--
--   -- 지금 있는 표의 anon 권한은 그대로여야 합니다.
--   -- classes, videos, homeworks 세 개만 남아 있으면 정상입니다.
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee = 'anon' and table_schema = 'public'
--    order by table_name;
