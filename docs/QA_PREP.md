# 🎓 คำถามสอบสัมภาษณ์ / Q&A เตรียมนำเสนอ — PM_WorkShop_2025

รวมคำถามที่อาจารย์/กรรมการมักถามหลังเดโม่ + **แนวคำตอบสั้น ๆ** ไว้ทบทวน
แบ่งตามหมวด (ง่าย → ยาก) อ่าน [docs/DESIGN.md](DESIGN.md) และ [docs/CODE_GUIDE.md](CODE_GUIDE.md) ประกอบ

## 📋 หมวด

1. [โจทย์ / ขอบเขตธุรกิจ](#1-โจทย์--ขอบเขตธุรกิจ)
2. [Tech Stack + สถาปัตยกรรม](#2-tech-stack--สถาปัตยกรรม)
3. [ฐานข้อมูล / ER](#3-ฐานข้อมูล--er)
4. [Security / Auth / RBAC](#4-security--auth--rbac)
5. [ตรรกะระบบ (PM calc, Checklist, Soft delete)](#5-ตรรกะระบบ-pm-calc-checklist-soft-delete)
6. [Frontend / UX](#6-frontend--ux)
7. [รายงาน + Excel](#7-รายงาน--excel)
8. [Audit / Activity Log](#8-audit--activity-log)
9. [Docker / Deploy](#9-docker--deploy)
10. [Tradeoffs / ข้อจำกัด / ต่อยอด](#10-tradeoffs--ข้อจำกัด--ต่อยอด)

---

## 1. โจทย์ / ขอบเขตธุรกิจ

**Q1. ระบบนี้แก้ปัญหาอะไร ทำไมต้องเป็น "เชิงป้องกัน" (Preventive)?**
- 💡 PM = ทำก่อนเสีย (ทุก 3/6 เดือน) ลดเครื่องเสีย/ค่าซ่อม
- ปัญหาเดิม: จดในกระดาษ/Excel กระจาย → ลืมรอบ, ไม่รู้ใครทำ, หาประวัติยาก
- ระบบนี้ทำให้รู้ "เครื่องไหนถึงรอบ" อัตโนมัติ + เก็บประวัติย้อนหลังได้

**Q2. ใครคือผู้ใช้ระบบ ทำไมต้องแยก 2 บทบาท?**
- 💡 **ADMIN** = ผู้ดูแล/หัวหน้า — ตั้งค่าระบบ, ดูภาพรวม, ออกรายงาน
- **TECHNICIAN (ช่าง)** = ผู้ลงมือ PM จริง
- แยกตาม **หน้าที่จริงในที่ทำงาน** + ลดสิทธิ์ที่ไม่จำเป็น (least privilege)

**Q3. ขอบเขตที่ทำเสร็จกับที่ยังไม่ได้ทำ?**
- 💡 เสร็จ: จัดการอุปกรณ์ / บันทึก PM + checklist / แจ้งเตือน / 3 รายงาน + Excel / Login+RBAC / Audit log
- ที่ยังไม่ได้: จัดการ user ใน UI, ตั้งค่ากลุ่มใน UI, แก้ไขรายการ PM (ลบสร้างใหม่ได้), PDF, email notification — เป็นของเสริมนอกโจทย์

---

## 2. Tech Stack + สถาปัตยกรรม

**Q4. ทำไมเลือก React + Vite ไม่เลือก Next.js / Angular?**
- 💡 React + Vite ตรงกับความถนัด + รันเร็ว เหมาะเวลาจำกัด (5 วัน)
- ไม่ต้องการ SSR (เป็นระบบ intranet) → Next.js เกินจำเป็น
- antd มี component สำเร็จเยอะ ลดเวลาเขียน UI

**Q5. ทำไม Prisma ไม่ใช้ TypeORM หรือ raw SQL?**
- 💡 **Type-safe** — schema → auto-gen types ทั้ง backend
- Schema = แหล่งความจริงเดียว, migration ทำให้
- รองรับ MS SQL ดี (TypeORM ปรับ MS SQL ยุ่งกว่า)
- เขียน query สั้น อ่านง่าย (`findMany({ where, include })`)

**Q6. ทำไม MS SQL Server ไม่ใช้ PostgreSQL/MySQL?**
- 💡 ตามข้อกำหนดของโจทย์ (เทียบกับระบบงานเดิม)
- ถ้าเปลี่ยน: แก้ `datasource provider` ใน schema.prisma + `@db.VarChar/NVarChar` — โค้ด app ไม่ต้องแตะ

**Q7. โครงสร้าง monorepo (server + web) แยกหรือรวม package.json ทำไม?**
- 💡 แยกอิสระ: dependency คนละชุด (backend ไม่ต้องมี React, frontend ไม่ต้องมี Prisma)
- build/run แยกกัน → ทดสอบ/แก้ฝั่งเดียวไม่กระทบอีกฝั่ง
- เหมาะกับงานขนาดนี้ (ไม่ใหญ่พอที่จะใช้ Turborepo/Nx)

**Q8. ทำไมต้องใช้ Docker?**
- 💡 รันคำสั่งเดียว (`docker compose up`) ขึ้นทั้งระบบ
- Environment เหมือนกันทุกเครื่อง (ไม่มีปัญหา "ที่ผมรันได้")
- ผู้ทดสอบไม่ต้องติดตั้ง Node/npm เอง
- Entrypoint รัน prisma generate + push + seed อัตโนมัติ

**Q9. ขั้นตอนข้อมูลไหลจากผู้ใช้กดปุ่ม "บันทึก PM" จนถึง DB?**
- 💡 1) คลิก → React handler เรียก `createPm()` จาก client.ts
- 2) axios สร้าง `POST /api/pm` + แนบ token (request interceptor)
- 3) Vite proxy → Express :4000
- 4) Middleware: cors → json parser → requireAuth (verify JWT)
- 5) Route handler ใน pm.ts → Prisma `create({ data: {..., checkResults: { create: [...] } }})`
- 6) Prisma แปลงเป็น SQL → MS SQL Server insert
- 7) `logActivity("PM_CREATE")` (fire-and-forget) + response 201
- 8) Frontend `.then(...)` → React setState → UI update

---

## 3. ฐานข้อมูล / ER

**Q10. ทำไมเลือก `serial_number` เป็น PK ของ equipment ไม่ใช่ auto-increment id?**
- 💡 SN ไม่ซ้ำตามธรรมชาติ (จากผู้ผลิต)
- ระบบงานจริง reference ด้วย SN ไม่ใช่ id ตัวเลข
- ลด surrogate key ที่ไม่จำเป็น
- **Tradeoff:** แก้ SN ภายหลังไม่ได้ (immutable) — แต่ในทางปฏิบัติ SN ไม่ควรเปลี่ยน

**Q11. ทำไม `equipment.status` มี ACTIVE / RETIRED / DELETED 3 ค่า?**
- 💡 ACTIVE = ใช้งานจริง (เข้า PM cycle)
- RETIRED = เลิกใช้แต่เก็บข้อมูล (ไม่ต้อง PM แล้ว — เห็นในรายการ)
- DELETED = soft delete จากผู้ใช้สั่งลบ (ซ่อนจากรายการ แต่ FK ประวัติ PM ไม่หลุด)

**Q12. ทำไมไม่ลบจริง ใช้ soft-delete?**
- 💡 ถ้าลบจริง → cascade ลบ pm_record ทั้งหมด → **ประวัติหาย**
- soft-delete: เปลี่ยน status='DELETED' → แถวอยู่ FK ไม่หลุด ประวัติคงอยู่
- หลักเดียวกับ `app_user.status='X'` (ลาออก/พ้นสภาพ)
- เพิ่ม SN เดิมใหม่ = กู้คืน (revive) พร้อมประวัติเดิม

**Q13. ทำไม `pm_check_result.item_label` เก็บซ้ำกับ `pm_check_item.label`?**
- 💡 **Snapshot pattern** — เก็บข้อความ ณ เวลาที่ตรวจ
- ถ้า admin แก้/ลบรายการตรวจภายหลัง → ประวัติเก่ายังอ่านได้
- FK `check_item_id` ตั้ง `onDelete: SetNull` (ลบ master ได้ ไม่กระทบ history)

**Q14. ทำไม `pm_record.cost` เก็บซ้ำกับ `equipment_group.cost_per_pm`?**
- 💡 Snapshot ราคา ณ วันที่ทำ — ภายหลังปรับราคากลุ่ม รายงานย้อนหลังถูก
- Pattern เดียวกับ snapshot label

**Q15. cardinality `|o--o{` ระหว่าง APP_USER กับ PM_RECORD แปลว่าอะไร?**
- 💡 0..1 → 0..N: pm_record อาจไม่มี performed_by (nullable)
- เผื่อเคส migrate ข้อมูลเก่าที่ไม่รู้ผู้ทำ
- หนึ่ง user ทำ PM ได้หลายครั้ง

**Q16. ทำไม PmCheckItem.group ตั้ง `onDelete: NoAction` ไม่เป็น Cascade?**
- 💡 SQL Server ไม่อนุญาต **multi-cascade-path** (Prisma error P1012)
- pm_check_result เข้าถึงจาก equipment_group ได้ 2 ทาง (ผ่าน pm_record และผ่าน pm_check_item) → ต้องตัดเส้นทาง
- กลุ่มอุปกรณ์ไม่มีลบในระบบอยู่แล้ว → NoAction ปลอดภัย

**Q17. ทำไมไม่มีตาราง "plan" สำหรับเก็บแผน PM?**
- 💡 **คำนวณสด ๆ** จาก `pm_record` ล่าสุด + `pm_interval_months`
- ลดความซับซ้อน + ไม่มีข้อมูลซ้ำซ้อน + ปรับ interval ปุ๊บมีผลทันที
- เหมาะกับเวลา 5 วัน

---

## 4. Security / Auth / RBAC

**Q18. ทำไมใช้ bcrypt ไม่ใช่ MD5 / SHA-256?**
- 💡 bcrypt มี **salt** ในตัว (รหัสเดียวกัน hash ออกมาไม่ซ้ำ)
- มี **cost factor** (ตั้งให้ช้า) ทนต่อ brute force
- MD5/SHA เร็วเกิน + ไม่มี salt → rainbow table attack ง่าย

**Q19. JWT เก็บที่ localStorage มีปัญหาความปลอดภัยไหม?**
- 💡 มี — XSS อ่านได้ (cookie HttpOnly ปลอดภัยกว่า)
- สำหรับ intranet workshop ยอมรับได้
- ถ้า production: ใช้ HttpOnly cookie + CSRF token หรือ refresh token rotation

**Q20. JWT payload ใส่อะไรบ้าง / ห้ามใส่อะไร?**
- 💡 ใส่: `id, username, displayName, role, exp` (8 ชม.)
- **ห้ามใส่:** password, ข้อมูลส่วนตัวอ่อนไหว — เพราะ payload base64 อ่านได้ ไม่ใช่ encryption
- ใส่แค่ที่ middleware ใช้ตัดสินสิทธิ์

**Q21. ถ้าใครได้ token ของคนอื่นจะทำอะไรได้?**
- 💡 ปลอมเป็นคนนั้นได้จนกว่าจะหมดอายุ (8 ชม.)
- ป้องกัน: HTTPS (กันดักกลางทาง), ไม่ log token, รีไซเคิล JWT_SECRET เมื่อรั่ว
- ในระบบจริง: เพิ่ม IP binding / device fingerprint

**Q22. token หมดอายุระบบทำอะไร?**
- 💡 jwt.verify throw → middleware ตอบ 401
- ฝั่งเว็บ: axios response interceptor จับ 401 → ลบ token + redirect /login
- ผู้ใช้เห็นหน้า Login → login ใหม่

**Q23. RBAC ทำงานยังไง? บอก flow**
- 💡 1) Login สำเร็จ → JWT มี `role` ใน payload
- 2) Route ที่ admin-only ใช้ `requireRole("ADMIN")` middleware
- 3) middleware ตรวจ payload.role → ไม่ตรง → 403
- 4) Frontend: เมนู render ตาม `user.role` ในการ render (`isAdmin && <Menu>`)
- **กุญแจ:** trust หลังบ้านเสมอ ฝั่งหน้าเว็บแค่ UX (ซ่อนเมนู)

