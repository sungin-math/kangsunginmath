#!/usr/bin/env bash
# 2026년 6월의 수동 배포 14개를 지웁니다.
# 이 배포들은 publish = "." 이던 시절에 올라가서 /supabase-schema.sql 이
# 아직 200으로 내려받아집니다.
#
# 쓰는 법:
#   NETLIFY_TOKEN=여기에토큰 bash scripts/delete-old-netlify-deploys.sh
#
# 토큰: https://app.netlify.com/user/applications#personal-access-tokens
set -u

if [ -z "${NETLIFY_TOKEN:-}" ]; then
  echo "NETLIFY_TOKEN 이 없습니다."
  exit 1
fi

SITE="sungin-math-hw.netlify.app"

# 지울 배포를 목록에 박아 둡니다. 실수로 다른 배포를 건드리지 않게 하려는
# 것입니다. 현재 운영 배포(6a9a4182ee3d9e00084e0ac9)와 2026-08-31 수동
# 배포(6a957f8e08ff4f11626d37e0, 이미 404)는 여기에 없습니다.
IDS="
6a4262c549f93f305fad3d32
6a425bef23cc924156f8c0ff
6a41fd02f8708a3a13f9ffb1
6a41222f2f37f88ee446ef66
6a411630042c987c9a0da86d
6a40c04eecd2f790b130e3f5
6a40b8f34c04e80b69fd2c7e
6a36c20a442f7d95d86426de
6a36c0b039d8c8786218ec2a
6a36bfaa5ac75da79a739b93
6a36bea93457d36fa68b3887
6a36bdf2b9fdc4515e7170ae
6a36bc120e7ad8a72cd80975
6a3411335ac75d0835739b22
"

echo "== 삭제 =="
for id in $IDS; do
  code=$(curl -s -o /dev/null -m 30 -w "%{http_code}" -X DELETE \
    -H "Authorization: Bearer $NETLIFY_TOKEN" \
    "https://api.netlify.com/api/v1/deploys/$id")
  echo "$id  삭제응답=$code"
done

echo
echo "== 확인 (전부 404 여야 합니다) =="
fail=0
for id in $IDS; do
  code=$(curl -s -o /dev/null -m 30 -w "%{http_code}" \
    "https://$id--$SITE/supabase-schema.sql")
  echo "$id  schema=$code"
  [ "$code" = "200" ] && fail=1
done

echo
if [ "$fail" = "1" ]; then
  echo "아직 200인 배포가 있습니다. 위 목록을 확인하세요."
else
  echo "14개 모두 닫혔습니다."
fi
