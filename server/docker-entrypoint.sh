#!/bin/sh
set -e

# ── 1) แก้ host ของ DATABASE_URL ให้ชี้ออกไปที่ SQL Server บนเครื่อง host ──
# (ใน container คำว่า localhost = ตัว container เอง ไม่ใช่เครื่องเรา)
if [ -n "$DATABASE_URL" ]; then
  NEW_URL=$(printf '%s' "$DATABASE_URL" \
    | sed -e 's#//localhost#//host.docker.internal#' \
          -e 's#//127\.0\.0\.1#//host.docker.internal#')
  export DATABASE_URL="$NEW_URL"
  echo "→ DB host = host.docker.internal (SQL Server บนเครื่อง host)"
else
  echo "!! ไม่พบ DATABASE_URL — ตรวจสอบว่า server/.env มีอยู่จริง" >&2
  exit 1
fi

# ── 2) generate Prisma client (เผื่อ schema เปลี่ยนผ่าน bind mount) ──
npx prisma generate >/dev/null 2>&1 || npx prisma generate

# ── 3) รอ SQL Server พร้อม แล้ว push schema (retry) ──
n=0
until npx prisma db push --skip-generate --accept-data-loss; do
  n=$((n + 1))
  if [ "$n" -ge 20 ]; then
    echo "!! ต่อ SQL Server ไม่ได้หลังลอง 20 ครั้ง" >&2
    echo "   ตรวจ: SQL Server เปิด TCP/IP พอร์ต 1433, Mixed Mode auth, firewall, และมี database ตาม .env แล้วหรือยัง" >&2
    exit 1
  fi
  echo "… รอ SQL Server (ครั้งที่ $n) — sleep 3s"
  sleep 3
done

# ── 4) seed ข้อมูลตัวอย่าง (idempotent — ใช้ upsert) ──
if [ "${SEED_ON_START:-true}" = "true" ]; then
  npm run seed || echo "!! seed ไม่สำเร็จ (ข้ามไปก่อน)"
fi

# ── 5) start ตาม CMD (npm run dev) ──
echo "✓ พร้อมแล้ว — เริ่ม backend"
exec "$@"