**Q24. ถ้าผู้ใช้ปลอม role เป็น ADMIN ใน token ได้ไหม?**
- 💡 ไม่ได้ — แก้ payload → signature ไม่ตรง → `jwt.verify` throw → 401
- signature = HMAC(header.payload, SECRET) → ไม่มี SECRET ปลอม signature ไม่ได้

---

## 5. ตรรกะระบบ (PM calc, Checklist, Soft delete)

**Q25. สูตรคำนวณ next_due ทำงานยังไง?**
- 💡 `base = lastPmDate ?? commissionDate` (ฐาน)
- `nextDue = base + intervalMonths` (ใช้ `addMonths` จัดการสิ้นเดือน)
- `daysUntilDue = (nextDue - today) / 86400000` (เปรียบ UTC startOfDay)
- Status: < 0 = OVERDUE, ≤ 30 = DUE_SOON, > 30 = OK, ไม่มี base = NEVER

**Q26. `addMonths(31 ม.ค. 2026, 1)` ได้อะไร?**
- 💡 28 ก.พ. 2026 (เดือนนั้นไม่มี 31 → ใช้วันสุดท้ายของเดือน)
- Algorithm: setUTCDate(1) → setUTCMonth(+1) → setUTCDate(min(day, lastDay))

**Q27. Plan report ทำงานยังไงโดยไม่มีตาราง plan?**
- 💡 วนทุก ACTIVE equipment:
  1. หา base = pm_record ล่าสุดก่อนเริ่ม period หรือ commissionDate
  2. วน `addMonths` (guard 120 รอบ) จนเกิน period
  3. plannedDate ใน period → จับคู่กับ actual pm_record ในช่วงเดียวกัน (ถ้ามี)
  4. push เข้า array → sort by plannedDate

