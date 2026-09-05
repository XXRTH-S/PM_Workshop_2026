# รันด้วย Docker (โหมด Dev — hot reload)

Containerize เฉพาะ **backend + frontend**
DB ใช้ **MS SQL Server ที่ติดตั้งบนเครื่อง** (ไม่ได้อยู่ใน container) — container ต่อออกไปผ่าน `host.docker.internal`

```
┌─────────────────┐   ┌─────────────────┐        เครื่อง Windows (host)
│  web (Vite)     │   │  server (Express)│      ┌──────────────────────┐
│  :5173          │──▶│  :4000           │─────▶│ MS SQL Server :1433  │
│  proxy /api ───────▶│  Prisma          │      │  (ที่ลงไว้แล้ว)       │
└─────────────────┘   └─────────────────┘      └──────────────────────┘
   container             container          host.docker.internal
```

---

## 0) สถานะการตรวจสอบ (ตรวจแล้ว ✓ พร้อมรัน)

| รายการ | สถานะ |
|--------|-------|
| Docker Desktop | ✓ Docker 29.4.3 + Compose v5.1.3 (daemon รันอยู่, Linux x86_64) |
| `docker-compose.yml` | ✓ validate ผ่าน |
| MS SQL Server | ✓ SQL Server 2022 (16.0.1000.6) instance `MSSQLSERVER` รันอยู่ |
| พอร์ต 1433 | ✓ listening |
| `sa` login | ✓ ใช้ได้ (Mixed Mode + sa enabled, รหัสตรงกับ `server/.env`) |
| database `pm_workshop` | ✓ มีอยู่แล้ว |
| container → `host.docker.internal:1433` | ✓ เชื่อมต่อได้ (firewall ไม่บล็อก) |
| base image `node:20-bookworm-slim` | ✓ pull แล้ว |

ทุกข้อพร้อม — รันได้เลยที่ข้อ 2 (ข้อ 1 เป็นเช็กลิสต์อ้างอิงเผื่อย้ายเครื่อง/มีปัญหาภายหลัง)

---

## 1) ตั้งค่า SQL Server บนเครื่องให้รับ connection จาก Docker ⚠️ สำคัญสุด

ปัญหาที่เจอบ่อยที่สุดคือ container ต่อ SQL Server ไม่ได้ ต้องทำให้ครบ:

1. **เปิด TCP/IP + พอร์ต 1433**
   - เปิด *SQL Server Configuration Manager* → *SQL Server Network Configuration* → *Protocols*
   - เปิด **TCP/IP** (Enable)
   - ดับเบิลคลิก TCP/IP → แท็บ *IP Addresses* → ที่ **IPAll** ตั้ง `TCP Port = 1433` (ล้าง TCP Dynamic Ports ให้ว่าง)
   - ถ้าเป็น instance ชื่อ `SQLEXPRESS` ค่าเริ่มต้นจะเป็น dynamic port — ต้องตั้ง static 1433 ตามข้างบน หรือแก้ `DATABASE_URL` ให้ตรงพอร์ตจริง
   - **Restart** service `SQL Server`
2. **เปิด SQL Server Authentication (Mixed Mode)** และเปิดบัญชี `sa`
   - SSMS → คลิกขวา server → *Properties* → *Security* → เลือก *SQL Server and Windows Authentication mode*
   - *Security → Logins → sa* → ตั้งรหัสให้ตรงกับใน `server/.env` และ *Status* = Enabled → restart service
3. **Windows Firewall** อนุญาต inbound TCP 1433
   ```powershell
   New-NetFirewallRule -DisplayName "SQL Server 1433" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
   ```
4. **สร้าง database** (Prisma `db push` ไม่สร้าง database ของ SQL Server ให้เอง — สร้างแค่ตาราง)
   ```sql
   CREATE DATABASE pm_workshop;
   ```
   (ชื่อ database ต้องตรงกับใน `server/.env` → `database=pm_workshop`)

> `server/.env` ไม่ต้องแก้ — ปล่อยเป็น `localhost:1433` ได้
> entrypoint จะแปลง host เป็น `host.docker.internal` ให้อัตโนมัติตอนรันใน container

---

## 2) รัน

```powershell
docker compose up --build
```

ขั้นตอนที่เกิดขึ้นอัตโนมัติฝั่ง backend: แก้ host DB → `prisma generate` → รอ/เชื่อม SQL Server → `prisma db push` (สร้างตาราง) → `npm run seed` (ใส่ข้อมูลตัวอย่าง, idempotent) → start ด้วย ts-node-dev

เปิดใช้งาน:
- เว็บ: <http://localhost:5173>
- API: <http://localhost:4000/api/health>

หยุด: `Ctrl+C` แล้ว `docker compose down` (เพิ่ม `-v` ถ้าต้องการล้าง volume node_modules)

---

## 3) Hot reload

- แก้ไฟล์ใน `server/` หรือ `web/` ในเครื่อง → reload ในคอนเทนเนอร์อัตโนมัติ (bind mount)
- Windows ใช้ `usePolling`/`ts-node-dev --respawn` แล้ว ถ้า reload ช้า/ไม่ทำงาน เป็นเรื่องปกติของ bind mount บน Windows
- เปลี่ยน `schema.prisma` → entrypoint รัน `prisma generate` + `db push` ใหม่ทุกครั้งที่ restart คอนเทนเนอร์ `server`

---

## 4) แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|-------|------------------|
| `… รอ SQL Server (ครั้งที่ N)` วนไม่จบ | SQL Server ยังไม่เปิด TCP 1433 / firewall บล็อก / ยังไม่ Mixed Mode → ทำข้อ 1 ให้ครบ |
| `Cannot open database "pm_workshop"` | ยังไม่ได้ `CREATE DATABASE pm_workshop;` (ข้อ 1.4) |
| `Login failed for user 'sa'` | รหัส `sa` ไม่ตรง `server/.env` หรือ `sa` ยัง disabled |
| เว็บเปิดได้แต่ข้อมูลไม่ขึ้น / Dashboard error | ดู log service `server` ว่าเชื่อม DB ได้ไหม |
| แก้โค้ดแล้วไม่ reload | ปกติของ Windows bind mount — รอสักครู่ หรือ `docker compose restart` service นั้น |
| เปลี่ยน dependency (`package.json`) | ต้อง `docker compose up --build` ใหม่ และ `docker compose down -v` เพื่อล้าง volume node_modules เก่า |

> ทางเลือก: ถ้าต้องการให้ MS SQL Server อยู่ใน Docker ด้วย (ไม่ต้องลงในเครื่อง) บอกได้ จะเพิ่ม service `db` (`mcr.microsoft.com/mssql/server:2022-latest`) ให้
