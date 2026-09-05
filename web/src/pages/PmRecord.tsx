import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  createPm,
  deletePm,
  getCheckItems,
  getEquipment,
  getGroups,
  getPmDetail,
  getPmHistory,
  type CheckItem,
  type CheckResultValue,
  type EquipmentGroup,
  type EquipmentListItem,
  type PmDetail,
  type PmHistoryItem,
} from '../api/client'
import { fmtDate, THAI_MONTHS } from '../lib/format'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'

const { Text } = Typography
const NOW = dayjs()
const YEARS = Array.from({ length: 6 }, (_, i) => NOW.year() - i)

const RESULT_OPTS = [
  { label: 'ผ่าน', value: 'PASS' },
  { label: 'ไม่ผ่าน', value: 'FAIL' },
]
const CAT_LABEL: Record<string, string> = {
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
  OTHER: 'อื่น ๆ',
}

function resultTag(v: string) {
  if (v === 'PASS') return <Tag color="green">ผ่าน</Tag>
  if (v === 'FAIL') return <Tag color="red">ไม่ผ่าน</Tag>
  return <Tag>{v}</Tag>
}

export default function PmRecord() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [equipments, setEquipments] = useState<EquipmentListItem[]>([])
  const [groups, setGroups] = useState<EquipmentGroup[]>([])
  const [history, setHistory] = useState<PmHistoryItem[]>([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // checklist ของอุปกรณ์ที่เลือก
  const [checkItems, setCheckItems] = useState<CheckItem[]>([])
  const [checkResults, setCheckResults] = useState<
    Record<number, { result: CheckResultValue; note: string }>
  >({})

  // modal ดูผลตรวจของประวัติ
  const [detail, setDetail] = useState<PmDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [fYear, setFYear] = useState<number>()
  const [fMonth, setFMonth] = useState<number>()
  const [fGroup, setFGroup] = useState<string>()

  useEffect(() => {
    getEquipment({})
      .then(setEquipments)
      .catch(() => message.error('โหลดรายการอุปกรณ์ไม่สำเร็จ'))
    getGroups()
      .then(setGroups)
      .catch(() => message.error('โหลดกลุ่มอุปกรณ์ไม่สำเร็จ'))
  }, [message])

  const loadHistory = useCallback(() => {
    setLoadingHist(true)
    getPmHistory({ year: fYear, month: fMonth, group: fGroup })
      .then(setHistory)
      .catch(() => message.error('โหลดประวัติ PM ไม่สำเร็จ'))
      .finally(() => setLoadingHist(false))
  }, [fYear, fMonth, fGroup, message])

  // โหลดประวัติเมื่อ filter เปลี่ยน — ตั้งใจ setLoading ใน effect (data fetching)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadHistory, [loadHistory])

  const groupCostMap = useMemo(
    () => new Map(groups.map((g) => [g.groupCode, g.costPerPm])),
    [groups],
  )

  const loadChecklist = useCallback((groupCode: string) => {
    getCheckItems({ group: groupCode })
      .then((items) => {
        setCheckItems(items)
        const init: Record<number, { result: CheckResultValue; note: string }> =
          {}
        items.forEach((it) => (init[it.id] = { result: 'PASS', note: '' }))
        setCheckResults(init)
      })
      .catch(() => {
        setCheckItems([])
        setCheckResults({})
      })
  }, [])

  // prefill จากปุ่ม "บันทึก PM" บน Dashboard (?sn=)
  useEffect(() => {
    const snParam = searchParams.get('sn')
    if (snParam && equipments.length) {
      const eq = equipments.find((e) => e.serialNumber === snParam)
      if (eq) {
        form.setFieldsValue({
          serialNumber: eq.serialNumber,
          pmDate: dayjs(),
          cost: groupCostMap.get(eq.groupCode) ?? null,
        })
        loadChecklist(eq.groupCode)
      }
    }
  }, [searchParams, equipments, groupCostMap, form, loadChecklist])

  function onSelectEquipment(sn: string) {
    const eq = equipments.find((e) => e.serialNumber === sn)
    if (eq) {
      form.setFieldsValue({ cost: groupCostMap.get(eq.groupCode) ?? null })
      loadChecklist(eq.groupCode)
    }
  }

  function setResult(id: number, result: CheckResultValue) {
    setCheckResults((p) => ({ ...p, [id]: { ...p[id], result } }))
  }
  function setNote(id: number, note: string) {
    setCheckResults((p) => ({ ...p, [id]: { ...p[id], note } }))
  }

  async function handleSave() {
    const v = await form.validateFields()
    setSaving(true)
    try {
      await createPm({
        serialNumber: v.serialNumber,
        pmDate: dayjs(v.pmDate).format('YYYY-MM-DD'),
        cost: v.cost,
        remark: v.remark || undefined,
        checks: checkItems.map((it) => ({
          checkItemId: it.id,
          result: checkResults[it.id]?.result ?? 'PASS',
          note: checkResults[it.id]?.note || undefined,
        })),
      })
      message.success('บันทึกผล PM เรียบร้อย')
      form.resetFields()
      setCheckItems([])
      setCheckResults({})
      setSearchParams({})
      loadHistory()
      getEquipment({}).then(setEquipments)
    } catch {
      message.error('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(rec: PmHistoryItem) {
    deletePm(rec.pmId)
      .then(() => {
        message.success('ลบรายการ PM แล้ว')
        loadHistory()
      })
      .catch(() => message.error('ลบไม่สำเร็จ'))
  }

  function openDetail(pmId: number) {
    getPmDetail(pmId)
      .then((d) => {
        setDetail(d)
        setDetailOpen(true)
      })
      .catch(() => message.error('โหลดรายละเอียดไม่สำเร็จ'))
  }

  const itemsByCat = useMemo(() => {
    const m = new Map<string, CheckItem[]>()
    checkItems.forEach((it) => {
      const arr = m.get(it.category) ?? []
      arr.push(it)
      m.set(it.category, arr)
    })
    return [...m.entries()]
  }, [checkItems])

  const columns: ColumnsType<PmHistoryItem> = [
    {
      title: 'วันที่ PM',
      dataIndex: 'pmDate',
      width: 105,
      render: (v: string) => fmtDate(v),
      sorter: (a, b) => +new Date(a.pmDate) - +new Date(b.pmDate),
      defaultSortOrder: 'descend',
    },
    {
      title: 'กลุ่ม',
      dataIndex: 'groupName',
      width: 115,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: 'ชนิด', dataIndex: 'type', width: 95 },
    { title: 'SN', dataIndex: 'serialNumber', width: 190 },
    { title: 'ชื่ออุปกรณ์', dataIndex: 'equipmentName' },
    {
      title: 'ค่าใช้จ่าย',
      dataIndex: 'cost',
      width: 95,
      align: 'right',
      render: (v: number) => v.toLocaleString('th-TH'),
    },
    {
      title: 'ผู้ดำเนินการ',
      dataIndex: 'performedBy',
      width: 120,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'ผลตรวจ',
      key: 'check',
      width: 130,
      render: (_: unknown, r: PmHistoryItem) => {
        if (!r.checkTotal) return <Text type="secondary">ไม่มี checklist</Text>
        const color = r.checkFail > 0 ? 'red' : 'green'
        return (
          <Tag color={color}>
            {r.checkPass}/{r.checkTotal} ผ่าน
            {r.checkFail > 0 ? ` · ${r.checkFail} ไม่ผ่าน` : ''}
          </Tag>
        )
      },
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: unknown, r: PmHistoryItem) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation() // กันไม่ให้เปิด popup รายละเอียดตอนกดลบ
            confirmDelete(r)
          }}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="บันทึกผล PM"
        subtitle="บันทึกผลการบำรุงรักษาพร้อมรายการตรวจเช็ค"
      />

      <Card title="บันทึกการทำ PM ใหม่" style={{ marginBottom: 20 }}>
        <Form form={form} layout="vertical" initialValues={{ pmDate: dayjs() }}>
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Form.Item
                name="serialNumber"
                label="อุปกรณ์ที่ทำ PM"
                rules={[{ required: true, message: 'เลือกอุปกรณ์' }]}
              >
                <Select
                  showSearch={{
                    filterOption: (input, option) =>
                      String(option?.label ?? '')
                        .toLowerCase()
                        .includes(input.toLowerCase()),
                  }}
                  placeholder="ค้นหา SN หรือชื่ออุปกรณ์"
                  onChange={onSelectEquipment}
                  options={equipments.map((e) => ({
                    value: e.serialNumber,
                    label: `${e.serialNumber} — ${e.equipmentName} (${e.groupName})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item
                name="pmDate"
                label="วันที่ PM"
                rules={[{ required: true, message: 'ระบุวันที่' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item
                name="cost"
                label="ค่าใช้จ่าย (บาท)"
                tooltip="ดึงอัตโนมัติจากนโยบายกลุ่ม แก้ไขได้"
              >
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item
                label="ผู้ดำเนินการ"
                tooltip="บันทึกเป็นผู้ที่เข้าสู่ระบบอยู่โดยอัตโนมัติ"
              >
                <Input value={user?.displayName ?? '-'} disabled />
              </Form.Item>
            </Col>
          </Row>

          {checkItems.length > 0 && (
            <>
              <Divider titlePlacement="start" style={{ marginTop: 0 }}>
                รายการตรวจเช็ค (Checklist) — {checkItems.length} ข้อ
              </Divider>
              {itemsByCat.map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <Text strong>{CAT_LABEL[cat] ?? cat}</Text>
                  {items.map((it) => (
                    <Row
                      key={it.id}
                      gutter={8}
                      align="middle"
                      style={{ marginTop: 8 }}
                    >
                      <Col xs={24} md={11}>
                        {it.label}
                      </Col>
                      <Col xs={12} md={6}>
                        <Segmented
                          size="small"
                          options={RESULT_OPTS}
                          value={checkResults[it.id]?.result ?? 'PASS'}
                          onChange={(val) =>
                            setResult(it.id, val as CheckResultValue)
                          }
                        />
                      </Col>
                      <Col xs={12} md={7}>
                        <Input
                          size="small"
                          placeholder="หมายเหตุ (ถ้ามี)"
                          value={checkResults[it.id]?.note ?? ''}
                          onChange={(e) => setNote(it.id, e.target.value)}
                        />
                      </Col>
                    </Row>
                  ))}
                </div>
              ))}
              <Divider style={{ margin: '12px 0' }} />
            </>
          )}

          <Row gutter={16}>
            <Col xs={24} md={19}>
              <Form.Item name="remark" label="หมายเหตุรวม">
                <Input.TextArea rows={1} placeholder="รายละเอียดเพิ่มเติม" />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              md={5}
              style={{ display: 'flex', alignItems: 'flex-end' }}
            >
              <Form.Item style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                  block
                >
                  บันทึก PM
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="ประวัติการทำ PM">
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder="ปี"
            allowClear
            style={{ width: 110 }}
            value={fYear}
            onChange={setFYear}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))}
          />
          <Select
            placeholder="เดือน"
            allowClear
            style={{ width: 140 }}
            value={fMonth}
            onChange={setFMonth}
            options={THAI_MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          />
          <Select
            placeholder="กลุ่มอุปกรณ์"
            allowClear
            style={{ width: 180 }}
            value={fGroup}
            onChange={setFGroup}
            options={groups.map((g) => ({
              value: g.groupCode,
              label: g.groupName,
            }))}
          />
        </Space>
        <Table
          rowKey="pmId"
          size="small"
          loading={loadingHist}
          columns={columns}
          dataSource={history}
          scroll={{ x: 1200 }}
          onRow={(r) => ({
            onClick: () => openDetail(r.pmId),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          }}
          locale={{
            emptyText:
              'ยังไม่มีประวัติการ PM — บันทึกผล PM ครั้งแรกได้จากฟอร์มด้านบน',
          }}
        />
      </Card>

      <Modal
        title={
          detail
            ? `ผลตรวจ PM — ${detail.equipmentName} (${fmtDate(detail.pmDate)})`
            : 'ผลตรวจ PM'
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="c" onClick={() => setDetailOpen(false)}>
            ปิด
          </Button>,
        ]}
        width={680}
      >
        {detail && (
          <>
            <Descriptions
              size="small"
              bordered
              column={2}
              styles={{ label: { width: 110 } }}
              items={[
                { key: 'd', label: 'วันที่ PM', children: fmtDate(detail.pmDate) },
                {
                  key: 'who',
                  label: 'ผู้ดำเนินการ',
                  children: detail.performedBy,
                },
                { key: 'g', label: 'กลุ่ม', children: detail.groupName },
                { key: 't', label: 'ชนิด', children: detail.type },
                { key: 'sn', label: 'SN', children: detail.serialNumber },
                {
                  key: 'c',
                  label: 'ค่าใช้จ่าย',
                  children: `${detail.cost.toLocaleString('th-TH')} บาท`,
                },
                {
                  key: 'rm',
                  label: 'หมายเหตุรวม',
                  span: 2,
                  children: detail.remark || '-',
                },
              ]}
            />
            <Divider titlePlacement="start" style={{ marginBlock: 14 }}>
              รายการตรวจเช็ค (Checklist)
              {detail.checks.length > 0
                ? ` — ผ่าน ${detail.checks.filter((c) => c.result === 'PASS').length
                }/${detail.checks.length}`
                : ''}
            </Divider>
            <Table
              size="small"
              rowKey={(_, i) => String(i)}
              pagination={false}
              dataSource={detail.checks}
              locale={{
                emptyText:
                  'การ PM ครั้งนี้ไม่มีบันทึก checklist',
              }}
              columns={[
                { title: 'รายการตรวจ', dataIndex: 'itemLabel' },
                {
                  title: 'ผล',
                  dataIndex: 'result',
                  width: 90,
                  render: (v: string) => resultTag(v),
                },
                {
                  title: 'หมายเหตุ',
                  dataIndex: 'note',
                  width: 220,
                  render: (v: string | null) => v || '-',
                },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