**Q28. ทำไม Daily popup ของช่างเตือนเฉพาะ overdue + due-today?**
- 💡 "งานของวันนั้น" จริง ๆ — กันที่ใกล้ครบรอบ 1-30 วันมากวน
- ช่างเปิดมาเห็นเฉพาะที่ต้องลงมือ ไม่หลงประเด็น
- Dashboard ของ admin ยังเห็นภาพรวมทั้งหมด

**Q29. POST /api/pm กรอง checklist input ยังไง?**
- 💡 1) ดึง `pmCheckItem` ของ groupCode เครื่องนั้น (active = true)
- 2) ทำ Map<id, label>
- 3) Filter `b.checks` ให้เหลือเฉพาะ id ที่อยู่ใน Map + result PASS/FAIL ที่ valid
- 4) Map → ใส่ `itemLabel` snapshot จาก Map
- **Whitelist pattern** — กันส่ง id มั่ว/ข้ามกลุ่ม

**Q30. soft delete อุปกรณ์ + revive ทำงานยังไง?**
- 💡 DELETE: `update({ data: { status: 'DELETED' } })` (ไม่ลบจริง)
- GET list: `where: { status: { not: 'DELETED' } }` (ซ่อน)
- POST SN เดิม: findUnique เจอ → ถ้า status=DELETED → update กลับ ACTIVE พร้อมข้อมูลใหม่ → ประวัติ PM เดิมผูกกับ SN ยังอยู่
- alert.ts/report.ts(plan) กรอง `status:'ACTIVE'` อยู่แล้ว → DELETED หลุดจาก Dashboard/แผนเอง

