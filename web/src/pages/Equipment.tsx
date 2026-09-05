import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  getGroups,
  updateEquipment,
  type EquipmentGroup,
  type EquipmentInput,
  type EquipmentListItem,
} from '../api/client'
import { fmtDate, statusMeta } from '../lib/format'
import PageHeader from '../components/PageHeader'

export default function Equipment() {
  const { message, modal } = App.useApp()
  const [items, setItems] = useState<EquipmentListItem[]>([])
  const [groups, setGroups] = useState<EquipmentGroup[]>([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>()
  const [zoneFilter, setZoneFilter] = useState<string>()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentListItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getEquipment({ search, group: groupFilter, zone: zoneFilter })
      .then(setItems)
      .catch(() => message.error('โหลดข้อมูลอุปกรณ์ไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [search, groupFilter, zoneFilter, message])

  useEffect(() => {
    getGroups()
      .then(setGroups)
      .catch(() => message.error('โหลดกลุ่มอุปกรณ์ไม่สำเร็จ'))
  }, [message])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const zones = useMemo(
    () => [...new Set(items.map((i) => i.zoneCode).filter(Boolean))].sort(),
    [items],
  )

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'ACTIVE' })
    setModalOpen(true)
  }

  function openEdit(rec: EquipmentListItem) {
    setEditing(rec)
    form.setFieldsValue({
      ...rec,
      commissionDate: rec.commissionDate ? dayjs(rec.commissionDate) : null,
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    const v = await form.validateFields()
    const payload: EquipmentInput = {
      ...v,
      commissionDate: v.commissionDate
        ? dayjs(v.commissionDate).format('YYYY-MM-DD')
        : null,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateEquipment(editing.serialNumber, payload)
        message.success('แก้ไขอุปกรณ์เรียบร้อย')
      } else {
        await createEquipment(payload)
        message.success('เพิ่มอุปกรณ์เรียบร้อย')
      }
      setModalOpen(false)
      load()
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'บันทึกไม่สำเร็จ'
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(rec: EquipmentListItem) {
    modal.confirm({
      title: 'ยืนยันการลบ',
      content: `ต้องการลบอุปกรณ์ "${rec.equipmentName}" (SN: ${rec.serialNumber}) ?`,
      okText: 'ลบ',
      okType: 'danger',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          await deleteEquipment(rec.serialNumber)
          message.success('ลบเรียบร้อย')
          load()
        } catch {
          message.error('ลบไม่สำเร็จ')
        }
      },
    })
  }

  const columns: ColumnsType<EquipmentListItem> = [
    { title: 'กลุ่ม', dataIndex: 'groupName', width: 120 },
    { title: 'ชนิด', dataIndex: 'type', width: 110 },
    { title: 'SN', dataIndex: 'serialNumber', width: 200 },
    { title: 'แบรนด์', dataIndex: 'brand', width: 90 },
    { title: 'โมเดล', dataIndex: 'model', width: 110 },
    { title: 'ชื่ออุปกรณ์', dataIndex: 'equipmentName' },
    { title: 'Zone', dataIndex: 'zoneCode', width: 75 },
    {
      title: 'สถานะใช้งาน',
      dataIndex: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={s === 'ACTIVE' ? 'blue' : 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'PM ล่าสุด',
      dataIndex: 'lastPmDate',
      width: 110,
      render: (v: string | null) => fmtDate(v),
    },
    {
      title: 'สถานะ PM',
      dataIndex: 'pmStatus',
      width: 120,
      render: (_: unknown, r: EquipmentListItem) => {
        const m = statusMeta(r.pmStatus)
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: 'จัดการ',
      key: 'action',
      width: 110,
      fixed: 'right',
      render: (_: unknown, r: EquipmentListItem) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => confirmDelete(r)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="จัดการข้อมูลอุปกรณ์"
        subtitle="เพิ่ม / แก้ไข / ลบ และค้นหาอุปกรณ์"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มอุปกรณ์
          </Button>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="ค้นหา SN / ชื่อ / แบรนด์ / โมเดล"
            allowClear
            style={{ width: 280 }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            placeholder="กลุ่มอุปกรณ์"
            allowClear
            style={{ width: 180 }}
            value={groupFilter}
            onChange={setGroupFilter}
            options={groups.map((g) => ({
              value: g.groupCode,
              label: g.groupName,
            }))}
          />
          <Select
            placeholder="Zone"
            allowClear
            style={{ width: 130 }}
            value={zoneFilter}
            onChange={setZoneFilter}
            options={zones.map((z) => ({ value: z, label: z }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>
            รีเฟรช
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="serialNumber"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={items}
          scroll={{ x: 1300 }}
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  search || groupFilter || zoneFilter
                    ? 'ไม่พบอุปกรณ์ตรงเงื่อนไขที่ค้นหา'
                    : 'ยังไม่มีอุปกรณ์ในระบบ'
                }
                style={{ padding: '32px 0' }}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreate}
                >
                  เพิ่มอุปกรณ์
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      <Modal
        title={editing ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="groupCode"
            label="กลุ่มอุปกรณ์"
            rules={[{ required: true, message: 'เลือกกลุ่มอุปกรณ์' }]}
          >
            <Select
              placeholder="เลือกกลุ่ม"
              options={groups.map((g) => ({
                value: g.groupCode,
                label: `${g.groupName} (PM ทุก ${g.pmIntervalMonths} เดือน, ${g.costPerPm} บาท/ครั้ง)`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="ชนิด"
            rules={[{ required: true, message: 'ระบุชนิด' }]}
          >
            <Input placeholder="LASER / PC / SWITCH ..." />
          </Form.Item>
          <Form.Item
            name="serialNumber"
            label="Serial Number (SN)"
            tooltip={
              editing
                ? 'SN เป็น Primary Key แก้ไขไม่ได้ — ถ้าต้องเปลี่ยนให้ลบแล้วสร้างใหม่'
                : undefined
            }
            rules={[{ required: true, message: 'ระบุ SN' }]}
          >
            <Input placeholder="เช่น CNBKL4X6ZS" disabled={!!editing} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="brand" label="แบรนด์" style={{ flex: 1 }}>
              <Input placeholder="HP / ACER ..." />
            </Form.Item>
            <Form.Item name="model" label="โมเดล" style={{ flex: 1 }}>
              <Input placeholder="M706N ..." />
            </Form.Item>
          </Space>
          <Form.Item
            name="equipmentName"
            label="ชื่อของอุปกรณ์"
            rules={[{ required: true, message: 'ระบุชื่ออุปกรณ์' }]}
          >
            <Input placeholder="เช่น PT.QAD019059" />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="zoneCode" label="Zone" style={{ flex: 1 }}>
              <Input placeholder="O1 / B1 / P1" />
            </Form.Item>
            <Form.Item
              name="status"
              label="สถานะใช้งาน"
              style={{ flex: 1 }}
              initialValue="ACTIVE"
            >
              <Select
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE (ใช้งาน)' },
                  { value: 'RETIRED', label: 'RETIRED (เลิกใช้)' },
                ]}
              />
            </Form.Item>
          </Space>
          <Form.Item
            name="commissionDate"
            label="วันเริ่มใช้งาน (ใช้เป็นฐานคำนวณรอบ PM ครั้งแรก)"
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
