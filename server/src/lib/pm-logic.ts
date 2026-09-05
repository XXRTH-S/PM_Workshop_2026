// สูตรคำนวณรอบ PM ครั้งถัดไป + สถานะแจ้งเตือน (ดู docs/DESIGN.md ข้อ 3)

export type PmStatus = "OVERDUE" | "DUE_SOON" | "OK" | "NEVER";

export const DUE_SOON_DAYS = 30;

/** บวกจำนวนเดือนเข้ากับวันที่ (กันเคสสิ้นเดือน เช่น 31 ม.ค. + 1 เดือน) */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface PmComputation {
  lastPmDate: Date | null;
  nextDueDate: Date | null;
  status: PmStatus;
  daysUntilDue: number | null;
}

/**
 * คำนวณสถานะ PM ของอุปกรณ์ 1 ชิ้น
 * @param lastPmDate วันที่ PM ล่าสุด (null = ยังไม่เคย PM)
 * @param commissionDate วันเริ่มใช้งาน (ใช้เป็นฐานถ้ายังไม่เคย PM)
 * @param intervalMonths รอบ PM ของกลุ่ม (เดือน)
 * @param today วันที่อ้างอิง (default = วันนี้)
 */
export function computePm(
  lastPmDate: Date | null,
  commissionDate: Date | null,
  intervalMonths: number,
  today: Date = new Date()
): PmComputation {
  const base = lastPmDate ?? commissionDate;
  if (!base) {
    return { lastPmDate: null, nextDueDate: null, status: "NEVER", daysUntilDue: null };
  }
  const nextDueDate = addMonths(base, intervalMonths);
  const t0 = startOfUTCDay(today).getTime();
  const due0 = startOfUTCDay(nextDueDate).getTime();
  const daysUntilDue = Math.round((due0 - t0) / 86_400_000);

  let status: PmStatus;
  if (daysUntilDue < 0) status = "OVERDUE";
  else if (daysUntilDue <= DUE_SOON_DAYS) status = "DUE_SOON";
  else status = "OK";

  return { lastPmDate, nextDueDate, status, daysUntilDue };
}