---

## 6. Frontend / UX

**Q31. ทำไม Dashboard เห็นเฉพาะ ADMIN ไม่ให้ช่างเห็น?**
- 💡 admin = กำกับ → ต้องเห็นภาพรวม
- ช่าง = ลงมือ → focus งานของตัวเอง (popup งานวันนี้ก็พอ)
- ลด cognitive load + ไม่ต้องไล่หาเอง

**Q32. ทำไมการ์ดสรุปคลิกได้?**
- 💡 Drill-down — ภาพรวม → รายละเอียดในคลิกเดียว
- ลดการสลับหน้า/ตั้ง filter เอง
- กรองฝั่ง client (data มีอยู่แล้ว) → ไม่ต้องเรียก backend ใหม่ → เร็ว

**Q33. axios interceptor ทำหน้าที่อะไร?**
- 💡 **Request:** แนบ token ทุก request อัตโนมัติ (ไม่ต้องทำเองทุกที่)
- **Response:** จับ 401 → ลบ token + redirect /login (token หมดอายุ)
- จุดเดียวคุม cross-cutting concern ทั้งระบบ

**Q34. React hooks ที่ใช้ในโปรเจกต์มีอะไรบ้าง ใช้ทำอะไร?**
- 💡 `useState` — เก็บ state ที่เปลี่ยน → trigger re-render
- `useEffect` — รัน side effect (fetch) เมื่อ deps เปลี่ยน
- `useCallback` — memoize ฟังก์ชัน → ใส่ใน deps ของ useEffect ได้
- `useMemo` — memoize ผลคำนวณ (เช่น filter rows)
- `useContext` — อ่านค่าจาก AuthContext (useAuth())

