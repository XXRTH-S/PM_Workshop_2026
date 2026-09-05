# PM_WorkShop_2025 — ระบบบำรุงรักษาเชิงป้องกัน (Preventive Maintenance)

Web Application สำหรับวางแผน / บันทึก / แจ้งเตือน / รายงาน การ PM อุปกรณ์คอมพิวเตอร์
(โจทย์ workshop — รายละเอียดข้อกำหนดดูที่ [docs/DESIGN.md](docs/DESIGN.md))

---

## 🧱 Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite + Ant Design 6 |
| Backend | Node.js + Express + TypeScript |
| ORM / DB | Prisma + MS SQL Server 2022 |
| Export | ExcelJS (.xlsx) |
| Deploy (ทางเลือก) | Docker Compose |

---

## 📁 โครงสร้างโปรเจกต์

```
PM_WorkShop_2025/
├── README.md               ← ไฟล์นี้ (เริ่มอ่านที่นี่)
├── docker-compose.yml      ← รันทั้งระบบด้วย Docker
├── docs/
│   ├── DESIGN.md           ← ข้อกำหนด / ER / Flow chart
│   └── DOCKER.md           ← วิธีรันด้วย Docker (ละเอียด)
│
├── server/                 ← 🔵 Backend (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma   ← นิยาม 7 ตาราง (PK equipment = serial_number)
│   │   └── seed.ts         ← ข้อมูลตัวอย่าง + users + รายการตรวจ default
│   ├── src/
│   │   ├── index.ts        ← จุดเริ่ม Express + ป้องทุก /api ด้วย requireAuth
│   │   ├── routes/         ← API แยกตาม domain
│   │   │   ├── auth.ts      ← login / logout / me (JWT)
│   │   │   ├── equipment.ts ← CRUD อุปกรณ์
│   │   │   ├── pm.ts        ← บันทึก/ประวัติ/รายละเอียด PM + checklist
│   │   │   ├── alert.ts     ← แจ้งเตือนรอบ PM (Dashboard/Popup)
│   │   │   ├── check.ts     ← จัดการรายการตรวจ PM (ADMIN)
│   │   │   └── report.ts    ← รายงาน + Export Excel
│   │   └── lib/
│   │       ├── prisma.ts    ← Prisma client (singleton)
│   │       ├── pm-logic.ts  ← สูตรคำนวณรอบ PM (next_due)
│   │       ├── auth.ts      ← bcrypt + JWT + requireAuth/requireRole
│   │       └── activity.ts  ← logActivity() เขียน audit log
│   ├── Dockerfile.dev / docker-entrypoint.sh
│   ├── .env                ← ตั้งค่า DB + JWT_SECRET (ห้ามขึ้น git)
│   └── package.json
│
└── web/                    ← 🟢 Frontend (React + Vite)
    ├── index.html
    ├── public/             ← static asset (favicon)
    ├── src/
    │   ├── main.tsx        ← จุดเริ่ม + ConfigProvider + Router + AuthProvider
    │   ├── App.tsx         ← Layout + เมนู/route ตามสิทธิ์ + Login gate
    │   ├── pages/          ← 6 หน้าจอ
    │   │   ├── Login.tsx
    │   │   ├── Dashboard.tsx     (ADMIN)
    │   │   ├── Equipment.tsx
    │   │   ├── PmRecord.tsx      (บันทึก PM + checklist + ประวัติ)
    │   │   ├── Reports.tsx
    │   │   └── CheckItems.tsx    (ADMIN — จัดการรายการตรวจ)
    │   ├── auth/AuthContext.tsx  ← state ผู้ใช้ + token
    │   ├── components/DailyPmModal.tsx ← Popup งาน PM รายวัน
    │   ├── api/client.ts   ← ตัวเชื่อม backend (axios + token + types)
    │   └── lib/format.ts   ← ฟังก์ชันช่วย (วันที่/สถานะ)
    ├── Dockerfile.dev
    └── package.json
```

> **หลักการจัดโครงสร้าง:** backend และ frontend แยกอิสระ ต่างมี `package.json`
> / `tsconfig` / `Dockerfile` ของตัวเอง — แก้ฝั่งใดฝั่งหนึ่งไม่กระทบอีกฝั่ง

---

## 🗄️ Database

- ฐานข้อมูล: **MS SQL Server** ชื่อ `pm_workshop` — **7 ตาราง** (ER เต็มดูที่ [docs/DESIGN.md](docs/DESIGN.md))

