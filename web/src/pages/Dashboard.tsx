import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Col, Row, Statistic, Table, Tag } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DesktopOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import type { ColumnsType } from 'antd/es/table'
import {
  getAlerts,
  type AlertItem,
  type AlertResponse,
  type PmStatus,
} from '../api/client'
import { daysText, fmtDate, statusMeta, STATUS_COLORS } from '../lib/format'
import PageHeader from '../components/PageHeader'

type Filter = 'ALL' | 'OVERDUE' | 'DUE_SOON' | 'OK'

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<AlertResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getAlerts()
      .then(setData)
      .catch(() =>
        setError('เชื่อมต่อ backend ไม่ได้ — ตรวจสอบว่ารัน server (:4000) อยู่'),
      )
      .finally(() => setLoading(false))
  }, [])

  // โหลดข้อมูลครั้งแรก — ตั้งใจ setLoading ใน effect (data fetching pattern)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load])

  const rows = useMemo(() => {
    if (!data) return []
    if (filter === 'ALL') return data.alerts
    if (filter === 'OK') return data.ok // เครื่องสถานะปกติ (มาจาก field แยก)
    return data.alerts.filter((a) => a.pmStatus === filter)
  }, [data, filter])

  const columns: ColumnsType<AlertItem> = [
    { title: 'กลุ่ม', dataIndex: 'groupName', width: 130 },
    { title: 'ชนิด', dataIndex: 'type', width: 110 },
    { title: 'SN', dataIndex: 'serialNumber', width: 200 },
    { title: 'ชื่ออุปกรณ์', dataIndex: 'equipmentName' },
    { title: 'Zone', dataIndex: 'zoneCode', width: 80 },
    {
      title: 'PM ล่าสุด',
      dataIndex: 'lastPmDate',
      width: 120,
      render: (v: string | null) => fmtDate(v),
    },
    {
      title: 'กำหนดครั้งถัดไป',
      dataIndex: 'nextDueDate',
      width: 140,
      render: (v: string | null) => fmtDate(v),
    },
    {
      title: 'สถานะ',
      dataIndex: 'pmStatus',
      width: 130,
      render: (_: unknown, r: AlertItem) => {
        const m = statusMeta(r.pmStatus)
        return (
          <Tag color={m.color}>
            {m.label}
            {r.daysUntilDue != null && r.pmStatus !== 'NEVER'
              ? ` (${daysText(r.daysUntilDue)})`
              : ''}
          </Tag>
        )
      },
    },
    {
      title: '',
      key: 'action',
      width: 110,
      render: (_: unknown, r: AlertItem) => (
        <Button
          type="link"
          onClick={() =>
            navigate(`/pm?sn=${encodeURIComponent(r.serialNumber)}`)
          }
        >
          บันทึก PM
        </Button>
      ),
    },
  ]

  const s = data?.summary

  return (
    <div>
      <PageHeader
        title="ภาพรวมระบบ PM"
        subtitle="สรุปสถานะการบำรุงรักษาของอุปกรณ์ทั้งหมด — คลิกการ์ดเพื่อกรองดูรายการตามสถานะ"
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            รีเฟรช
          </Button>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading && !data}
            title="อุปกรณ์ทั้งหมด (ใช้งาน)"
            value={s?.total ?? 0}
            color={STATUS_COLORS.primary}
            icon={<DesktopOutlined />}
            active={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
            hint="ดูทั้งหมด"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading && !data}
            title="เลยกำหนด PM"
            value={s?.overdue ?? 0}
            color={STATUS_COLORS.overdue}
            icon={<WarningOutlined />}
            active={filter === 'OVERDUE'}
            onClick={() => setFilter('OVERDUE')}
            hint="กรองเฉพาะที่เลยกำหนด"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading && !data}
            title="ใกล้ครบรอบ (≤30 วัน)"
            value={s?.dueSoon ?? 0}
            color={STATUS_COLORS.dueSoon}
            icon={<ClockCircleOutlined />}
            active={filter === 'DUE_SOON'}
            onClick={() => setFilter('DUE_SOON')}
            hint="กรองเฉพาะที่ใกล้ครบรอบ"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading && !data}
            title="ปกติ"
            value={s?.ok ?? 0}
            color={STATUS_COLORS.ok}
            icon={<CheckCircleOutlined />}
            active={filter === 'OK'}
            onClick={() => setFilter('OK')}
            hint="กรองเฉพาะที่ปกติ"
          />
        </Col>
      </Row>

      <Card
        title={
          filter === 'ALL'
            ? `รายการแจ้งเตือน (${rows.length} รายการ)`
            : `อุปกรณ์สถานะ: ${statusMeta(filter as PmStatus).label} (${rows.length} รายการ)`
        }
        extra={
          filter !== 'ALL' && (
            <Button size="small" onClick={() => setFilter('ALL')}>
              ล้างตัวกรอง
            </Button>
          )
        }
      >
        <Table
          rowKey="serialNumber"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          scroll={{ x: 1100 }}
          locale={{
            emptyText:
              filter === 'ALL'
                ? 'ไม่มีรายการที่ต้องแจ้งเตือน 🎉'
                : 'ไม่มีรายการในสถานะนี้',
          }}
        />
      </Card>
    </div>
  )
}

/** การ์ดสรุป — คลิกได้ มีไอคอนวงกลมโทนสี + ยกตัวตอน hover/active */
function StatCard({
  title,
  value,
  color,
  icon,
  onClick,
  active,
  hint,
  loading,
}: {
  title: string
  value: number
  color: string
  icon: ReactNode
  onClick: () => void
  active?: boolean
  hint?: string
  loading?: boolean
}) {
  return (
    <Card
      loading={loading}
      hoverable
      onClick={onClick}
      styles={{ body: { padding: 18 } }}
      style={{
        cursor: 'pointer',
        border: active ? `1.5px solid ${color}` : undefined,
        boxShadow: active ? `0 2px 12px ${color}33` : undefined,
        transition: 'all .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${color}1A`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <Statistic
            title={title}
            value={value}
            formatter={() => (
              <span style={{ color, fontWeight: 700, fontSize: 26 }}>
                {value.toLocaleString('th-TH')}
              </span>
            )}
          />
          {hint && (
            <div style={{ fontSize: 11.5, color: '#8A9A96', marginTop: 2 }}>
              {hint}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
