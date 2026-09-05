import { Router } from "express";
import { prisma } from "../lib/prisma";
import { computePm } from "../lib/pm-logic";

export const alertRouter = Router();

// GET /api/alerts — อุปกรณ์ที่ถึง/เลยรอบ PM + สรุปจำนวนตามสถานะ
alertRouter.get("/", async (_req, res) => {
  const items = await prisma.equipment.findMany({
    where: { status: "ACTIVE" },
    include: { group: true, pmRecords: { orderBy: { pmDate: "desc" }, take: 1 } },
  });

  const computed = items.map((e) => {
    const last = e.pmRecords[0]?.pmDate ?? null;
    const pm = computePm(last, e.commissionDate, e.group.pmIntervalMonths);
    return {
      serialNumber: e.serialNumber,
      equipmentName: e.equipmentName,
      groupCode: e.groupCode,
      groupName: e.group.groupName,
      type: e.type,
      zoneCode: e.zoneCode,
      lastPmDate: pm.lastPmDate,
      nextDueDate: pm.nextDueDate,
      pmStatus: pm.status,
      daysUntilDue: pm.daysUntilDue,
    };
  });

  const summary = {
    total: computed.length,
    overdue: computed.filter((c) => c.pmStatus === "OVERDUE").length,
    dueSoon: computed.filter((c) => c.pmStatus === "DUE_SOON").length,
    never: computed.filter((c) => c.pmStatus === "NEVER").length,
    ok: computed.filter((c) => c.pmStatus === "OK").length,
  };

  const alerts = computed
    .filter((c) => c.pmStatus !== "OK")
    .sort((a, b) => (a.daysUntilDue ?? -99999) - (b.daysUntilDue ?? -99999));

  // เครื่องสถานะ "ปกติ" แยกไว้ ให้ Dashboard กรองดูได้ (ไม่ปนกับรายการแจ้งเตือน)
  const ok = computed
    .filter((c) => c.pmStatus === "OK")
    .sort((a, b) => (a.daysUntilDue ?? 99999) - (b.daysUntilDue ?? 99999));

  res.json({ summary, alerts, ok });
});
