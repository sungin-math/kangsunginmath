# 마이그레이션

Supabase 데이터베이스 구조를 바꾸는 SQL입니다.

## 폴더 구분

| 위치 | 내용 |
|---|---|
| `supabase-schema.sql` (루트) | **정본 스키마.** 새 프로젝트를 만들 때 이것부터 실행합니다 |
| `migrations/` | 구조 변경 — 표·함수·정책·권한 |
| `migrations/photo-homework-steps/` | 사진 숙제 최초 구축을 번호대로 나눈 것 |
| `data-ops/` | 구조가 아니라 데이터를 넣거나 지우는 일회성 SQL |

`data-ops/insert-*.sql`은 학생 실명과 성적이 들어 있어 `.gitignore`로 저장소에서
제외됩니다. 이 컴퓨터에만 있습니다.

## 적용 이력

`apply-schema-migrations-log.sql`을 적용하면 `public.schema_migrations` 표가
생깁니다. 적용한 파일 이름이 여기 남습니다.

```sql
select name, applied_at, note
  from public.schema_migrations
 order by applied_at nulls first, name;
```

`applied_at`이 비어 있는 행은 **이 표를 만들기 전에 적용된 것**입니다.
실제 적용 시점 기록이 없어 지어내지 않고 비워뒀습니다. "적용된 것으로 본다"는
뜻이지 검증된 기록은 아닙니다 — 기능이 동작하고 있으므로 그렇게 판단했습니다.

### 새 마이그레이션을 만들 때

파일 맨 아래에 이 줄을 넣으면 적용 이력이 남습니다.

```sql
insert into public.schema_migrations (name, applied_at)
values ('migrations/apply-무언가.sql', now())
on conflict (name) do nothing;
```

## 적용 순서

**대부분은 순서를 알 수 없습니다.** 파일 대다수가 저장소 첫 커밋에 한꺼번에
들어와서 git 이력으로도 복원되지 않습니다. 파일 이름에 번호를 붙이면
없는 기록을 지어내는 셈이라 붙이지 않았습니다.

기록으로 남아 있는 순서는 아래가 전부입니다.

### 사진 숙제 (`PHOTO-HOMEWORK-DEPLOY.md`에 기록됨)

1. `photo-homework-steps/` 01 → 02-1 ~ 02-6 → 03 (최초 구축)
2. `apply-photo-homework-management.sql`
3. `apply-photo-homework-class-dates.sql`
4. `apply-photo-homework-period-rewards.sql`
5. `apply-student-archive.sql`
6. `apply-photo-homework-hardening.sql`
7. `apply-photo-homework-stats-fix.sql`

### 2026-09-02 ~ 09-04 보안·성능 작업

순서대로 적용했습니다.

1. `apply-login-rate-limit.sql` — 로그인 시도 제한
2. `apply-video-view-server-only.sql` — 시청 기록 anon INSERT 차단
3. `apply-anon-table-hardening.sql` — anon 테이블 권한 회수
4. `apply-login-duplicate-names.sql` — 동명이인 로그인
5. `apply-admin-email-single-source.sql` — 관리자 이메일 단일 출처
6. `apply-weekly-report-target.sql` — 주간 보고서 대상 반
7. `apply-schema-migrations-log.sql` — 이 이력 표

## 주의

여러 파일이 같은 함수나 정책을 덮어쓴 것들이 있습니다. **오래된 파일을 보고
현재 상태를 판단하지 마세요.** 지금 DB에 무엇이 있는지 알아야 할 때는
파일이 아니라 DB를 보는 편이 확실합니다.

```sql
-- 지금 살아있는 정책
select tablename, policyname, cmd, roles
  from pg_policies where schemaname = 'public' order by 1, 2;

-- 지금 살아있는 함수
select proname, pg_get_function_identity_arguments(oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' order by 1;
```
