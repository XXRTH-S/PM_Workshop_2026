# 📚 คู่มืออธิบายโค้ดระบบ PM_WorkShop_2025

เอกสารอธิบายการทำงานของโค้ดทั้งระบบ — เน้น **"ข้อมูลไหลไปยังไง"** ตั้งแต่กดปุ่มจนได้ผล,
การ get/post, การกรองด้วยเงื่อนไข, และแนวคิดของภาษา/ไลบรารีที่ใช้

## สารบัญ
1. [ภาพรวมและวงจรของ Request 1 ครั้ง](#1-ภาพรวมและวงจรของ-request-1-ครั้ง)
2. [Backend — Express + Prisma + TypeScript](#2-backend--express--prisma--typescript)
3. [Frontend — React + axios + Vite](#3-frontend--react--axios--vite)
4. [แนวคิดสำคัญของภาษา/ไลบรารี](#4-แนวคิดสำคัญของภาษาไลบรารี)

---

## 1. ภาพรวมและวงจรของ Request 1 ครั้ง

### สถาปัตยกรรม

```
[เบราว์เซอร์]                    [Vite :5173]         [Express :4000]      [SQL Server :1433]
     │                                │                       │                       │
     │ ผู้ใช้กด "บันทึก PM"            │                       │                       │
     │──────────────────────────────▶│                       │                       │
     │                                │ proxy /api/* →        │                       │
     │                                │──────────────────────▶│                       │
     │                                │                       │ Prisma query          │
     │                                │                       │──────────────────────▶│
     │                                │                       │◀──── ผลลัพธ์ ───────  │
     │                                │◀── JSON ──────────────│                       │
     │◀── React update UI ────────────│                       │                       │
```

**ขั้นตอนตอนผู้ใช้กดปุ่ม "บันทึก PM" 1 ครั้ง:**

1. คลิกปุ่ม → handler ของ React เรียก `createPm({...})` จาก `web/src/api/client.ts`
2. `axios` สร้าง HTTP request `POST /api/pm` + header `Authorization: Bearer <token>` (request interceptor แนบให้)
3. Vite dev server (`:5173`) เห็น `/api/*` ตั้ง proxy → ส่งต่อไป Express (`:4000`)
4. Express รับ request → ผ่าน middleware chain: `cors` → `express.json()` → `requireAuth` (ตรวจ JWT)
5. ตรงกับ route `app.use("/api/pm", pmRouter)` → handler `pmRouter.post("/")` ทำงาน
6. handler ใช้ `prisma.equipment.findUnique(...)` หาเครื่อง, ตรวจ checklist, `prisma.pmRecord.create({ data: {..., checkResults: { create: [...] } } })` บันทึกลง DB
7. Prisma แปลงเป็น SQL ส่งไป MS SQL Server → ได้แถวที่สร้าง
8. handler เรียก `logActivity(req, "PM_CREATE", ...)` (fire-and-forget) แล้ว `res.status(201).json(created)`
9. axios ฝั่งหน้าเว็บได้ response → React `.then((d) => ...)` รัน → `setHistory(...)` → React re-render UI

ทั้งหมดนี้เป็น **asynchronous (async/await)** — JavaScript ไม่บล็อกระหว่างรอ DB/network

---

## 2. Backend — Express + Prisma + TypeScript

### 2.1 จุดเริ่มและ Middleware chain — [`server/src/index.ts`](../server/src/index.ts)

```ts
const app = express();
app.use(cors());                                    // (1) อนุญาต cross-origin
app.use(express.json());                            // (2) parse body JSON อัตโนมัติ

app.get("/api/health", (_req, res) => res.json({ ok: true }));  // public health check
app.use("/api/auth", authRouter);                   // (3) login/logout — สาธารณะ (ไม่ต้อง token)
app.use("/api", requireAuth);                       // (4) middleware กั้น: ทุก /api ต่อจากนี้ต้องมี token
app.use("/api/equipment", equipmentRouter);          // (5) routes ที่ต้อง login
app.use("/api/pm", pmRouter);
// ...
```

**ทำไม middleware เรียงแบบนี้สำคัญ:**
- `cors`/`express.json` ต้องมาก่อนทุก route (เพื่อให้ทุก request ผ่านการ parse body)
- `/api/auth` ลงทะเบียน **ก่อน** `app.use("/api", requireAuth)` → login เข้าได้โดยไม่ต้องมี token (ไม่งั้นจะ login ไม่ได้)
- `requireAuth` ลงทะเบียนหลัง → กั้นทุก route ต่อจากนั้นโดยอัตโนมัติ ไม่ต้องใส่ guard ทุกไฟล์
- error handler `app.use((err, req, res, next) => {...})` ต้องมี 4 พารามิเตอร์ Express ถึงจะรู้ว่าเป็น error handler

### 2.2 Prisma client (singleton) — [`server/src/lib/prisma.ts`](../server/src/lib/prisma.ts)

```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

**ทำไมต้อง singleton:** `PrismaClient` มี connection pool ภายใน — สร้างครั้งเดียวแล้ว `import` ใช้ทุกที่
ถ้าสร้างใหม่ทุก request จะ leak connection (ปัญหาคลาสสิก)

### 2.3 ระบบ Login + RBAC — [`lib/auth.ts`](../server/src/lib/auth.ts) + [`routes/auth.ts`](../server/src/routes/auth.ts)

**บันได 3 ขั้น: hash → token → middleware**

#### ขั้นที่ 1: hash รหัสผ่าน
```ts
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);   // 10 = ค่า cost factor
}
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```
**ทำงานยังไง:** bcrypt ทำการ hash + salt ภายในให้เอง — รหัสเดียวกัน hash ออกมาไม่ซ้ำ
(เก็บ hash ลง DB แทน plaintext) ตอนเช็ค ต้องใช้ `bcrypt.compare` (เพราะมี salt) ห้ามเทียบ string ตรง ๆ

#### ขั้นที่ 2: ออก JWT token หลัง login สำเร็จ
```ts
// routes/auth.ts
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  const u = await prisma.user.findUnique({ where: { username: String(username) } });
  if (!u || !(await verifyPassword(String(password), u.passwordHash))) {
    logActivity(req, "LOGIN_FAILED", "username/password ไม่ถูกต้อง", { username });
    return res.status(401).json({ error: "username หรือ password ไม่ถูกต้อง" });
  }
  if (u.status !== "A") {                            // กันบัญชีพ้นสภาพ
    return res.status(403).json({ error: "บัญชีนี้พ้นสภาพแล้ว..." });
  }
  const payload = { id: u.id, username: u.username, displayName: u.displayName, role: u.role };
  res.json({ token: signToken(payload), user: payload });
});
```

```ts
// lib/auth.ts
export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}
```

**JWT คืออะไร:** สตริง 3 ส่วน `header.payload.signature` (คั่นด้วยจุด)
- `header` — algorithm (HS256)
- `payload` — ข้อมูล user (id, username, role) — **อ่านได้** ไม่ได้เข้ารหัส แค่ encode base64
- `signature` — HMAC ของ header+payload + secret → กันการแก้ payload (ถ้าแก้ signature จะไม่ตรง)
- มี `expiresIn: 8h` → ใช้ได้ 8 ชม.

#### ขั้นที่ 3: middleware ตรวจ token ทุก request
```ts
// lib/auth.ts
function readToken(req: Request): AuthPayload | null {
  const h = req.headers.authorization;               // "Bearer <token>"
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET) as AuthPayload;  // ตรวจ signature
  } catch {
    return null;                                     // หมดอายุ/ปลอม
  }
}