| ตาราง | หน้าที่ |
|-------|---------|
| `equipment_group` | กลุ่มอุปกรณ์ + นโยบาย PM (รอบ/ค่าใช้จ่าย) |
| `equipment` | อุปกรณ์ — **PK = `serial_number`** |
| `pm_record` | ประวัติการทำ PM (FK `serial_number` cascade, `performed_by` → ผู้ทำ) |
| `app_user` | ผู้ใช้ + สิทธิ์ (bcrypt, role, status A/X) |
| `activity_log` | บันทึกการใช้งานระบบ (audit) |
| `pm_check_item` | รายการตรวจ checklist แยกตามกลุ่ม (ADMIN จัดการ) |
| `pm_check_result` | ผลตรวจรายข้อของ PM แต่ละครั้ง (snapshot + PASS/FAIL/NA) |

- **PK ของ `equipment` = `serial_number`** (SN ไม่ซ้ำตามธรรมชาติ) — แก้ SN ไม่ได้ตอน edit

---

## 🔐 ผู้ใช้ & สิทธิ์ (Login)

ระบบมี login จริง (รหัสผ่าน hash ด้วย bcrypt + token) บัญชีเริ่มต้นจาก seed:

| username | password | role | สิทธิ์ |
|----------|----------|------|--------|
| `admin` | `admin123` | ADMIN | กำกับดูแล/ตั้งค่า/ดูรายงาน + Dashboard (ตามนโยบาย **ไม่ลงมือ PM เครื่องเอง**) |
| `staffa` | `staff123` | TECHNICIAN | **ผู้ลงมือบันทึกผล PM** + จัดการอุปกรณ์ + รายงาน + Popup งานรายวัน (ไม่เห็น Dashboard) |
| `staffb` | `staff123` | TECHNICIAN | เหมือน staffa |

> 📌 **นโยบายหน้าที่:** การบำรุงรักษา (PM) เป็นงานของ **ช่าง (TECHNICIAN)** — ผู้ดูแล (ADMIN) มีหน้าที่กำกับดูแลและตรวจสอบประวัติ ไม่ลงมือ PM เอง (เป็นนโยบายการใช้งาน ระบบเปิดสิทธิ์ทางเทคนิคไว้แต่ไม่บังคับ)

- **TECHNICIAN** เมื่อ login จะมี **Popup งานของวัน** เด้งขึ้น เตือน **เฉพาะเครื่องที่เลยกำหนด + ครบกำหนดวันนี้** (ไม่รวมที่ "ใกล้จะถึง" — เลยกำหนด = "ล่าช้า") ทำข้ามวันได้ ไม่บังคับเสร็จในวันเดียว · เปิดดูซ้ำได้ที่ปุ่ม 🔔 "งานวันนี้"
- ทุกครั้งที่บันทึก PM ระบบบันทึก **ผู้ดำเนินการ** = ผู้ที่ login อยู่ (เช่น Staff A) อัตโนมัติ
- พนักงานลาออก/พ้นสภาพ → ตั้ง `app_user.status = 'X'` (เข้าสู่ระบบไม่ได้) แต่ **ไม่ลบบัญชี** เพื่อให้ประวัติ PM ยังแสดงชื่อผู้ทำได้ (สถานะ `A` = ทำงานอยู่)
- **Activity log** — ทุก action สำคัญ (login/logout, เพิ่ม/แก้/ลบอุปกรณ์, บันทึก/ลบ PM, ดู/Export รายงาน) ถูกบันทึกลงตาราง `activity_log` (ใคร/ทำอะไร/เมื่อไร/IP) ดูผ่าน SSMS: `SELECT * FROM activity_log ORDER BY log_id DESC`
- **PM Checklist** — รายการตรวจเช็คแยกตามกลุ่มอุปกรณ์ (Hardware/Software) ตอนบันทึก PM ช่างติ๊กผลแต่ละข้อ (ผ่าน/ไม่ผ่าน + หมายเหตุ) เก็บประวัติดูย้อนหลังได้ · **ADMIN** จัดการรายการตรวจเองได้ที่เมนู "รายการตรวจ PM" (เพิ่ม/แก้/ลบ/เปิด-ปิด)

## 🚀 วิธีรัน

### ความต้องการเบื้องต้น
- Node.js 20+ และ npm
- MS SQL Server (รันอยู่) + มี database `pm_workshop` แล้ว
- ตั้งค่า `server/.env` (คัดลอกจาก `server/.env.example`)

### วิธี A — รันในเครื่อง (พัฒนา/นำเสนอ)

เปิด 2 terminal:

