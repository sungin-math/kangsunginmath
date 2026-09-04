-- 관리자 이메일을 한 곳에서만 정하도록 변경
--
-- 지금은 RLS 정책과 RPC 본문에 이메일 문자열이 그대로 박혀 있습니다.
-- 이메일을 바꿀 일이 생기면 수십 군데를 손으로 맞춰야 하고, 한 군데만
-- 빠뜨려도 그 테이블만 조용히 권한이 어긋납니다. 오류가 나지 않으니
-- 알아채기도 어렵습니다.
--
-- public.admin_email() 하나를 두고 전부 그것을 부르게 바꿉니다.
-- 앞으로 이메일을 바꾸려면 이 파일 맨 아래 "이메일 변경 방법"만 실행하면
-- 됩니다.
--
--
-- 왜 설정 테이블이 아니라 상수를 돌려주는 함수인가
--
-- 정책은 행마다 평가됩니다. 테이블을 읽는 함수로 만들면 조회할 때마다
-- 행 수만큼 조회가 따라붙습니다. 상수를 돌려주는 immutable 함수는
-- 계획 단계에서 값으로 접혀 실행 비용이 0입니다.
-- 이메일을 바꿀 일은 거의 없고, 조회는 항상 일어납니다.
--
--
-- 손으로 옮겨 적지 않고 살아있는 정의를 다시 쓰는 이유
--
-- 파일에 남은 apply-*.sql은 과거에 적용한 기록이라, 그중 상당수는 이미
-- 다른 파일에서 덮어써졌습니다. 파일을 보고 옮겨 적으면 실제 DB에 있는
-- 것과 어긋납니다. pg_policies와 pg_get_functiondef로 지금 살아있는
-- 정의를 읽어 바꿉니다.

begin;

-- 1) 단일 출처
create or replace function public.admin_email()
returns text
language sql
immutable
as $$ select 'tjddls9288@naver.com'::text $$;

comment on function public.admin_email() is
  '관리자 이메일 단일 출처. 정책과 RPC가 모두 이 함수를 부릅니다. 바꾸려면 이 함수만 create or replace 하세요.';

revoke all on function public.admin_email() from public;
grant execute on function public.admin_email() to anon, authenticated, service_role;


-- 2) 살아있는 정책 다시 쓰기
do $$
declare
  r record;
  v_qual  text;
  v_check text;
  v_sql   text;
begin
  for r in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') like '%tjddls9288@naver.com%'
         or coalesce(with_check, '') like '%tjddls9288@naver.com%')
  loop
    -- 따옴표까지 포함해 바꿉니다. pg_policies는 리터럴을
    -- 'tjddls9288@naver.com'::text 형태로 돌려주므로 뒤의 ::text는
    -- public.admin_email()::text가 되어 그대로 유효합니다.
    v_qual  := replace(coalesce(r.qual, ''),       '''tjddls9288@naver.com''', 'public.admin_email()');
    v_check := replace(coalesce(r.with_check, ''), '''tjddls9288@naver.com''', 'public.admin_email()');

    v_sql := format('create policy %I on %I.%I as %s for %s to %s',
      r.policyname, r.schemaname, r.tablename,
      r.permissive, r.cmd,
      array_to_string(array(select quote_ident(x) from unnest(r.roles) as x), ', '));
    if r.qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if r.with_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute v_sql;
    raise notice '정책 갱신: %.% / %', r.schemaname, r.tablename, r.policyname;
  end loop;
end $$;


-- 3) 살아있는 함수 다시 쓰기
do $$
declare
  r record;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       -- admin_email 자신은 제외합니다. 넣으면 본문이
       -- select public.admin_email() 이 되어 무한 재귀가 됩니다.
       and p.proname <> 'admin_email'
       and pg_get_functiondef(p.oid) like '%tjddls9288@naver.com%'
  loop
    execute replace(r.def, '''tjddls9288@naver.com''', 'public.admin_email()');
    raise notice '함수 갱신: %', r.proname;
  end loop;
end $$;


-- 4) 남은 것이 없는지 확인하고, 남았으면 되돌립니다
do $$
declare
  v_policies integer;
  v_functions integer;
begin
  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') like '%tjddls9288@naver.com%'
       or coalesce(with_check, '') like '%tjddls9288@naver.com%');

  select count(*) into v_functions
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.proname <> 'admin_email'
     and pg_get_functiondef(p.oid) like '%tjddls9288@naver.com%';

  if v_policies > 0 or v_functions > 0 then
    raise exception '이메일이 남아있는 정책 %개, 함수 %개. 전부 취소합니다.', v_policies, v_functions;
  end if;

  raise notice '확인 완료. 이메일 문자열을 직접 가진 정책과 함수가 없습니다.';
end $$;

commit;


-- 확인용 조회 (실행하지 않아도 됩니다)
--
--   select tablename, policyname
--     from pg_policies
--    where schemaname = 'public' and coalesce(qual, '') like '%admin_email()%'
--    order by 1, 2;
--
--   select public.admin_email();
--
--
-- ────────────────────────────────────────────────────────────
-- 이메일 변경 방법
--
-- DB는 이 한 줄이면 끝입니다.
--
--   create or replace function public.admin_email()
--   returns text language sql immutable
--   as $$ select '새주소@example.com'::text $$;
--
-- 그리고 Netlify 환경변수 ADMIN_EMAIL도 같은 값으로 바꾸고 다시 배포하세요.
-- 브라우저와 Netlify Function은 DB를 거치지 않고 그 값으로 판단합니다.
-- 둘이 어긋나면 로그인은 되는데 데이터가 안 보이는 상태가 됩니다.
