-- 학생 로그인 무차별 대입 제한
--
-- Netlify Function은 요청 간 메모리를 공유하지 않으므로 시도 기록을 DB에 둡니다.
-- 이 파일은 기존 데이터를 변경하지 않고 테이블 1개와 함수 3개만 추가합니다.
--
-- 세 가지 범위로 나눠 셉니다.
--
--   1) (이름, IP)   실패 5회 / 15분  → 15분 차단
--      공격자만 막히고 진짜 학생은 다른 회선이라 영향받지 않습니다.
--
--   2) (이름, @all) 차단하지 않고 응답만 지연 (최대 3초)
--      이름 단위로 차단하면 공격자가 남의 계정을 일부러 잠글 수 있어
--      (수업 시간에 로그인 불가) 여기서는 지연만 겁니다.
--
--   3) (@all, IP)   실패 30회 / 15분 → 30분 차단
--      한 IP에서 여러 학생 이름을 훑는 스프레이 공격을 막습니다.
--
-- @all은 집계용 표식입니다. 학생 이름이나 IP로 쓰이지 않습니다.

begin;

create table if not exists public.login_attempts (
  name_key       text not null,
  ip             text not null,
  failed_count   integer not null default 0,
  window_start   timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  blocked_until  timestamptz,
  primary key (name_key, ip)
);

create index if not exists login_attempts_cleanup_idx
  on public.login_attempts (last_failed_at);

-- 브라우저 역할은 이 테이블에 접근할 수 없습니다.
-- 정책을 만들지 않으므로 anon/authenticated는 전부 차단되고,
-- service_role만 bypassrls로 읽고 씁니다.
alter table public.login_attempts enable row level security;


-- 한 범위의 실패 횟수를 올리고, 임계치를 넘으면 차단 시각을 기록합니다.
-- p_threshold = 0 이면 차단하지 않고 횟수만 셉니다. (지연 전용 범위)
create or replace function public.login_attempts_bump(
  p_name_key text,
  p_ip text,
  p_threshold integer,
  p_block_minutes integer,
  p_window_minutes integer default 15
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window interval := make_interval(mins => p_window_minutes);
  v_count integer;
begin
  insert into public.login_attempts as la (name_key, ip, failed_count, window_start, last_failed_at)
  values (p_name_key, p_ip, 1, now(), now())
  on conflict (name_key, ip) do update
    set failed_count = case
          when la.window_start < now() - v_window then 1
          else la.failed_count + 1
        end,
        window_start = case
          when la.window_start < now() - v_window then now()
          else la.window_start
        end,
        last_failed_at = now()
  returning la.failed_count into v_count;

  if p_threshold > 0 and v_count >= p_threshold then
    update public.login_attempts
       set blocked_until = now() + make_interval(mins => p_block_minutes),
           failed_count = 0,
           window_start = now()
     where name_key = p_name_key and ip = p_ip;
  end if;

  return v_count;
end;
$$;


-- 로그인을 시도해도 되는지 확인합니다.
-- 반환 예: {"blocked": true, "retryAfter": 840, "delaySeconds": 0}
create or replace function public.login_rate_check(p_name text, p_ip text)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name  text := lower(btrim(coalesce(p_name, '')));
  v_ip    text := nullif(btrim(coalesce(p_ip, '')), '');
  v_now   timestamptz := now();
  v_delay integer := 0;
  r       public.login_attempts%rowtype;
begin
  v_ip := coalesce(v_ip, 'unknown');

  -- 1) (이름, IP) 차단 확인
  select * into r from public.login_attempts
   where name_key = v_name and ip = v_ip;
  if found and r.blocked_until is not null and r.blocked_until > v_now then
    return json_build_object(
      'blocked', true,
      'retryAfter', ceil(extract(epoch from (r.blocked_until - v_now)))::integer,
      'delaySeconds', 0);
  end if;

  -- 3) (@all, IP) 스프레이 차단 확인
  select * into r from public.login_attempts
   where name_key = '@all' and ip = v_ip;
  if found and r.blocked_until is not null and r.blocked_until > v_now then
    return json_build_object(
      'blocked', true,
      'retryAfter', ceil(extract(epoch from (r.blocked_until - v_now)))::integer,
      'delaySeconds', 0);
  end if;

  -- 2) (이름, @all) 지연 계산
  -- 3회째부터 1초씩 늘리되 3초에서 멈춥니다.
  -- Netlify Function 실행 제한이 10초라 그보다 넉넉히 낮게 잡습니다.
  select * into r from public.login_attempts
   where name_key = v_name and ip = '@all';
  if found and r.window_start > v_now - interval '15 minutes' then
    v_delay := least(3, greatest(0, r.failed_count - 2));
  end if;

  return json_build_object('blocked', false, 'retryAfter', 0, 'delaySeconds', v_delay);
end;
$$;


-- 시도 결과를 기록합니다.
-- 성공하면 그 학생과 관련된 기록을 지웁니다. (스프레이 기록은 남깁니다)
create or replace function public.login_rate_record(
  p_name text,
  p_ip text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_ip   text := coalesce(nullif(btrim(coalesce(p_ip, '')), ''), 'unknown');
begin
  -- 오래된 기록 정리 (차단이 풀렸고 하루 넘게 조용한 행)
  delete from public.login_attempts
   where last_failed_at < now() - interval '1 day'
     and (blocked_until is null or blocked_until < now());

  if p_success then
    delete from public.login_attempts
     where name_key = v_name and ip in (v_ip, '@all');
    return;
  end if;

  perform public.login_attempts_bump(v_name, v_ip,   5,  15);  -- (이름, IP)  15분 차단
  perform public.login_attempts_bump(v_name, '@all', 0,   0);  -- (이름, @all) 지연 전용
  perform public.login_attempts_bump('@all', v_ip,  30,  15);  -- (@all, IP)  15분 차단

  -- (@all, IP) 임계치 30을 조정해야 할 수 있습니다.
  -- 학원 와이파이처럼 여러 학생이 같은 IP를 쓰는 환경에서는
  -- 각자 한두 번씩만 틀려도 합계가 30에 닿을 수 있습니다.
  -- 수업 시간에 반 전체가 로그인하지 못하는 일이 생기면 이 값을 올리세요.
  --   예) 50회로 완화:
  --   perform public.login_attempts_bump('@all', v_ip, 50, 15);
  -- 반대로 스프레이 공격 로그가 보이면 20회로 조입니다.
end;
$$;


-- 브라우저 역할에는 실행 권한을 주지 않습니다.
-- service_role은 anon 권한을 상속하지 않으므로 명시적으로 부여해야 합니다.
revoke all on function public.login_attempts_bump(text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.login_rate_check(text, text)                                from public, anon, authenticated;
revoke all on function public.login_rate_record(text, text, boolean)                      from public, anon, authenticated;

grant execute on function public.login_attempts_bump(text, text, integer, integer, integer) to service_role;
grant execute on function public.login_rate_check(text, text)                                to service_role;
grant execute on function public.login_rate_record(text, text, boolean)                      to service_role;

commit;


-- 확인용 조회 (실행하지 않아도 됩니다)
--
--   select name_key, ip, failed_count, blocked_until
--     from public.login_attempts
--    order by last_failed_at desc limit 20;
--
-- 특정 학생의 차단을 즉시 푸는 방법:
--
--   delete from public.login_attempts where name_key = lower('학생이름');
