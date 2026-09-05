// ตัวเชื่อม backend — ใช้ Vite proxy ส่ง /api ไป Express :4000 (ดู vite.config.ts)
import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

export const TOKEN_KEY = 'pm_token'

// แนบ token ทุก request (ถ้ามี)
api.interceptors.request.use((config) => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// token หมดอายุ/ไม่ถูกต้อง → ล้างแล้วเด้งกลับหน้า login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (
      err?.response?.status === 401 &&
      !String(err.config?.url ?? '').includes('/auth/login')
    ) {
      localStorage.removeItem(TOKEN_KEY)
      if (location.pathname !== '/login') location.assign('/login')
    }
    return Promise.reject(err)
  },
)

// ───────── Types (ตรงกับ response ของ backend) ─────────

export type PmStatus = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NEVER'

export type Role = 'ADMIN' | 'TECHNICIAN'

export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: Role
}

export const login = (username: string, password: string) =>
  api
    .post<{ token: string; user: AuthUser }>('/auth/login', {
      username,
      password,
    })
    .then((r) => r.data)

export const fetchMe = () =>
  api.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user)

// แจ้ง backend ให้บันทึก log ออกจากระบบ (best-effort — ไม่ throw)
export const apiLogout = () =>
  api.post('/auth/logout').catch(() => undefined)

export interface EquipmentGroup {
  groupCode: string
  groupName: string
  pmIntervalMonths: number
  costPerPm: number
}

/** รายการอุปกรณ์พร้อมสถานะ PM ที่คำนวณจาก backend */
export interface EquipmentListItem {
  groupCode: string
  groupName: string
  type: string
  serialNumber: string
  brand: string
  model: string
  equipmentName: string
  zoneCode: string
  status: string
  commissionDate: string | null
  lastPmDate: string | null
  nextDueDate: string | null
  pmStatus: PmStatus
  daysUntilDue: number | null
}

export interface EquipmentInput {
  groupCode: string
  type: string
  serialNumber: string
  brand?: string
  model?: string
  equipmentName: string
  zoneCode?: string
  status?: string
  commissionDate?: string | null
}

export interface PmHistoryItem {
  pmId: number
  pmDate: string
  cost: number
  technician: string | null
  performedBy: string
  remark: string | null
  serialNumber: string
  equipmentName: string
  groupCode: string
  groupName: string
  type: string
  zoneCode: string
  checkTotal: number
  checkPass: number
  checkFail: number
}

// รายการตรวจ PM (master) — แยกตามกลุ่มอุปกรณ์
export interface CheckItem {
  id: number
  groupCode: string
  label: string
  category: string // HARDWARE / SOFTWARE / OTHER
  sortOrder: number
  active: boolean
}

export type CheckResultValue = 'PASS' | 'FAIL'

export interface CheckResultInput {
  checkItemId: number
  result: CheckResultValue
  note?: string
}

// รายละเอียด PM 1 ครั้ง + ผลตรวจ checklist
export interface PmDetail {
  pmId: number
  pmDate: string
  cost: number
  performedBy: string
  remark: string | null
  serialNumber: string
  equipmentName: string
  groupName: string
  type: string
  checks: { itemLabel: string; result: CheckResultValue; note: string | null }[]
}

export interface AlertItem {
  serialNumber: string
  equipmentName: string
  groupCode: string
  groupName: string
  type: string
  zoneCode: string
  lastPmDate: string | null
  nextDueDate: string | null
  pmStatus: PmStatus
  daysUntilDue: number | null
}

export interface AlertResponse {
  summary: {
    total: number
    overdue: number
    dueSoon: number
    never: number
    ok: number
  }
  alerts: AlertItem[]
  /** เครื่องสถานะ "ปกติ" (แยกจาก alerts — ให้ Dashboard กรองดูได้) */
  ok: AlertItem[]
}