**Q35. ทำไมต้องใช้ ConfigProvider ของ antd?**
- 💡 ตั้ง **design tokens** (สี/ฟอนต์/มุมมน) ที่เดียวคุมทั้งระบบ
- เปลี่ยนสีเดียวมีผลทุก component
- locale ไทย (วันที่/datepicker)

---

## 7. รายงาน + Excel

**Q36. ทำไมเลือก ExcelJS ไม่ใช่ xlsx (sheetjs)?**
- 💡 ExcelJS เก่ง **style** (border/fill/font/freeze/autoFilter)
- sheetjs เก่ง parse แต่ style limited
- โจทย์ต้องการไฟล์มี style (หัวเขียว+เส้นตาราง)

**Q37. format=excel กับ JSON ใช้ endpoint เดียวกันได้ยังไง?**
- 💡 query param `?format=excel` → handler ตัดสิน
- `isExcel ? sendStyledExcel(...) : res.json(...)`
- ลด duplicate route + frontend ใช้ JSON เดียวกันขึ้นตาราง/Pie + กดปุ่ม Export ส่ง format=excel ได้ไฟล์

**Q38. ทำไม Pie chart อยู่ฝั่งเว็บไม่ใน Excel?**
- 💡 ExcelJS ไม่ support native chart (ต้องเขียน OOXML XML เอง → เสี่ยง/ยาก)
- เว็บ render ด้วย recharts จาก JSON เดียวกัน → ลด complexity
- ผู้ใช้กดแทรกกราฟใน Excel เองได้ 2 คลิก (มี table + autoFilter พร้อมแล้ว)

**Q39. ตอน export Excel ทำ auto-fit width ยังไง?**
- 💡 วน rows หา content ยาวสุดต่อคอลัมน์ → `max(headerLen, contentLen)`
- คูณ factor 1.2 (ไทยกว้างกว่า) + padding 3
- Clamp `[9, 50]` กันแคบเกิน/ยาวเกิน
- ไม่แคบกว่า `c.width` ที่ตั้งไว้เริ่มต้น

**Q40. ทำไมตัวเลขต้อง numFmt "#,##0"?**
- 💡 ตัวคั่นหลักพันอ่านง่าย (`12,500` แทน `12500`)
- เป็น built-in Excel format id=3 → ExcelJS อ้าง id ไม่เขียน text
- เลข locale-independent (Excel แสดงตามภาษาผู้ใช้)

---

## 8. Audit / Activity Log

**Q41. activity_log เก็บอะไรบ้าง?**
- 💡 ทุก action **สำคัญ**: LOGIN, LOGIN_FAILED, LOGOUT, EQUIPMENT_CREATE/UPDATE/DELETE, PM_CREATE/DELETE, CHECK_ITEM_*, REPORT_VIEW/EXPORT
- เก็บ: user_id (null ได้กรณี login fail), username snapshot, role, action, detail, method/path/ip, timestamp

