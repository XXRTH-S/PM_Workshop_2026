import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../lib/auth";
import { logActivity } from "../lib/activity";

export const checkRouter = Router();

// GET /api/check-items?group=&all=1
//  - ปกติคืนเฉพาะรายการที่ active (ใช้ตอนบันทึก PM)
//  - all=1 คืนทั้งหมด (สำหรับหน้าจัดการของ admin)
checkRouter.get("/", async (req, res) => {
  const { group, all } = req.query as Record<string, string | undefined>;
  const items = await prisma.pmCheckItem.findMany({
    where: {
      groupCode: group || undefined,
      ...(all === "1" ? {} : { active: true }),
    },
    orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  res.json(items);
});

// POST /api/check-items  (ADMIN เท่านั้น)
checkRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const b = req.body ?? {};
  if (!b.groupCode || !b.label) {
    return res.status(400).json({ error: "ต้องระบุ groupCode และ label" });
  }
  try {
    const created = await prisma.pmCheckItem.create({
      data: {
        groupCode: b.groupCode,
        label: String(b.label).trim(),
        category: b.category ?? "OTHER",
        sortOrder: b.sortOrder ?? 0,
        active: b.active ?? true,
      },
    });
    logActivity(req, "CHECK_ITEM_CREATE", `${created.groupCode}: ${created.label}`);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "รายการนี้มีอยู่แล้วในกลุ่มนี้" });
    throw err;
  }
});

// PUT /api/check-items/:id  (ADMIN เท่านั้น)
checkRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const b = req.body ?? {};
  try {
    const updated = await prisma.pmCheckItem.update({
      where: { id: Number(req.params.id) },
      data: {
        label: b.label != null ? String(b.label).trim() : undefined,
        category: b.category ?? undefined,
        sortOrder: b.sortOrder ?? undefined,
        active: b.active ?? undefined,
      },
    });
    logActivity(req, "CHECK_ITEM_UPDATE", `#${updated.id} ${updated.label}`);
    res.json(updated);
  } catch (err: any) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "ไม่พบรายการตรวจ" });
    if (err.code === "P2002")
      return res.status(409).json({ error: "รายการนี้มีอยู่แล้วในกลุ่มนี้" });
    throw err;
  }
});

// DELETE /api/check-items/:id  (ADMIN เท่านั้น)
// ลบได้ — ผลตรวจเก่าใน pm_check_result ยังอ่านได้ (เก็บ snapshot item_label, FK SetNull)
checkRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.pmCheckItem.delete({ where: { id: Number(req.params.id) } });
    logActivity(req, "CHECK_ITEM_DELETE", `#${req.params.id}`);
    res.status(204).end();
  } catch (err: any) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "ไม่พบรายการตรวจ" });
    throw err;
  }
});