// แผน PM ตามแผนรายเดือน/ปี (ตรงกับไฟล์ ReportExample)
export interface PlanRow {
  no: number
  planDate: string // PM Plan Date (วันที่ตามแผน)
  pmDate: string // วันที่ PM อุปกรณ์ (ทำจริง — ว่างถ้ายังไม่ทำ)
  groupCode: string
  type: string
  serialNumber: string
  brand: string
  model: string
  equipmentName: string
}

// ประวัติ PM รายเครื่อง (ตรงกับไฟล์ QueryReportExample)
export interface EquipmentHistoryRow {
  no: number
  pmDate: string
  technician: string
}

export interface CostRow {
  groupCode: string
  groupName: string
  count: number
  totalCost: number
}

// ───────── API calls ─────────

export const getGroups = () =>
  api.get<EquipmentGroup[]>('/groups').then((r) => r.data)

export const getEquipment = (params: {
  search?: string
  group?: string
  zone?: string
}) => api.get<EquipmentListItem[]>('/equipment', { params }).then((r) => r.data)

export const createEquipment = (data: EquipmentInput) =>
  api.post('/equipment', data).then((r) => r.data)

export const updateEquipment = (serialNumber: string, data: EquipmentInput) =>
  api
    .put(`/equipment/${encodeURIComponent(serialNumber)}`, data)
    .then((r) => r.data)

export const deleteEquipment = (serialNumber: string) =>
  api
    .delete(`/equipment/${encodeURIComponent(serialNumber)}`)
    .then((r) => r.data)

export const getPmHistory = (params: {
  year?: number
  month?: number
  group?: string
}) => api.get<PmHistoryItem[]>('/pm', { params }).then((r) => r.data)

export const createPm = (data: {
  serialNumber: string
  pmDate: string
  cost?: number
  technician?: string
  remark?: string
  checks?: CheckResultInput[]
}) => api.post('/pm', data).then((r) => r.data)

export const deletePm = (id: number) =>
  api.delete(`/pm/${id}`).then((r) => r.data)

export const getPmDetail = (id: number) =>
  api.get<PmDetail>(`/pm/${id}`).then((r) => r.data)

// ───────── รายการตรวจ PM (checklist) ─────────

export const getCheckItems = (params: { group?: string; all?: boolean }) =>
  api
    .get<CheckItem[]>('/check-items', {
      params: { group: params.group, all: params.all ? 1 : undefined },
    })
    .then((r) => r.data)

export const createCheckItem = (data: {
  groupCode: string
  label: string
  category?: string
  sortOrder?: number
  active?: boolean
}) => api.post('/check-items', data).then((r) => r.data)

export const updateCheckItem = (
  id: number,
  data: Partial<{
    label: string
    category: string
    sortOrder: number
    active: boolean
  }>,
) => api.put(`/check-items/${id}`, data).then((r) => r.data)

export const deleteCheckItem = (id: number) =>
  api.delete(`/check-items/${id}`).then((r) => r.data)

export const getAlerts = () =>
  api.get<AlertResponse>('/alerts').then((r) => r.data)

export const getPlanReport = (params: { year?: number; month?: number }) =>
  api
    .get<{
      title: string
      year: number
      month: number | null
      count: number
      rows: PlanRow[]
    }>('/reports/plan', { params })
    .then((r) => r.data)

export const getEquipmentHistoryReport = (params: {
  serialNumber: string
  from?: string
  to?: string
}) =>
  api
    .get<{
      title: string
      subtitle?: string
      equipment: {
        serialNumber: string
        equipmentName: string
      }
      count: number
      rows: EquipmentHistoryRow[]
    }>('/reports/equipment-history', { params })
    .then((r) => r.data)

export const getCostReport = (params: { year?: number; month?: number }) =>
  api
    .get<{
      year: number
      month: number | null
      rows: CostRow[]
      grandTotal: number
    }>('/reports/cost', { params })
    .then((r) => r.data)

/** ดาวน์โหลดไฟล์ Excel จาก endpoint รายงาน (format=excel) */
export async function downloadExcel(
  path: string,
  params: Record<string, string | number | undefined>,
  fileName: string,
) {
  const res = await api.get(path, {
    params: { ...params, format: 'excel' },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
