import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { addMonths } from "../lib/pm-logic";
import { logActivity } from "../lib/activity";

export const reportRouter = Router();

// ── วันที่รูปแบบ D/M/YYYY (ไม่เติม 0 ข้างหน้า) ตามไฟล์ตัวอย่าง; null/undefined = ว่าง ──
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getUTCDate()}/${x.getUTCMonth() + 1}/${x.getUTCFullYear()}`;
}

const THAI_MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface ReportColumn {
  header: string;
  key: string;
  width?: number;
}

// ── โทนสีให้ตรงธีมเว็บ Teal/Sage (ARGB = AARRGGBB) ──
const C = {
  titleBg: "FF2F8F83", // หัวรายงาน — เขียวอมฟ้าหลัก (= colorPrimary เว็บ)
  titleFg: "FFFFFFFF",
  subBg: "FFEAF3F1", // แถบช่วงวันที่ — เขียวอ่อน
  headBg: "FF207067", // หัวคอลัมน์ — เขียวเข้ม
  headFg: "FFFFFFFF",
  zebra: "FFF4F9F8", // แถวสลับ — เขียวจาง
  total: "FFDDEDEA", // แถวสรุปรวม
  border: "FFD8E4E1", // เส้นตาราง — เทาอมเขียว
};
const FONT = "Tahoma"; // ฟอนต์ที่อ่านภาษาไทยชัดใน Excel
const THIN = { style: "thin" as const, color: { argb: C.border } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** สร้าง .xlsx ธีม Teal/Sage (หัวเขียวอมฟ้า + zebra + freeze + filter)
 *  — คงโครงสร้าง/คอลัมน์/รูปแบบวันที่เดิมตามไฟล์ตัวอย่าง ปรับแค่หน้าตา */
async function sendStyledExcel(
  res: any,
  opts: {
    sheetName: string;
    title: string;
    subtitle?: string;
    columns: ReportColumn[];
    rows: Record<string, any>[];
    fileName: string;
  }
) {
  const { sheetName, title, subtitle, columns, rows, fileName } = opts;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  const n = columns.length;

  // ปรับความกว้างคอลัมน์อัตโนมัติให้พอดีเนื้อหา (กันข้อความ/หัวตารางโดนตัด)
  // ไทยกว้างกว่าอังกฤษ → คูณ factor + เผื่อ padding; ไม่แคบกว่าค่าที่ตั้งไว้
  const fitWidth = (c: ReportColumn) => {
    let max = String(c.header).length;
    for (const row of rows) {
      const v = row[c.key];
      if (v == null) continue;
      const len = String(v).length;
      if (len > max) max = len;
    }
    const w = Math.ceil(max * 1.2) + 3;
    return Math.min(50, Math.max(c.width ?? 8, 9, w));
  };
  ws.columns = columns.map((c) => ({ key: c.key, width: fitWidth(c) }));

  let r = 1;

  // แถวชื่อรายงาน — แบนเนอร์เขียวอมฟ้า ตัวอักษรขาว (= หัวเว็บ)
  ws.mergeCells(r, 1, r, n);
  const t = ws.getCell(r, 1);
  t.value = title;
  t.font = { name: FONT, bold: true, size: 15, color: { argb: C.titleFg } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.titleBg } };
  ws.getRow(r).height = 30;
  r++;

  // แถวรายละเอียดช่วง (เช่น ตั้งแต่..ถึง..) ถ้ามี
  if (subtitle) {
    ws.mergeCells(r, 1, r, n);
    const s = ws.getCell(r, 1);
    s.value = subtitle;
    s.font = { name: FONT, bold: true, color: { argb: "FF1F4E47" } };
    s.alignment = { horizontal: "center", vertical: "middle" };
    s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.subBg } };
    ws.getRow(r).height = 20;
    r++;
  }

  // แถวหัวคอลัมน์ — แถบเขียวเข้ม ตัวอักษรขาว
  const headRowIdx = r;
  const head = ws.getRow(r);
  head.height = 26;
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, bold: true, color: { argb: C.headFg } };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headBg } };
    cell.border = BORDER;
  });
  r++;

  // ข้อมูล — แถวสลับสีจาง + แถวสรุปรวม (no ว่าง) เน้นหนา
  rows.forEach((row, idx) => {
    const isTotal = row.no === "" || row.no == null;
    const rr = ws.getRow(r);
    rr.height = isTotal ? 20 : 19; // เพิ่มระยะหายใจให้อ่านง่าย
    columns.forEach((c, i) => {
      const cell = rr.getCell(i + 1);
      const v = row[c.key];
      cell.value = v == null ? "" : v;
      cell.border = BORDER;
      cell.font = { name: FONT, bold: isTotal };
      const bg = isTotal ? C.total : idx % 2 ? C.zebra : "FFFFFFFF";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      if (c.key === "no") {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (typeof v === "number") {
        // ตัวเลข: ใส่ตัวคั่นหลักพัน + ชิดขวาให้หลักตรงกัน อ่านเงินง่าย
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      }
    });
    r++;
  });

  // ตรึงหัวตาราง + ตัวกรองอัตโนมัติ ให้ใช้งานต่อในไฟล์สะดวก
  ws.views = [{ state: "frozen", ySplit: headRowIdx }];
  if (rows.length) {
    ws.autoFilter = {
      from: { row: headRowIdx, column: 1 },
      to: { row: headRowIdx + rows.length, column: n },
    };
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ──────────────────────────────────────────────────────────────
// 1) แผน PM ตามแผนประจำเดือน/ปี — GET /api/reports/plan?year=&month=&format=excel
//    คอลัมน์ตามไฟล์ ReportExample: No, PM Plan Date, วันที่ PM อุปกรณ์,
//    กลุ่มอุปกรณ์, ชนิด, SN, BRAND, MODEL, ชื่อของอุปกรณ์
// ──────────────────────────────────────────────────────────────
reportRouter.get("/plan", async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;

  const periodStart = new Date(Date.UTC(year, month ? month - 1 : 0, 1));
  const periodEnd = month
    ? new Date(Date.UTC(year, month, 1))
    : new Date(Date.UTC(year + 1, 0, 1));

  const items = await prisma.equipment.findMany({
    where: { status: "ACTIVE" },
    include: { group: true, pmRecords: { orderBy: { pmDate: "asc" } } },
    orderBy: { serialNumber: "asc" },
  });

  type Plan = {
    plannedDate: Date;
    actualDate: Date | null;
    e: (typeof items)[number];
  };
  const plans: Plan[] = [];

  for (const e of items) {
    const interval = e.group.pmIntervalMonths;
    if (!interval || interval <= 0) continue;

    const pmDates = e.pmRecords.map((p) => new Date(p.pmDate));
    // ฐานเริ่มคำนวณ = PM ครั้งล่าสุดก่อนช่วงรายงาน, ถ้าไม่มีใช้วันเริ่มใช้งาน
    let base: Date | null =
      [...pmDates].reverse().find((d) => d < periodStart) ??
      (e.commissionDate ? new Date(e.commissionDate) : null);
    if (!base) continue; // ไม่มีฐาน → วางแผนไม่ได้ (ข้าม)

    const usedActual = new Set<number>();
    let guard = 0;
    let planned = addMonths(base, interval);
    while (planned < periodEnd && guard++ < 120) {
      if (planned >= periodStart) {
        // วันที่ทำจริงของรอบนี้ = PM ในช่วงรายงานที่ยังไม่ถูกจับคู่
        const actual =
          e.pmRecords.find(
            (p) =>
              !usedActual.has(p.pmId) &&
              new Date(p.pmDate) >= periodStart &&
              new Date(p.pmDate) < periodEnd &&
              new Date(p.pmDate) >= (base as Date)
          ) ?? null;
        if (actual) usedActual.add(actual.pmId);
        plans.push({
          plannedDate: planned,
          actualDate: actual ? new Date(actual.pmDate) : null,
          e,
        });
        base = actual ? new Date(actual.pmDate) : planned;
      } else {
        base = planned;
      }
      planned = addMonths(base, interval);
    }
  }

  plans.sort((a, b) => +a.plannedDate - +b.plannedDate);

  const rows = plans.map((p, i) => ({
    no: i + 1,
    planDate: fmtDate(p.plannedDate),
    pmDate: fmtDate(p.actualDate),
    groupCode: p.e.groupCode,
    type: p.e.type,
    serialNumber: p.e.serialNumber,
    brand: p.e.brand,
    model: p.e.model,
    equipmentName: p.e.equipmentName,
  }));

  const periodLabel = month
    ? `ประจำเดือน ${THAI_MON[month - 1]}-${year}`
    : `ประจำปี ${year}`;
  const title = `รายงานการ PM ตามแผน${periodLabel}`;

  const columns: ReportColumn[] = [
    { header: "No", key: "no", width: 6 },
    { header: "PM Plan Date", key: "planDate", width: 14 },
    { header: "วันที่ PM อุปกรณ์", key: "pmDate", width: 16 },
    { header: "กลุ่มอุปกรณ์", key: "groupCode", width: 14 },
    { header: "ชนิด", key: "type", width: 12 },
    { header: "SN อุปกรณ์", key: "serialNumber", width: 26 },
    { header: "BRAND", key: "brand", width: 10 },
    { header: "MODEL", key: "model", width: 12 },
    { header: "ชื่อของอุปกรณ์", key: "equipmentName", width: 24 },
  ];

  const isExcel = req.query.format === "excel";
  logActivity(
    req,
    isExcel ? "REPORT_EXPORT" : "REPORT_VIEW",
    `แผน PM ปี=${year}${month ? " เดือน=" + month : ""}`
  );
  if (isExcel) {
    return sendStyledExcel(res, {
      sheetName: "แผน PM",
      title,
      columns,
      rows,
      fileName: `PM-Plan-${year}${month ? "-" + month : ""}.xlsx`,
    });
  }
  res.json({ title, year, month, count: rows.length, rows });
});

// ──────────────────────────────────────────────────────────────
// 2) ประวัติ PM รายเครื่อง + ช่วงวันที่ — GET /api/reports/equipment-history
//    ?serialNumber=&from=YYYY-MM-DD&to=YYYY-MM-DD&format=excel
//    คอลัมน์ตามไฟล์ QueryReportExample: No, วันที่ PM อุปกรณ์, ผู้ดำเนินการ
// ──────────────────────────────────────────────────────────────
reportRouter.get("/equipment-history", async (req, res) => {
  const serialNumber = req.query.serialNumber
    ? String(req.query.serialNumber)
    : "";
  if (!serialNumber) {
    return res.status(400).json({ error: "ต้องระบุ serialNumber" });
  }
  const eq = await prisma.equipment.findUnique({
    where: { serialNumber },
  });
  if (!eq) return res.status(404).json({ error: "ไม่พบอุปกรณ์" });

  const from = req.query.from
    ? new Date(`${req.query.from}T00:00:00.000Z`)
    : new Date(Date.UTC(1970, 0, 1));
  const to = req.query.to
    ? new Date(`${req.query.to}T23:59:59.999Z`)
    : new Date(Date.UTC(2999, 11, 31));

  const records = await prisma.pmRecord.findMany({
    where: { serialNumber, pmDate: { gte: from, lte: to } },
    include: { performedBy: true },
    orderBy: { pmDate: "asc" },
  });

  const rows = records.map((p, i) => ({
    no: i + 1,
    pmDate: fmtDate(p.pmDate),
    technician: p.performedBy?.displayName ?? p.technician ?? "",
  }));

  const title = `รายงานประวัติการ PM ของอุปกรณ์ ${eq.equipmentName}`;
  const subtitle =
    req.query.from || req.query.to
      ? `ตั้งแต่: ${fmtDate(from)} ถึง ${fmtDate(to)}`
      : undefined;

  const columns: ReportColumn[] = [
    { header: "No", key: "no", width: 6 },
    { header: "วันที่ PM อุปกรณ์", key: "pmDate", width: 18 },
    { header: "ผู้ดำเนินการ", key: "technician", width: 22 },
  ];

  const isExcel = req.query.format === "excel";
  logActivity(
    req,
    isExcel ? "REPORT_EXPORT" : "REPORT_VIEW",
    `ประวัติ PM รายเครื่อง SN=${eq.serialNumber}`
  );
  if (isExcel) {
    return sendStyledExcel(res, {
      sheetName: "ประวัติ PM",
      title,
      subtitle,
      columns,
      rows,
      fileName: `PM-History-${eq.serialNumber}.xlsx`,
    });
  }
  res.json({
    title,
    subtitle,
    equipment: {
      serialNumber: eq.serialNumber,
      equipmentName: eq.equipmentName,
    },
    count: rows.length,
    rows,
  });
});

// ──────────────────────────────────────────────────────────────
// 3) ค่าใช้จ่าย PM รายเดือน/ปี — GET /api/reports/cost?year=&month=&format=excel
// ──────────────────────────────────────────────────────────────
reportRouter.get("/cost", async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const records = await prisma.pmRecord.findMany({
    where: {
      pmDate: {
        gte: new Date(Date.UTC(year, month ? month - 1 : 0, 1)),
        lt: month
          ? new Date(Date.UTC(year, month, 1))
          : new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    include: { equipment: { include: { group: true } } },
  });

  const byGroup = new Map<
    string,
    { groupName: string; count: number; totalCost: number }
  >();
  for (const r of records) {
    const g = byGroup.get(r.equipment.groupCode) ?? {
      groupName: r.equipment.group.groupName,
      count: 0,
      totalCost: 0,
    };
    g.count += 1;
    g.totalCost += Number(r.cost);
    byGroup.set(r.equipment.groupCode, g);
  }
  const rows = [...byGroup.entries()].map(([groupCode, v]) => ({
    groupCode,
    groupName: v.groupName,
    count: v.count,
    totalCost: v.totalCost,
  }));
  const grandTotal = rows.reduce((s, r) => s + r.totalCost, 0);

  const periodLabel = month ? `ประจำเดือน ${THAI_MON[month - 1]}-${year}` : `ประจำปี ${year}`;

  const isExcel = req.query.format === "excel";
  logActivity(
    req,
    isExcel ? "REPORT_EXPORT" : "REPORT_VIEW",
    `ค่าใช้จ่าย PM ปี=${year}${month ? " เดือน=" + month : ""}`
  );
  if (isExcel) {
    const excelRows = rows.map((r, i) => ({ no: i + 1, ...r }));
    excelRows.push({
      no: "" as any,
      groupCode: "",
      groupName: "รวมทั้งหมด",
      count: rows.reduce((s, r) => s + r.count, 0),
      totalCost: grandTotal,
    });
    return sendStyledExcel(res, {
      sheetName: "ค่าใช้จ่าย PM",
      title: `รายงานค่าใช้จ่ายในการ PM ${periodLabel}`,
      columns: [
        { header: "No", key: "no", width: 6 },
        { header: "กลุ่มอุปกรณ์", key: "groupName", width: 20 },
        { header: "จำนวนครั้ง", key: "count", width: 14 },
        { header: "รวมค่าใช้จ่าย (บาท)", key: "totalCost", width: 22 },
      ],
      rows: excelRows,
      fileName: `PM-Cost-${year}${month ? "-" + month : ""}.xlsx`,
    });
  }
  res.json({ year, month, rows, grandTotal });
});
