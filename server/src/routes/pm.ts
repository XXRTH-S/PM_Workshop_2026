import { Router } from "express";
import { prisma } from "../lib/prisma";
import { logActivity } from "../lib/activity";

export const pmRouter = Router();

const RESULTS = ["PASS", "FAIL"] as const;

// GET /api/pm?year=&month=&group=  — ประวัติการ PM (filter ได้) + สรุปผล checklist
pmRouter.get("/", async (req, res) => {
  const { year, month, group } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (year) {
    const y = Number(year);
    const m = month ? Number(month) : null;
    const start = new Date(Date.UTC(y, m ? m - 1 : 0, 1));
    const end = m ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y + 1, 0, 1));
    where.pmDate = { gte: start, lt: end };
  }
  if (group) where.equipment = { groupCode: group };

  const records = await prisma.pmRecord.findMany({
    where,
    include: {
      equipment: { include: { group: true } },
      performedBy: true,
      checkResults: true,
    },
    orderBy: { pmDate: "desc" }, // ล่าสุด → เก่าสุด
  });
  res.json(
    records.map((r) => ({
      pmId: r.pmId,
      pmDate: r.pmDate,
      cost: Number(r.cost),
      technician: r.technician,
      performedBy: r.performedBy?.displayName ?? r.technician ?? "-",
      remark: r.remark,
      serialNumber: r.serialNumber,
      equipmentName: r.equipment.equipmentName,
      groupCode: r.equipment.groupCode,
      groupName: r.equipment.group.groupName,
      type: r.equipment.type,
      zoneCode: r.equipment.zoneCode,
      checkTotal: r.checkResults.length,
      checkPass: r.checkResults.filter((c) => c.result === "PASS").length,
      checkFail: r.checkResults.filter((c) => c.result === "FAIL").length,
    }))
  );
});

// GET /api/pm/:id — รายละเอียด PM 1 ครั้ง + ผลตรวจ checklist
pmRouter.get("/:id", async (req, res) => {
  const r = await prisma.pmRecord.findUnique({
    where: { pmId: Number(req.params.id) },
    include: {
      equipment: { include: { group: true } },
      performedBy: true,
      checkResults: { orderBy: { id: "asc" } },
    },
  });
  if (!r) return res.status(404).json({ error: "ไม่พบรายการ PM" });
  res.json({
    pmId: r.pmId,
    pmDate: r.pmDate,
    cost: Number(r.cost),
    performedBy: r.performedBy?.displayName ?? r.technician ?? "-",
    remark: r.remark,
    serialNumber: r.serialNumber,
    equipmentName: r.equipment.equipmentName,
    groupName: r.equipment.group.groupName,
    type: r.equipment.type,
    checks: r.checkResults.map((c) => ({
      itemLabel: c.itemLabel,
      result: c.result,
      note: c.note,
    })),
  });
});

// POST /api/pm  — บันทึกผล PM (cost อัตโนมัติ) + ผลตรวจ checklist รายข้อ
pmRouter.post("/", async (req, res) => {
  const b = req.body;
  if (!b.serialNumber || !b.pmDate) {
    return res.status(400).json({ error: "ต้องระบุ serialNumber และ pmDate" });
  }
  const eq = await prisma.equipment.findUnique({
    where: { serialNumber: String(b.serialNumber) },
    include: { group: true },
  });
  if (!eq) return res.status(404).json({ error: "ไม่พบอุปกรณ์" });

  // จับคู่ checklist ที่ส่งมา กับรายการตรวจจริงของกลุ่มอุปกรณ์นี้ (กันส่งมั่ว)
  const items = await prisma.pmCheckItem.findMany({
    where: { groupCode: eq.groupCode, active: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i.label]));
  const checks: { checkItemId: number; result: string; note?: string }[] =
    Array.isArray(b.checks) ? b.checks : [];
  const validChecks = checks
    .filter(
      (c) =>
        itemMap.has(Number(c.checkItemId)) &&
        RESULTS.includes(String(c.result) as (typeof RESULTS)[number])
    )
    .map((c) => ({
      checkItemId: Number(c.checkItemId),
      itemLabel: itemMap.get(Number(c.checkItemId))!, // snapshot
      result: String(c.result),
      note: c.note ? String(c.note).slice(0, 255) : null,
    }));

  const created = await prisma.pmRecord.create({
    data: {
      serialNumber: eq.serialNumber,
      pmDate: new Date(b.pmDate),
      cost: b.cost != null ? b.cost : eq.group.costPerPm,
      technician: b.technician ?? null,
      performedById: req.user?.id ?? null, // ผู้ทำ = ผู้ที่ login อยู่
      remark: b.remark ?? null,
      checkResults: validChecks.length
        ? { create: validChecks }
        : undefined,
    },
  });
  const failed = validChecks.filter((c) => c.result === "FAIL").length;
  logActivity(
    req,
    "PM_CREATE",
    `SN=${eq.serialNumber} วันที่=${new Date(b.pmDate)
      .toISOString()
      .slice(0, 10)} pmId=${created.pmId} ตรวจ=${validChecks.length}ข้อ ไม่ผ่าน=${failed}`
  );
  res.status(201).json(created);
});

// DELETE /api/pm/:id
pmRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.pmRecord.delete({ where: { pmId: Number(req.params.id) } });
    logActivity(req, "PM_DELETE", `pmId=${req.params.id}`);
    res.status(204).end();
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "ไม่พบรายการ PM" });
    throw err;
  }
});
