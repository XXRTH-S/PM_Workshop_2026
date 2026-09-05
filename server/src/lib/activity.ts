// บันทึก activity log — เก็บว่าใครทำ action อะไร เมื่อไร (audit)
// ออกแบบให้ "ไม่ล้มระบบ" ถ้า log ไม่สำเร็จ (fire-and-forget + catch ภายใน)
import type { Request } from "express";
import { prisma } from "./prisma";

export type ActivityAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "EQUIPMENT_CREATE"
  | "EQUIPMENT_UPDATE"
  | "EQUIPMENT_DELETE"
  | "PM_CREATE"
  | "PM_DELETE"
  | "REPORT_VIEW"
  | "REPORT_EXPORT"
  | "CHECK_ITEM_CREATE"
  | "CHECK_ITEM_UPDATE"
  | "CHECK_ITEM_DELETE";

function clientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  const ip =
    (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined) ||
    req.socket?.remoteAddress ||
    null;
  return ip ? ip.slice(0, 60) : null;
}

/**
 * บันทึก 1 บรรทัดลงตาราง activity_log
 * @param override สำหรับเคสที่ยังไม่มี req.user (เช่น login สำเร็จ/ล้มเหลว)
 */
export function logActivity(
  req: Request,
  action: ActivityAction,
  detail?: string,
  override?: { userId?: number | null; username?: string; role?: string | null }
): void {
  const u = req.user;
  prisma.activityLog
    .create({
      data: {
        userId: override?.userId ?? u?.id ?? null,
        username: override?.username ?? u?.username ?? "(unknown)",
        role: override?.role ?? u?.role ?? null,
        action,
        detail: detail ? detail.slice(0, 400) : null,
        method: req.method,
        path: (req.originalUrl ?? req.url ?? "").slice(0, 200),
        ip: clientIp(req),
      },
    })
    .catch((e) =>
      console.error("activity log ไม่สำเร็จ:", e?.message ?? e)
    );
}
