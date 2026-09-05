import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Empty, Modal, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getAlerts, type AlertItem } from '../api/client'
import { daysText, statusMeta } from '../lib/format'

/** Popup งาน PM ที่ต้องทำ — เด้งให้ technician ดูว่าวันนี้มีเครื่องไหนต้อง PM
 *  (เลยกำหนด = ล่าช้า, ทำข้ามวันได้ ไม่บังคับเสร็จในวันเดียว) */
export default function DailyPmModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [items, setItems] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    // โหลดรายการเมื่อเปิด modal (ตั้งใจ — data fetching pattern)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getAlerts()
      .then((d) =>
        setItems(
          // เตือนเฉพาะ "งานของวันนี้": เลยกำหนด (daysUntilDue < 0)
          // + ครบกำหนดวันนี้ (daysUntilDue === 0) — ไม่รวมงานที่ใกล้จะถึง
          d.alerts.filter(
            (a) =>
              a.pmStatus === 'OVERDUE' ||
              (a.pmStatus === 'DUE_SOON' && a.daysUntilDue === 0),
          ),
        ),
      )
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open])

  const overdue = items.filter((i) => i.pmStatus === 'OVERDUE').length
  const dueToday = items.length - overdue // ที่เหลือ = ครบกำหนดวันนี้

  const columns: ColumnsType<AlertItem> = [
    { title: 'SN', dataIndex: 'serialNumber', width: 190 },
    { title: 'ชื่ออุปกรณ์', dataIndex: 'equipmentName' },
    { title: 'กลุ่ม', dataIndex: 'groupName', width: 120 },
    {
      title: 'สถานะ',
      dataIndex: 'pmStatus',
      width: 200,
      render: (_: unknown, r: AlertItem) => {
        const m = statusMeta(r.pmStatus)
        const late = r.pmStatus === 'OVERDUE'
        return (
          <Tag color={m.color}>
            {late
              ? `ล่าช้า/เลยกำหนด · ${daysText(r.daysUntilDue)}`
              : 'ถึงกำหนด PM วันนี้'}
          </Tag>
        )
      },
    },
    {
      title: '',
      key: 'go',
      width: 110,
      render: (_: unknown, r: AlertItem) => (
        <Button
          type="link"
          onClick={() => {
            onClose()
            navigate(`/pm?sn=${encodeURIComponent(r.serialNumber)}`)
          }}
        >
          บันทึก PM
        </Button>
      ),
    },
  ]

  return (
    <Modal
      title="🔔 งาน PM ที่ต้องดำเนินการ"
      open={open}
      onCancel={onClose}
      closable={false} // เอา ✕ มุมขวาบนออก — ใช้ปุ่ม "ปิด" ด้านล่างปุ่มเดียว
      width={760}
      footer={[
        <Button key="close" onClick={onClose}>
          ปิด
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <Alert
          type={overdue > 0 ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            overdue > 0
              ? `มี ${overdue} เครื่องล่าช้า/เลยกำหนด${
                  dueToday > 0 ? ` และ ${dueToday} เครื่องถึงกำหนดวันนี้` : ''
                }`
              : `มี ${dueToday} เครื่องถึงกำหนด PM วันนี้`
          }
        />
        {items.length === 0 && !loading ? (
          <Empty description="ไม่มีงาน PM ค้าง 🎉" />
        ) : (
          <Table
            rowKey="serialNumber"
            size="small"
            columns={columns}
            dataSource={items}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 700 }}
          />
        )}
      </Spin>
    </Modal>
  )
}