```powershell
# Terminal 1 — Backend
cd server
npm install                 # ครั้งแรกเท่านั้น
npm run prisma:generate     # ครั้งแรก / เมื่อแก้ schema
npx prisma db push          # ครั้งแรก / เมื่อแก้ schema
npm run seed                # ใส่ข้อมูลตัวอย่าง (idempotent)
npm run dev                 # → http://localhost:4000

# Terminal 2 — Frontend
cd web
npm install                 # ครั้งแรกเท่านั้น
npm run dev                 # → http://localhost:5173
```

เปิดเบราว์เซอร์ที่ **http://localhost:5173**

### วิธี B — Docker (คำสั่งเดียว)

```powershell
docker compose up --build
```

รายละเอียด + การแก้ปัญหา ดู [docs/DOCKER.md](docs/DOCKER.md)

---

## ✅ ตรวจว่ารันสำเร็จ

1. Terminal backend ขึ้น `API พร้อมใช้งานที่ http://localhost:4000`
2. http://localhost:4000/api/health → `{"ok":true}`
3. http://localhost:5173 → เห็น **หน้า Login** → เข้าด้วย `admin/admin123` หรือ `staffa/staff123`

---

## 📦 ฟังก์ชันหลัก

1. **Login + แยกสิทธิ์ (RBAC)** — bcrypt + JWT; ADMIN เห็นทุกอย่าง / TECHNICIAN จัดการอุปกรณ์+PM+รายงาน (ไม่เห็น Dashboard); บัญชี `status='X'` เข้าระบบไม่ได้
2. **จัดการอุปกรณ์ (CRUD)** — เพิ่ม/แก้/ลบ/ค้นหา (SN เป็น PK แก้ไม่ได้ตอน edit) · **ลบ = soft delete** (ซ่อนจากรายการ แต่เก็บประวัติ PM เดิมไว้ · เพิ่ม SN เดิมใหม่ = กู้คืนพร้อมประวัติ)
3. **บันทึกผล PM + Checklist** — ติ๊กรายการตรวจรายข้อ (ผ่าน/ไม่ผ่าน + หมายเหตุ) + คำนวณรอบถัดไปอัตโนมัติ + บันทึกผู้ทำ
4. **แจ้งเตือน (Alert/Popup)** — Dashboard (ADMIN) การ์ดสรุปคลิกกรองรายการตามสถานะได้ / Popup งานรายวันของ TECHNICIAN — เลยกำหนด = "ล่าช้า"
5. **ประวัติ PM** — เรียงล่าสุด→เก่า, คลิกแถวดู Popup รายละเอียด + ผลตรวจ checklist
6. **จัดการรายการตรวจ PM** — ADMIN เพิ่ม/แก้/ลบ/เปิด-ปิด checklist แยกตามกลุ่ม
7. **รายงาน + Export Excel** — แผน PM รายเดือน / ประวัติ PM รายเครื่อง / ค่าใช้จ่าย (มี Pie chart สัดส่วนตามกลุ่ม)
8. **Activity log** — บันทึกทุก action สำคัญลง DB (audit)

---

## 🎨 หน้าตา & การใช้งาน (UI/UX)

ปรับให้ **ใช้งานง่าย สบายตา** แนว minimal:

- **ธีม Teal/Sage** — สีหลักเขียวอมฟ้านุ่ม `#2F8F83` พื้นหลังอ่อน มุมมน 8 ฟอนต์ไทย Sarabun การ์ดเงาบาง (กำหนดที่ `web/src/main.tsx` จุดเดียว · สีสถานะ/กราฟรวมที่ `web/src/lib/format.ts`)
- **หัวหน้าจอมาตรฐานทุกหน้า** — ชื่อ + คำอธิบายสั้นช่วยผู้ใช้ + ปุ่มหลัก (คอมโพเนนต์ `PageHeader`)
- **Header เบาแบบ brand** + เมนูไฮไลต์โทนเดียวกัน, **Dashboard การ์ดคลิกกรองได้** + โหลดแบบ skeleton
- **Empty state มีปุ่มพาไปทำขั้นต่อไป**, หน้า Login รีแบรนด์ใหม่
- **ไฟล์ Excel ที่ Export เข้าธีมเดียวกับเว็บ + อ่านง่าย** — หัวรายงานแถบเขียวอมฟ้า ตัวอักษรขาว, แถวสลับสีจาง, ตรึงหัวตาราง + ตัวกรองในตัว, **ตัวเลขมีตัวคั่นหลักพันชิดขวา, คอลัมน์กว้างพอดีเนื้อหา (ไม่โดนตัด), เว้นระยะแต่ละแถว** (คงคอลัมน์/รูปแบบวันที่เดิมตามสเปก)
- *เป็นการปรับชั้นนำเสนอ (UI) ล้วน — โครงสร้างข้อมูล/ER และ 7 ตารางไม่เปลี่ยน*