**Q42. ถ้า log ล้มเหลวระบบหลักล่มไหม?**
- 💡 **ไม่** — `logActivity` fire-and-forget + `.catch()` ภายใน
- log error แค่ console.error → ระบบหลักวิ่งต่อ
- Trade-off: log อาจหายได้ในกรณีพิเศษ (ยอมรับได้ — ไม่ critical กว่า user experience)

**Q43. ทำไมเก็บ `username` ใน activity_log ทั้งที่มี FK ไป user?**
- 💡 Snapshot ชื่อ ณ เวลานั้น → ถ้า user เปลี่ยน username/ลบ ประวัติยังอ่านได้
- LOGIN_FAILED ไม่มี user_id (ผู้พยายาม login ไม่เจอใน DB) → ต้องเก็บ username ที่กรอกมา
- รักษา audit trail สมบูรณ์

**Q44. ทำไมไม่ log การคลิกปุ่ม/view ทุกครั้ง?**
- 💡 **Audit principle:** log meaningful actions ที่เปลี่ยนสถานะ ไม่ใช่ทุก interaction
- ลด noise + storage + improve query
- กรณีเฉพาะ EXPORT log เพราะเป็นการนำข้อมูลออก (compliance)

---

## 9. Docker / Deploy

**Q45. docker-compose ทำอะไร? มี service กี่ตัว?**
- 💡 2 service: `server` (Express :4000), `web` (Vite :5173)
- DB = MS SQL Server อยู่บน host → connect ผ่าน `host.docker.internal:1433`
- Entrypoint server: prisma generate → db push → seed → ts-node-dev

**Q46. ทำไมต้อง restart server หลังแก้โค้ด backend?**
- 💡 ts-node-dev ใช้ inotify watch ไฟล์
- Windows bind mount ไม่ propagate inotify events → ts-node-dev ไม่รู้ว่าไฟล์เปลี่ยน
- Workaround: `docker compose restart server` (entrypoint รัน prisma+seed ใหม่ idempotent)
- Frontend Vite ใช้ usePolling → HMR ทำงานปกติ

**Q47. ถ้าเปลี่ยน dependency ใน package.json ต้องทำยังไง?**
- 💡 node_modules อยู่ใน named volume → ต้อง rebuild
- `docker compose down -v` (ลบ volume) → `up --build` → entrypoint รัน `npm install` ใหม่
- DB ไม่หาย (อยู่บน host)

**Q48. ถ้า deploy production ต้องเปลี่ยนอะไร?**
- 💡 1. Server: `tsc` build → run `node dist/index.js` (ไม่ใช้ ts-node)
- 2. Web: `npm run build` → serve static (nginx/apache)
- 3. ENV: JWT_SECRET แข็ง, DATABASE_URL production
- 4. HTTPS (cert), reverse proxy
- 5. ปิด CORS หรือกำหนด origin ตรง
- 6. ตั้ง log retention, backup DB

---

## 10. Tradeoffs / ข้อจำกัด / ต่อยอด

**Q49. ระบบนี้มีข้อจำกัดอะไรบ้าง?**
- 💡 1. ไม่มี UI จัดการ user / equipment_group / แก้ไขรายการ PM
- 2. ไม่บังคับ "admin ไม่ทำ PM" ในระบบ (เป็นนโยบายปฏิบัติ)
- 3. ไม่มี email/LINE notification (เตือนแค่ในเว็บ)
- 4. ไม่มี import Excel (เพิ่มอุปกรณ์ทีละตัว)
- 5. /api/alerts compute ทุกครั้ง (10k+ เครื่องอาจช้า)

**Q50. ถ้าจะขยายต่อ จะเพิ่มอะไรก่อน?**
- 💡 ลำดับความสำคัญ:
  1. **หน้าจัดการผู้ใช้** (admin) — เพิ่มช่าง/ปลดพนักงาน — backend RBAC พร้อม UI ยังไม่มี
  2. **ตั้งค่ากลุ่มใน UI** — เปลี่ยน interval/cost ได้เอง (กระทบ next_due)
  3. **แก้ไขรายการ PM** — แก้พิมพ์ผิดโดยไม่ลบทิ้ง
  4. **Validation วันที่** (กันลงอนาคต/ก่อน commission)
  5. **กราฟแนวโน้ม** Dashboard (จำนวน PM/เดือน)

