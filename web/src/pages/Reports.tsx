import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Typography,
} from 'antd'
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import dayjs from 'dayjs'
import {
  downloadExcel,
  getCostReport,
  getEquipment,
  getEquipmentHistoryReport,
  getPlanReport,
  type CostRow,
  type EquipmentHistoryRow,
  type EquipmentListItem,
  type PlanRow,
} from '../api/client'
import { CHART_COLORS, THAI_MONTHS } from '../lib/format'
import PageHeader from '../components/PageHeader'

const { Text } = Typography
const { RangePicker } = DatePicker
const NOW = dayjs()
const YEARS = Array.from({ length: 6 }, (_, i) => NOW.year() - i)
const monthOpts = THAI_MONTHS.map((m, i) => ({ value: i + 1, label: m }))
const yearOpts = YEARS.map((y) => ({ value: y, label: String(y) }))


// formatter ของ Tooltip — recharts ส่งค่ามาเป็น number|string|array|undefined
const fmtBahtTooltip = (
  v: number | string | readonly (number | string)[] | undefined,
): [string, string] => {
  const n = Array.isArray(v) ? Number(v[0]) : Number(v ?? 0)
  return [`${n.toLocaleString('th-TH')} บาท`, 'ค่าใช้จ่าย']
}

// ───────── 1) แผน PM ตามแผนรายเดือน/ปี (ReportExample) ─────────
function PlanTab() {
  const { message } = App.useApp()
  const [year, setYear] = useState<number>(NOW.year())
  const [month, setMonth] = useState<number | undefined>(NOW.month() + 1)
  const [title, setTitle] = useState('')
  const [rows, setRows] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getPlanReport({ year, month })
      .then((d) => {
        setRows(d.rows)
        setTitle(d.title)
      })
      .catch(() => message.error('โหลดรายงานไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [year, month, message])

  // โหลดรายงานเมื่อ filter เปลี่ยน — ตั้งใจ setLoading ใน effect (data fetching)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load])

  const columns: ColumnsType<PlanRow> = [
    { title: 'No', dataIndex: 'no', width: 60, align: 'center' },
    { title: 'PM Plan Date', dataIndex: 'planDate', width: 130 },
    { title: 'วันที่ PM อุปกรณ์', dataIndex: 'pmDate', width: 140 },
    { title: 'กลุ่มอุปกรณ์', dataIndex: 'groupCode', width: 120 },
    { title: 'ชนิด', dataIndex: 'type', width: 110 },
    { title: 'SN อุปกรณ์', dataIndex: 'serialNumber', width: 210 },
    { title: 'BRAND', dataIndex: 'brand', width: 90 },
    { title: 'MODEL', dataIndex: 'model', width: 110 },
    { title: 'ชื่อของอุปกรณ์', dataIndex: 'equipmentName' },
  ]

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 110 }}
          value={year}
          onChange={setYear}
          options={yearOpts}
        />
        <Select
          placeholder="ทั้งปี"
          allowClear
          style={{ width: 140 }}
          value={month}
          onChange={setMonth}
          options={monthOpts}
        />
        <Button icon={<SearchOutlined />} onClick={load}>
          แสดง
        </Button>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          disabled={!rows.length}
          onClick={() =>
            downloadExcel(
              '/reports/plan',
              { year, month },
              `PM-Plan-${year}${month ? '-' + month : ''}.xlsx`,
            )
          }
        >
          Export Excel
        </Button>
      </Space>
      {title && (
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          {title}
        </Text>
      )}
      <Table
        rowKey={(r) => `${r.no}-${r.serialNumber}`}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1200 }}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (t) => `ทั้งหมด ${t} รายการ`,
        }}
      />
    </>
  )
}

// ───────── 2) ประวัติ PM รายเครื่อง + ช่วงวันที่ (QueryReportExample) ─────────
function EquipmentHistoryTab() {
  const { message } = App.useApp()
  const [equipments, setEquipments] = useState<EquipmentListItem[]>([])
  const [serialNumber, setSerialNumber] = useState<string>()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState<string>()
  const [rows, setRows] = useState<EquipmentHistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getEquipment({})
      .then(setEquipments)
      .catch(() => message.error('โหลดรายการอุปกรณ์ไม่สำเร็จ'))
  }, [message])

  const load = useCallback(() => {
    if (!serialNumber) {
      message.warning('เลือกอุปกรณ์ก่อน')
      return
    }
    setLoading(true)
    getEquipmentHistoryReport({
      serialNumber,
      from: range?.[0]?.format('YYYY-MM-DD'),
      to: range?.[1]?.format('YYYY-MM-DD'),
    })
      .then((d) => {
        setRows(d.rows)
        setTitle(d.title)
        setSubtitle(d.subtitle)
      })
      .catch(() => message.error('โหลดรายงานไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [serialNumber, range, message])

  const columns: ColumnsType<EquipmentHistoryRow> = [
    { title: 'No', dataIndex: 'no', width: 70, align: 'center' },
    { title: 'วันที่ PM อุปกรณ์', dataIndex: 'pmDate', width: 200 },
    { title: 'ผู้ดำเนินการ', dataIndex: 'technician' },
  ]

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          showSearch={{
            filterOption: (input, option) =>
              String(option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase()),
          }}
          placeholder="เลือกอุปกรณ์ (ค้นหา SN / ชื่อ)"
          style={{ width: 360 }}
          value={serialNumber}
          onChange={setSerialNumber}
          options={equipments.map((e) => ({
            value: e.serialNumber,
            label: `${e.serialNumber} — ${e.equipmentName} (${e.groupName})`,
          }))}
        />
        <RangePicker
          format="DD/MM/YYYY"
          value={range}
          onChange={(v) =>
            setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)
          }
        />
        <Button icon={<SearchOutlined />} onClick={load}>
          แสดง
        </Button>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          disabled={!serialNumber || !rows.length}
          onClick={() =>
            downloadExcel(
              '/reports/equipment-history',
              {
                serialNumber,
                from: range?.[0]?.format('YYYY-MM-DD'),
                to: range?.[1]?.format('YYYY-MM-DD'),
              },
              `PM-History-${serialNumber}.xlsx`,
            )
          }
        >
          Export Excel
        </Button>
      </Space>
      {title && (
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ display: 'block' }}>
            {title}
          </Text>
          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </div>
      )}
      <Table
        rowKey="no"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          defaultPageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (t) => `ทั้งหมด ${t} ครั้ง`,
        }}
        locale={{ emptyText: 'เลือกอุปกรณ์แล้วกด "แสดง"' }}
      />
    </>
  )
}

