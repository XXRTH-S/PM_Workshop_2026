import { Router } from "express";
import { prisma } from "../lib/prisma";
import { computePm } from "../lib/pm-logic";
import { logActivity } from "../lib/activity";

export const equipmentRouter = Router();

// GET /api/equipment?search=&group=&zone=  — รายการอุปกรณ์ + สถานะ PM
equipmentRouter.get("/", async (req, res) => {
  const { search, group, zone } = req.query as Record<string, string | undefined>;
  const items = await prisma.equipment.findMany({
    where: {
      status: { not: "DELETED" }, // ซ่อนอุปกรณ์ที่ถูกลบ (soft delete)
      groupCode: group || undefined,
      zoneCode: zone || undefined,
      ...(search
        ? {
            OR: [
              { serialNumber: { contains: search } },
              { equipmentName: { contains: search } },
              { brand: { contains: search } },
              { model: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      group: true,
      pmRecords: { orderBy: { pmDate: "desc" }, take: 1 },
    },
    orderBy: { serialNumber: "asc" },
  });

  const result = items.map((e) => {
    const last = e.pmRecords[0]?.pmDate ?? null;
    const pm = computePm(last, e.commissionDate, e.group.pmIntervalMonths);
    return {
      serialNumber: e.serialNumber,
      groupCode: e.groupCode,
      groupName: e.group.groupName,
      type: e.type,
      brand: e.brand,
      model: e.model,
      equipmentName: e.equipmentName,
      zoneCode: e.zoneCode,
      status: e.status,
      commissionDate: e.commissionDate,
      lastPmDate: pm.lastPmDate,
      nextDueDate: pm.nextDueDate,
      pmStatus: pm.status,
      daysUntilDue: pm.daysUntilDue,
    };
  });
  res.json(result);
});

// GET /api/equipment/:sn
equipmentRouter.get("/:sn", async (req, res) => {
  const e = await prisma.equipment.findUnique({
    where: { serialNumber: req.params.sn },
    include: { group: true, pmRecords: { orderBy: { pmDate: "desc" } } },
  });
  if (!e) return res.status(404).json({ error: "ไม่พบอุปกรณ์" });
  res.json(e);
});

// POST /api/equipment
equipmentRouter.post("/", async (req, res) => {
  const b = req.body;
  if (!b.groupCode || !b.type || !b.serialNumber || !b.equipmentName) {
    return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ (groupCode, type, serialNumber, equipmentName)" });
  }
  const data = {
    groupCode: b.groupCode,
    type: b.type,
    brand: b.brand ?? "",
    model: b.model ?? "",
    equipmentName: b.equipmentName,
    zoneCode: b.zoneCode ?? "",
    status: b.status ?? "ACTIVE",
    commissionDate: b.commissionDate ? new Date(b.commissionDate) : null,
  };

  // ถ้า SN นี้เคยถูกลบ (soft delete) → กู้คืนด้วยข้อมูลใหม่
  // ประวัติ PM เดิมผูกกับ SN จึงกลับมาแสดงพร้อมเครื่อง
  const existing = await prisma.equipment.findUnique({
    where: { serialNumber: b.serialNumber },
  });
  if (existing) {
    if (existing.status !== "DELETED") {
      return res.status(409).json({ error: "SN นี้มีอยู่แล้ว" });
    }
    const revived = await prisma.equipment.update({
      where: { serialNumber: b.serialNumber },
      data,
    });
    logActivity(
      req,
      "EQUIPMENT_CREATE",
      `กู้คืน SN=${revived.serialNumber} (${revived.equipmentName}) — ประวัติ PM เดิมยังอยู่`
    );
    return res.status(201).json(revived);
  }

  try {
    const created = await prisma.equipment.create({
      data: { serialNumber: b.serialNumber, ...data },
    });
    logActivity(req, "EQUIPMENT_CREATE", `SN=${created.serialNumber} (${created.equipmentName})`);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "SN นี้มีอยู่แล้ว" });
    throw err;
  }
});

// PUT /api/equipment/:sn  — แก้ไขได้ทุกฟิลด์ ยกเว้น serialNumber (เป็น PK ห้ามเปลี่ยน)
equipmentRouter.put("/:sn", async (req, res) => {
  const b = req.body;
  try {
    const updated = await prisma.equipment.update({
      where: { serialNumber: req.params.sn },
      data: {
        groupCode: b.groupCode,
        type: b.type,
        brand: b.brand,
        model: b.model,
        equipmentName: b.equipmentName,
        zoneCode: b.zoneCode,
        status: b.status,
        commissionDate: b.commissionDate ? new Date(b.commissionDate) : null,
      },
    });
    logActivity(req, "EQUIPMENT_UPDATE", `SN=${updated.serialNumber} (${updated.equipmentName})`);
    res.json(updated);
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "ไม่พบอุปกรณ์" });
    throw err;
  }
});

// DELETE /api/equipment/:sn
// soft delete — ตั้ง status = "DELETED" ซ่อนจากรายการ แต่ไม่ลบแถวจริง
// เพื่อรักษา FK pm_record.serial_number → ประวัติ PM เดิมยังดูได้
// (หลักเดียวกับ soft-delete ของ app_user status X)
equipmentRouter.delete("/:sn", async (req, res) => {
  try {
    const e = await prisma.equipment.update({
      where: { serialNumber: req.params.sn },
      data: { status: "DELETED" },
    });
    logActivity(
      req,
      "EQUIPMENT_DELETE",
      `SN=${req.params.sn} (soft delete — เก็บประวัติ PM ไว้)`
    );
    res.json({ ok: true, serialNumber: e.serialNumber });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "ไม่พบอุปกรณ์" });
    throw err;
  }
});