**Q51. ถ้ามีอุปกรณ์ 10,000 ชิ้น Dashboard ยังเร็วไหม?**
- 💡 อาจช้า — alert.ts วน computePm 10k ครั้ง + subquery pmRecord ต่อตัว
- ทางแก้:
  1. เพิ่ม index `equipment(status)`, `pm_record(serial_number, pm_date)`
  2. Cache /api/alerts (TTL สั้น เช่น 5 นาที)
  3. Compute ใน background job → เก็บลงตาราง pre-computed
  4. Paginate frontend

**Q52. ความปลอดภัยอะไรที่ยังขาด?**
- 💡 1. Rate limiting (กัน brute force login)
- 2. Input validation strict (Zod/Joi)
- 3. CSRF (ใช้ Bearer JWT → low risk)
- 4. SQL injection — Prisma ป้องกันให้แล้ว (parameterized)
- 5. Audit log tamper-proof (admin DB แก้ได้) — production ใช้ write-only DB user

**Q53. ทำไมตัดสินใจไม่ทำ PDF ในเวิร์กชอปนี้?**
- 💡 รายงานเป็นภาษาไทย → ต้อง embed font Sarabun (ขนาดใหญ่)
- ทางเลือกที่ประเมิน: server pdfmake + @fontsource/sarabun / @react-pdf ฝั่งเว็บ
- ทั้ง 2 ทางเพิ่ม dependency หนัก + complexity
- **Excel เพียงพอ** สำหรับเป้าหมายของโจทย์ (ส่งผ่านอีเมล/แก้ต่อได้)

**Q54. ทดสอบระบบยังไง?**
- 💡 Manual smoke test ครบทุก flow (login/CRUD/PM/Report/Excel)
- ใช้ curl + node script ตรวจ API endpoints (login, soft-delete revive, alerts ok-array, excel styles)
- ไม่ได้เขียน unit test/E2E (เวลาจำกัด) — production ควรเพิ่ม Jest + Playwright

**Q55. ถ้าผู้ใช้ลบ checklist item ที่ใช้ในประวัติแล้วเกิดอะไรขึ้น?**
- 💡 FK `pm_check_result.check_item_id` ตั้ง `onDelete: SetNull`
- รายการ master ถูกลบได้ → ผลใน history `check_item_id = null` แต่ `item_label` snapshot ยังอยู่ → ประวัติยังอ่านได้
- รายการตรวจรอบใหม่จะไม่มีตัวที่ถูกลบแล้ว (เว้นแต่ admin เพิ่มกลับ)

---

## 🎯 เคล็ดลับตอบ Q&A

1. **ตอบตรงประเด็นก่อน 1 ประโยค** → ค่อยขยายเหตุผล
2. ใช้คำว่า **"trade-off"** / "เลือก X แทน Y เพราะ..." — แสดงว่ารู้ทั้ง 2 ทางและเลือกอย่างมีเหตุผล
3. ยอมรับข้อจำกัดอย่างตรงไปตรงมา + เสนอวิธีแก้ถ้ามี → ดีกว่าปกป้องทุกอย่าง
4. โยงกลับโจทย์เสมอ — "เพราะระบบนี้เป็น workshop 5 วัน เลย..."
5. ถ้าไม่รู้: "เรื่องนี้ผมยังไม่ได้ลงมือ แต่ถ้าจะทำคิดว่าจะ..." — ดีกว่าเดามั่ว

> 📚 อ่านประกอบ: [DESIGN.md](DESIGN.md) (ER/Flow/สูตร), [CODE_GUIDE.md](CODE_GUIDE.md) (อธิบายโค้ดละเอียด), [DEMO.md](DEMO.md) (สคริปต์เดโม่)

ขอให้สอบผ่านราบรื่นค่ะ 🎓✨