export function requireAuth(req, res, next) {
  const u = readToken(req);
  if (!u) return res.status(401).json({ error: "ต้องเข้าสู่ระบบก่อน" });
  req.user = u;                                      // แนบ user เข้ากับ request → route handler ใช้ต่อ
  next();                                            // ผ่านไป handler ถัดไป
}

export function requireRole(...roles: Role[]) {      // ใช้กับ admin-only routes
  return (req, res, next) => {
    const u = readToken(req);
    if (!u) return res.status(401).json({...});
    if (!roles.includes(u.role)) return res.status(403).json({ error: "ไม่มีสิทธิ์..." });
    req.user = u;
    next();
  };
}
```

**สำคัญ:** `req.user` ที่ middleware แนบไว้ → route handler ใช้ดูได้ว่าใครกำลังเรียก (เช่น `performedById: req.user?.id` ตอนสร้าง pm_record)

### 2.4 Activity log แบบไม่ล้มระบบ — [`lib/activity.ts`](../server/src/lib/activity.ts)

```ts
export function logActivity(req, action, detail?, override?) {
  prisma.activityLog.create({
    data: {
      userId: override?.userId ?? req.user?.id ?? null,
      username: override?.username ?? req.user?.username ?? "(unknown)",
      action,                                        // "LOGIN" / "PM_CREATE" / ...
      detail: detail ? detail.slice(0, 400) : null,
      method: req.method,
      path: (req.originalUrl ?? "").slice(0, 200),
      ip: clientIp(req),
    },
  }).catch((e) => console.error("activity log ไม่สำเร็จ:", e?.message ?? e));
}
```

**Pattern: fire-and-forget + catch ภายใน**
- ฟังก์ชัน return `void` (ไม่ใช่ Promise ที่ต้อง await)
- ไม่ใช้ `await` ตอนเรียก → ถ้า log ล้มเหลว ระบบหลักไม่พัง
- `.catch()` ภายในกันเหตุการณ์ unhandled rejection
- ใช้เรียกได้ทุกที่: `logActivity(req, "PM_CREATE", \`SN=\${sn}\`);` แล้วโค้ดวิ่งต่อทันที

### 2.5 สูตรคำนวณรอบ PM — [`lib/pm-logic.ts`](../server/src/lib/pm-logic.ts)

```ts
export function computePm(
  lastPmDate: Date | null,
  commissionDate: Date | null,
  intervalMonths: number,
  today: Date = new Date()
): PmComputation {
  const base = lastPmDate ?? commissionDate;         // ฐานคำนวณ: PM ล่าสุด หรือวันเริ่มใช้งาน
  if (!base) return { status: "NEVER", ... };        // ไม่มีฐาน → NEVER

  const nextDueDate = addMonths(base, intervalMonths);
  const daysUntilDue = Math.round((next - today) / 86_400_000);  // วันที่เหลือ (จำนวนวัน)

  if (daysUntilDue < 0)        status = "OVERDUE";    // เลยกำหนด
  else if (daysUntilDue <= 30) status = "DUE_SOON";   // ใกล้ครบ ≤30 วัน (รวม =0 = ครบวันนี้)
  else                          status = "OK";        // ปกติ

  return { lastPmDate, nextDueDate, status, daysUntilDue };
}
```

**ของสำคัญ:**
- `addMonths` จัดการกรณีสิ้นเดือน (เช่น 31 ม.ค. + 1 เดือน → 28/29 ก.พ.)
- ใช้ **UTC startOfDay** กันปัญหา timezone (เปรียบเทียบเป็น "วัน" ไม่ใช่ "วินาที")
- ฟังก์ชันบริสุทธิ์ (pure) — รับ input คืน output ไม่มี side effect → testable, reuse ได้

### 2.6 Equipment route — CRUD + soft delete + revive

[`server/src/routes/equipment.ts`](../server/src/routes/equipment.ts)

#### GET `/api/equipment?search=&group=&zone=` — ดึงรายการ + กรอง

```ts
equipmentRouter.get("/", async (req, res) => {
  const { search, group, zone } = req.query as Record<string, string | undefined>;
  const items = await prisma.equipment.findMany({
    where: {
      status: { not: "DELETED" },                     // ซ่อนที่ soft-delete แล้ว
      groupCode: group || undefined,                  // ถ้าไม่ส่ง group → ไม่ filter
      zoneCode: zone || undefined,
      ...(search
        ? {
            OR: [                                     // search หลายคอลัมน์พร้อมกัน
              { serialNumber: { contains: search } },
              { equipmentName: { contains: search } },
              { brand: { contains: search } },
              { model: { contains: search } },
            ],
          }
        : {}),
    },
    include: {                                        // join ความสัมพันธ์
      group: true,                                    // ข้อมูลกลุ่ม
      pmRecords: { orderBy: { pmDate: "desc" }, take: 1 },  // PM ล่าสุด 1 แถว
    },
    orderBy: { serialNumber: "asc" },
  });
  // คำนวณสถานะ PM ของแต่ละเครื่องแล้ว map ส่งกลับ
  const result = items.map((e) => {
    const last = e.pmRecords[0]?.pmDate ?? null;
    const pm = computePm(last, e.commissionDate, e.group.pmIntervalMonths);
    return { ...สรุปฟิลด์ที่ต้องการ, pmStatus: pm.status, nextDueDate: pm.nextDueDate };
  });
  res.json(result);
});
```

**Prisma where เรียนรู้:**
- `undefined` = ไม่ใส่เงื่อนไข (Prisma ignore)
- `{ contains: "abc" }` = LIKE '%abc%' ของ SQL
- `OR: [...]` = หลายเงื่อนไขใด ๆ จริงก็ผ่าน (SQL: `col1 LIKE ... OR col2 LIKE ...`)
- `include` = JOIN (Prisma ส่ง JOIN/sub-query ตามเหมาะสม)
- `take: 1 + orderBy: { pmDate: "desc" }` = "เอาแถวเดียวที่ใหม่สุด"

#### POST `/api/equipment` — สร้าง + กู้คืน (revive)
```ts
const existing = await prisma.equipment.findUnique({ where: { serialNumber: b.serialNumber } });
if (existing) {
  if (existing.status !== "DELETED") {
    return res.status(409).json({ error: "SN นี้มีอยู่แล้ว" });
  }
  // SN เคยถูกลบ → กู้คืน (revive) ด้วยข้อมูลใหม่; ประวัติ PM เดิมยังผูกอยู่
  const revived = await prisma.equipment.update({ where: { serialNumber: b.serialNumber }, data });
  return res.status(201).json(revived);
}
// ใหม่จริง ๆ → create
const created = await prisma.equipment.create({ data: { serialNumber: b.serialNumber, ...data } });
```

#### DELETE `/api/equipment/:sn` — soft delete
```ts
const e = await prisma.equipment.update({
  where: { serialNumber: req.params.sn },
  data: { status: "DELETED" },                        // ไม่ลบจริง — แค่เปลี่ยน status
});
```
ประวัติ PM (`pm_record` FK → `equipment.serial_number`) **ไม่ถูกลบ** เพราะแถว equipment ยังอยู่
ทุก endpoint ที่ list/dashboard กรอง `status !== "DELETED"` แล้ว — มองไม่เห็น แต่ FK ไม่หลุด

### 2.7 PM route — บันทึก + checklist snapshot

[`server/src/routes/pm.ts`](../server/src/routes/pm.ts)

#### GET `/api/pm?year=&month=&group=` — ประวัติพร้อมสรุปผล checklist
```ts
const where: any = {};
if (year) {
  const y = Number(year);
  const m = month ? Number(month) : null;
  const start = new Date(Date.UTC(y, m ? m - 1 : 0, 1));
  const end = m ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y + 1, 0, 1));
  where.pmDate = { gte: start, lt: end };             // ช่วงวันที่
}
if (group) where.equipment = { groupCode: group };    // กรองผ่าน relation

const records = await prisma.pmRecord.findMany({
  where,
  include: {
    equipment: { include: { group: true } },          // nested include 2 ชั้น
    performedBy: true,
    checkResults: true,
  },
  orderBy: { pmDate: "desc" },
});
res.json(records.map((r) => ({
  ...สรุปฟิลด์...,
  checkPass: r.checkResults.filter((c) => c.result === "PASS").length,
  checkFail: r.checkResults.filter((c) => c.result === "FAIL").length,
})));
```

**Prisma เรียนรู้:**
- กรองผ่าน relation: `where.equipment = { groupCode: group }` → JOIN + filter อัตโนมัติ
- `include` nested 2 ชั้น: ดึง group ที่อยู่ใน equipment ของ pm_record มาในชั้นเดียว

#### POST `/api/pm` — บันทึก PM + checklist หลายข้อใน transaction เดียว
```ts
const items = await prisma.pmCheckItem.findMany({
  where: { groupCode: eq.groupCode, active: true },   // ดึงรายการตรวจ active ของกลุ่ม
});
const itemMap = new Map(items.map((i) => [i.id, i.label]));  // mapping id → label
const validChecks = (b.checks ?? [])
  .filter((c) => itemMap.has(Number(c.checkItemId)) && RESULTS.includes(c.result))
  .map((c) => ({
    checkItemId: Number(c.checkItemId),
    itemLabel: itemMap.get(Number(c.checkItemId))!,   // ** snapshot label ณ เวลานี้ **
    result: String(c.result),
    note: c.note ? String(c.note).slice(0, 255) : null,
  }));

const created = await prisma.pmRecord.create({
  data: {
    serialNumber: eq.serialNumber,
    pmDate: new Date(b.pmDate),
    cost: b.cost ?? eq.group.costPerPm,               // default = ค่าของกลุ่ม
    performedById: req.user?.id ?? null,              // ผู้ที่ login (จาก JWT middleware)
    checkResults: validChecks.length
      ? { create: validChecks }                        // ** nested create ** — สร้าง pm_record + check_results ใน 1 statement
      : undefined,
  },
});
```

**ของสำคัญ:**
- **Snapshot pattern:** เก็บ `itemLabel` ลง `pm_check_result` ด้วย → แม้รายการตรวจถูกแก้/ลบภายหลัง ประวัติยังอ่านได้
- **Nested create ของ Prisma:** `{ checkResults: { create: [...] } }` → สร้าง parent + child relation ในคำสั่งเดียว (atomic)
- **Whitelist input:** กรอง `b.checks` ให้เหลือเฉพาะ checkItemId ที่อยู่ใน itemMap จริง — กันส่ง id มั่ว

### 2.8 Alert route — คำนวณสถานะอุปกรณ์ทุกชิ้น

[`server/src/routes/alert.ts`](../server/src/routes/alert.ts)

```ts
const items = await prisma.equipment.findMany({
  where: { status: "ACTIVE" },                        // เฉพาะที่ใช้งาน (ตัด DELETED + RETIRED)
  include: { group: true, pmRecords: { orderBy: { pmDate: "desc" }, take: 1 } },
});
const computed = items.map((e) => {
  const last = e.pmRecords[0]?.pmDate ?? null;
  const pm = computePm(last, e.commissionDate, e.group.pmIntervalMonths);
  return { serialNumber: e.serialNumber, pmStatus: pm.status, daysUntilDue: pm.daysUntilDue, ... };
});
const summary = {
  total: computed.length,
  overdue: computed.filter((c) => c.pmStatus === "OVERDUE").length,
  dueSoon: computed.filter((c) => c.pmStatus === "DUE_SOON").length,
  // ...
};
const alerts = computed.filter((c) => c.pmStatus !== "OK").sort((a, b) => a.daysUntilDue - b.daysUntilDue);
const ok = computed.filter((c) => c.pmStatus === "OK").sort(...);
res.json({ summary, alerts, ok });
```

**ไม่มีตาราง "plan/alert" แยก** — คำนวณสด ๆ จาก pm_record + commissionDate + interval → เรียบง่าย ไม่ต้อง maintain

### 2.9 Check items route — CRUD + role guard

[`server/src/routes/check.ts`](../server/src/routes/check.ts) ใช้ `requireRole("ADMIN")` กั้น POST/PUT/DELETE:
```ts
checkRouter.post("/", requireRole("ADMIN"), async (req, res) => { ... });
checkRouter.put("/:id", requireRole("ADMIN"), async (req, res) => { ... });
checkRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => { ... });
// GET ไม่ใส่ requireRole → ทุกคนที่ login ดูได้ (technician ก็ต้องเห็น checklist ตอนบันทึก PM)
```

### 2.10 Report route — สร้าง Excel แบบมีสไตล์

[`server/src/routes/report.ts`](../server/src/routes/report.ts)

**ฟังก์ชันแกน: `sendStyledExcel`** — รับ {title, columns, rows, fileName} แล้ว stream ไฟล์ .xlsx กลับ

```ts
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet(sheetName);

// 1. คำนวณความกว้างคอลัมน์อัตโนมัติ (auto-fit)
const fitWidth = (c) => {
  let max = String(c.header).length;
  for (const row of rows) {                           // วน rows หา content ยาวสุด
    const v = row[c.key];
    if (v != null) max = Math.max(max, String(v).length);
  }
  return Math.min(50, Math.max(c.width ?? 8, 9, Math.ceil(max * 1.2) + 3));
};
ws.columns = columns.map((c) => ({ key: c.key, width: fitWidth(c) }));

// 2. แถวหัวรายงาน — merge ทุกคอลัมน์ ทำ banner เขียวอมฟ้า
ws.mergeCells(r, 1, r, n);
const t = ws.getCell(r, 1);
t.value = title;
t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F8F83" } };
t.font = { bold: true, color: { argb: "FFFFFFFF" } };

// 3. แถวข้อมูล — zebra + numFmt + alignment
rows.forEach((row, idx) => {
  const isTotal = row.no === "" || row.no == null;
  columns.forEach((c, i) => {
    const cell = rr.getCell(i + 1);
    cell.value = row[c.key];
    const bg = isTotal ? "FFDDEDEA" : idx % 2 ? "FFF4F9F8" : "FFFFFFFF";  // zebra
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    if (typeof v === "number") {
      cell.numFmt = "#,##0";                          // ตัวคั่นหลักพัน
      cell.alignment = { horizontal: "right" };        // เลขชิดขวา หลักตรงกัน
    } else {
      cell.alignment = { horizontal: "left", indent: 1 };  // ข้อความชิดซ้ายเว้นขอบ
    }
  });
});

// 4. ตรึงหัวตาราง + ตัวกรองในตัว
ws.views = [{ state: "frozen", ySplit: headRowIdx }];
ws.autoFilter = { from: { row: headRowIdx, column: 1 }, to: {...} };

// 5. stream ออก response
res.setHeader("Content-Type", "application/vnd.openxmlformats-...sheet");
res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
await wb.xlsx.write(res);
```

**Endpoint รายงานเลือกได้ระหว่าง JSON / Excel ผ่าน query `?format=excel`:**
```ts
const isExcel = req.query.format === "excel";
logActivity(req, isExcel ? "REPORT_EXPORT" : "REPORT_VIEW", `...`);
if (isExcel) return sendStyledExcel(res, {...});
res.json({...});                                       // หน้าเว็บใช้ JSON ขึ้นตาราง/Pie
```

---

## 3. Frontend — React + axios + Vite

### 3.1 ตัวเชื่อม Backend — [`web/src/api/client.ts`](../web/src/api/client.ts)

```ts
import axios from 'axios'
export const api = axios.create({ baseURL: '/api' })   // baseURL relative → ผ่าน Vite proxy
export const TOKEN_KEY = 'pm_token'

// 1. แนบ token ทุก request อัตโนมัติ
api.interceptors.request.use((config) => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// 2. token หมดอายุ/ไม่ถูกต้อง → ล้างแล้วเด้งกลับหน้า login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      if (location.pathname !== '/login') location.assign('/login')
    }
    return Promise.reject(err)
  },
)
```

**Interceptor pattern:**
- **Request interceptor** — รันก่อนทุก request → จุดเดียวคุมการแนบ header (ไม่ต้องแนบเองทุกที่)
- **Response interceptor** — รันหลังทุก response → จุดเดียวคุมการ handle error/401

**Type-safe API functions:**
```ts
export interface PmHistoryItem {
  pmId: number; pmDate: string; cost: number; serialNumber: string; ...
  checkPass: number; checkFail: number;
}

export const getPmHistory = (params: { year?: number; month?: number; group?: string }) =>
  api.get<PmHistoryItem[]>('/pm', { params }).then((r) => r.data)
//          ^^^^^^^^^^^^^^^^^^  Type generic บอก axios ว่า response.data เป็น array นี้
//          ↓
// const list = await getPmHistory({ year: 2026 })
// list[0].checkPass    ← TypeScript รู้ type แล้ว auto-complete ได้
```

### 3.2 AuthContext — token persist + restore session — [`web/src/auth/AuthContext.tsx`](../web/src/auth/AuthContext.tsx)

```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // เปิดเว็บมา: ถ้ามี token เดิม → เรียก /api/auth/me ตรวจว่ายังใช้ได้ + ดึง user กลับมา
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) { setLoading(false); return }
    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))   // token หมดอายุ → ล้าง
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const { token, user } = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, token)               // เก็บไว้รอบหน้า
    setUser(user)
  }
  // ...
}
```

**Pattern: Context** = ส่งค่าให้ทุก component ลึก ๆ ในแอป โดยไม่ต้อง prop drilling
- `<AuthProvider>` ครอบทั้งแอปใน `main.tsx`
- ลูกที่ไหนก็ตามเรียก `useAuth()` ได้ → ได้ `{user, loading, login, logout}`

### 3.3 Pattern หน้าเพจตัวอย่าง — Dashboard

```tsx
export default function Dashboard() {
  const [data, setData] = useState<AlertResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('ALL')

  // ฟังก์ชันโหลดข้อมูล — เก็บไว้ใน useCallback กันสร้างใหม่ทุก render
  const load = useCallback(() => {
    setLoading(true)
    getAlerts()
      .then(setData)
      .catch(() => setError('...'))
      .finally(() => setLoading(false))
  }, [])

  // โหลดครั้งแรกตอน mount
  useEffect(load, [load])

  // คำนวณ derived state — แถวที่จะแสดง ขึ้นกับ filter
  const rows = useMemo(() => {
    if (!data) return []
    if (filter === 'ALL') return data.alerts
    if (filter === 'OK') return data.ok
    return data.alerts.filter((a) => a.pmStatus === filter)
  }, [data, filter])                                     // คำนวณใหม่เฉพาะตอน data/filter เปลี่ยน

  return (
    <>
      {/* การ์ดคลิก → setFilter (state update) → React re-render → useMemo คำนวณ rows ใหม่ → Table แสดงข้อมูลใหม่ */}
      <StatCard onClick={() => setFilter('OK')} active={filter === 'OK'} ... />
      <Table dataSource={rows} columns={columns} ... />
    </>
  )
}
```

**Lifecycle ที่เกิดขึ้น:**
1. component mount → `useState` init → `useEffect` รัน → เรียก `load()` → `setData(...)` → re-render
2. ผู้ใช้คลิกการ์ด → `setFilter('OK')` → re-render → `useMemo` คำนวณ rows ใหม่ → Table แสดงข้อมูลใหม่
3. ไม่มีการเรียก backend ซ้ำตอนเปลี่ยน filter — กรองฝั่ง client (data มีอยู่แล้ว) → เร็วและประหยัด

### 3.4 Form pattern (antd Form + Modal) — Equipment

```tsx
const [form] = Form.useForm()
const [editing, setEditing] = useState<EquipmentListItem | null>(null)

function openEdit(rec) {
  setEditing(rec)
  form.setFieldsValue({ ...rec, commissionDate: rec.commissionDate ? dayjs(rec.commissionDate) : null })
  setModalOpen(true)
}

async function handleSubmit() {
  const v = await form.validateFields()                  // validate + คืนค่า; throw ถ้าไม่ผ่าน
  const payload = { ...v, commissionDate: v.commissionDate ? dayjs(v.commissionDate).format('YYYY-MM-DD') : null }
  if (editing) await updateEquipment(editing.serialNumber, payload)
  else         await createEquipment(payload)
  setModalOpen(false)
  load()                                                  // โหลดตารางใหม่
}
```
**ของสำคัญ:** ใช้ตัวแปร `editing` ตัวเดียวคุมโหมด — null = สร้างใหม่, มีค่า = แก้ไข (สลับ POST/PUT)

---

## 4. แนวคิดสำคัญของภาษา/ไลบรารี

### 4.1 async/await

```ts
async function foo() {
  const data = await fetch('/api/x').then(r => r.json())  // หยุดรอ ไม่บล็อก thread อื่น
  return data
}
```
- `async` function จะ return Promise เสมอ
- `await` หยุดรอ Promise ภายในฟังก์ชันนี้ — โค้ดอื่นยังวิ่งได้
- ดักด้วย `try { await ... } catch (e) { ... }` หรือ `.catch(...)` ที่ Promise

### 4.2 TypeScript types

```ts
interface AuthUser { id: number; username: string; role: 'ADMIN' | 'TECHNICIAN' }
function greet(u: AuthUser): string { return `สวัสดี ${u.username}` }
```
- `interface` กำหนดรูปร่างของ object
- `'ADMIN' | 'TECHNICIAN'` = literal union — ค่าเป็นได้แค่ 2 ตัวนี้
- Generic เช่น `Promise<AuthUser>`, `axios.get<T>(url)` → type-safe ปลอดภัย refactor ง่าย

### 4.3 Prisma queries

| ทำอะไร | คำสั่ง |
|--------|--------|
| หา 1 แถวด้วย PK | `findUnique({ where: { id: 1 } })` |
| หาหลายแถว | `findMany({ where, include, orderBy, take })` |
| สร้าง + child relation | `create({ data: { ..., children: { create: [...] } } })` |
| แก้ไข | `update({ where: { id }, data: {...} })` |
| ลบ | `delete({ where: { id } })` (กับเรามักใช้ update เพราะ soft delete) |
| filter LIKE | `{ name: { contains: 'abc' } }` |
| filter ช่วงวันที่ | `{ pmDate: { gte: start, lt: end } }` |
| filter ผ่าน relation | `{ equipment: { groupCode: 'PRINTER' } }` |
| OR หลายเงื่อนไข | `{ OR: [{...}, {...}] }` |
| join + nested | `include: { equipment: { include: { group: true } } }` |
| เรียง + จำกัด | `orderBy: { pmDate: 'desc' }, take: 1` |

### 4.4 Express middleware chain

```
request → cors → json → /api/auth (สาธารณะ) → requireAuth → route handler → response
                                          ↑
                              ถ้า req.user ไม่มี → 401 (ไม่เรียก next())
```
- `next()` = ส่งต่อให้ middleware ถัดไป
- ไม่เรียก `next()` แล้ว `res.status(...).json(...)` = จบ chain ที่นี่ (เช่น 401)
- middleware ระดับ app (`app.use(...)`) มีผลทุก route ที่ตามมา → จัดลำดับสำคัญ

### 4.5 React hooks หลัก

| Hook | ใช้ทำ |
|------|--------|
| `useState(init)` | เก็บ state ที่เปลี่ยนได้ → เปลี่ยน → re-render |
| `useEffect(fn, deps)` | รัน side effect (fetch, subscribe) เมื่อ deps เปลี่ยน · `[]` = รันครั้งเดียวตอน mount |
| `useCallback(fn, deps)` | จำ reference ของฟังก์ชัน → ไม่สร้างใหม่ทุก render (สำคัญตอนใส่ deps ของ useEffect) |
| `useMemo(fn, deps)` | จำผลคำนวณที่หนัก → คำนวณใหม่เฉพาะ deps เปลี่ยน |
| `useContext(Ctx)` | อ่านค่าจาก Context (เช่น `useAuth()`) |

**กฎ:** Hooks ต้องอยู่ใน function component ระดับบนสุด ห้ามใส่ใน if/loop/nested function

### 4.6 JWT (ข้างใน)

`eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiJ9.signature`
1. **header** (base64) — `{"alg":"HS256","typ":"JWT"}`
2. **payload** (base64) — `{"id":1,"username":"admin","role":"ADMIN","exp":...}` — อ่านได้! ห้ามใส่ของลับ
3. **signature** = HMAC_SHA256(`header.payload`, JWT_SECRET) — กันแก้ payload
- ลูกค้าแก้ payload → signature ไม่ตรง → `jwt.verify` throw → middleware ตอบ 401
- token หมดอายุ → `exp` < เวลาปัจจุบัน → throw เช่นกัน

---

## 🎯 สรุป

ระบบนี้ทำงานตาม pattern มาตรฐาน:

- **Backend**: Express middleware chain (cors → json → auth → routes) + Prisma query DB + JWT auth + Activity log fire-and-forget
- **Frontend**: axios + interceptors (token + 401 redirect) + React hooks (useState/useEffect/useMemo) + antd UI
- **Type-safe ทั้งสองฝั่ง**: TypeScript ทั้ง interface ของ API request/response + Prisma generated types

อ่านเอกสารนี้แล้วเปิดไฟล์จริงในโฟลเดอร์ตามที่อ้างอิง → จะเห็นว่าโค้ดทุกที่ใช้ pattern เดิม ๆ ที่อธิบายไว้ข้างต้น
