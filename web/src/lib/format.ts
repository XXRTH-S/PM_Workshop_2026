import dayjs from 'dayjs'
import type { PmStatus } from '../api/client'

/** แปลงวันที่ ISO เป็น DD/MM/YYYY (ปี ค.ศ. ให้ตรงกับไฟล์ Excel จาก backend) */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = dayjs(iso)
  return d.isValid() ? d.format('DD/MM/YYYY') : '-'
}

export interface StatusMeta {
  color: string
  label: string
}

const STATUS_META: Record<PmStatus, StatusMeta> = {
  OVERDUE: { color: 'red', label: 'เลยกำหนด' },
  DUE_SOON: { color: 'gold', label: 'ใกล้ครบรอบ' },
  OK: { color: 'green', label: 'ปกติ' },
  NEVER: { color: 'default', label: 'ยังไม่เคย PM' },
}

export function statusMeta(status: PmStatus): StatusMeta {
  return STATUS_META[status] ?? { color: 'default', label: status }
}

/** สีกลางโทน Teal/Sage (ใช้กับตัวเลขสรุป/ไอคอน — สบายตา ไม่สดจัด)
 *  คุมที่จุดเดียว แก้ที่นี่ที่เดียวเปลี่ยนทั้งระบบ */
export const STATUS_COLORS = {
  primary: '#2F8F83',
  overdue: '#C05A52',
  dueSoon: '#C9952F',
  ok: '#4F9D69',
  neutral: '#7C8C88',
} as const

/** จานสีสำหรับกราฟ (pie ฯลฯ) — โทนเดียวกับธีม วนซ้ำถ้าเกิน */
export const CHART_COLORS = [
  '#2F8F83',
  '#4F9D69',
  '#C9952F',
  '#5B8AA6',
  '#C05A52',
  '#7C8C88',
]

/** ข้อความสรุปจำนวนวัน (+ เหลือ / - เลย) */
export function daysText(days: number | null): string {
  if (days == null) return '-'
  if (days < 0) return `เลยมาแล้ว ${Math.abs(days)} วัน`
  if (days === 0) return 'ครบกำหนดวันนี้'
  return `อีก ${days} วัน`
}

export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]