// ───────── 3) ค่าใช้จ่าย PM ─────────
function CostTab() {
  const { message } = App.useApp()
  const [year, setYear] = useState<number>(NOW.year())
  const [month, setMonth] = useState<number>()
  const [rows, setRows] = useState<CostRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getCostReport({ year, month })
      .then((d) => {
        setRows(d.rows)
        setGrandTotal(d.grandTotal)
      })
      .catch(() => message.error('โหลดรายงานไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [year, month, message])

  // โหลดรายงานเมื่อ filter เปลี่ยน — ตั้งใจ setLoading ใน effect (data fetching)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load])

  // ข้อมูลสำหรับ pie — เฉพาะกลุ่มที่มีค่าใช้จ่าย (>0) ไม่งั้นชิ้นว่างรก
  // ใส่ fill ในตัวข้อมูลเลย (recharts 3 เลิกใช้ <Cell> แล้ว)
  const pieData = rows
    .filter((r) => r.totalCost > 0)
    .map((r, i) => ({
      name: r.groupName,
      value: r.totalCost,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))

  const columns: ColumnsType<CostRow> = [
    { title: 'กลุ่มอุปกรณ์', dataIndex: 'groupName' },
    {
      title: 'จำนวนครั้งที่ PM',
      dataIndex: 'count',
      align: 'right',
      width: 160,
    },
    {
      title: 'รวมค่าใช้จ่าย (บาท)',
      dataIndex: 'totalCost',
      align: 'right',
      width: 200,
      render: (v: number) => v.toLocaleString('th-TH'),
    },
  ]

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 110 }}
          value={year}
          onChange={setYear}
          options={yearOpts}
        />
        <Select
          placeholder="ทั้งปี"
          allowClear
          style={{ width: 140 }}
          value={month}
          onChange={setMonth}
          options={monthOpts}
        />
        <Button icon={<SearchOutlined />} onClick={load}>
          แสดง
        </Button>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          disabled={!rows.length}
          onClick={() =>
            downloadExcel(
              '/reports/cost',
              { year, month },
              `PM-Cost-${year}${month ? '-' + month : ''}.xlsx`,
            )
          }
        >
          Export Excel
        </Button>
      </Space>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
          alignItems: 'stretch',
        }}
      >
        <Card style={{ minWidth: 280, flex: '0 0 auto' }}>
          <Statistic
            title={`รวมค่าใช้จ่าย PM ปี ${year}${
              month ? ' เดือน ' + THAI_MONTHS[month - 1] : ' (ทั้งปี)'
            }`}
            value={grandTotal}
            suffix="บาท"
            formatter={(v) => (
              <span style={{ color: '#1677ff' }}>
                {Number(v).toLocaleString('th-TH')}
              </span>
            )}
          />
        </Card>
        <Card
          title="สัดส่วนค่าใช้จ่ายตามกลุ่มอุปกรณ์"
          size="small"
          style={{ flex: '1 1 360px', minWidth: 320 }}
        >
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label={({ percent }) =>
                    `${(((percent as number | undefined) ?? 0) * 100).toFixed(0)}%`
                  }
                />
                <Tooltip formatter={fmtBahtTooltip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="ยังไม่มีข้อมูลค่าใช้จ่าย"
              style={{ padding: '48px 0' }}
            />
          )}
        </Card>
      </div>
      <Table
        rowKey="groupCode"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <strong>รวมทั้งหมด</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{rows.reduce((s, r) => s + r.count, 0)}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <strong>{grandTotal.toLocaleString('th-TH')}</strong>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </>
  )
}

export default function Reports() {
  return (
    <div>
      <PageHeader
        title="รายงาน & Export Excel"
        subtitle="ออกรายงานแผน PM รายเดือน / ประวัติรายเครื่อง / ค่าใช้จ่าย และดาวน์โหลดเป็นไฟล์ Excel"
      />
      <Card>
        <Tabs
          defaultActiveKey="plan"
          items={[
            {
              key: 'plan',
              label: 'แผน PM ตามแผนรายเดือน',
              children: <PlanTab />,
            },
            {
              key: 'eq-history',
              label: 'ประวัติ PM รายเครื่อง',
              children: <EquipmentHistoryTab />,
            },
            { key: 'cost', label: 'ค่าใช้จ่าย PM', children: <CostTab /> },
          ]}
        />
      </Card>
    </div>
  )
}
