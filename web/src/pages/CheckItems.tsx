import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
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
import {
  createCheckItem,
  deleteCheckItem,
  getCheckItems,
  getGroups,
  updateCheckItem,
  type CheckItem,
  type EquipmentGroup,
} from '../api/client'
import PageHeader from '../components/PageHeader'

const CATEGORIES = [
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'OTHER', label: 'อื่น ๆ' },
]

export default function CheckItems() {
  const { message, modal } = App.useApp()
  const [groups, setGroups] = useState<EquipmentGroup[]>([])
  const [groupFilter, setGroupFilter] = useState<string>()
  const [items, setItems] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CheckItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    getGroups()
      .then(setGroups)
      .catch(() => message.error('โหลดกลุ่มอุปกรณ์ไม่สำเร็จ'))
  }, [message])

  const load = useCallback(() => {
    setLoading(true)
    getCheckItems({ group: groupFilter, all: true })
      .then(setItems)
      .catch(() => message.error('โหลดรายการตรวจไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [groupFilter, message])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load])

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      groupCode: groupFilter ?? groups[0]?.groupCode,
      category: 'HARDWARE',
      sortOrder: items.length,
      active: true,
    })
    setOpen(true)
  }

  function openEdit(rec: CheckItem) {
    setEditing(rec)
    form.setFieldsValue(rec)
    setOpen(true)
  }

  async function submit() {
    const v = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await updateCheckItem(editing.id, v)
        message.success('แก้ไขรายการตรวจแล้ว')
      } else {
        await createCheckItem(v)
        message.success('เพิ่มรายการตรวจแล้ว')
      }
      setOpen(false)
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

  function toggleActive(rec: CheckItem, active: boolean) {
    updateCheckItem(rec.id, { active })
      .then(() => {
        message.success(active ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว')
        load()
      })
      .catch(() => message.error('อัปเดตไม่สำเร็จ'))
  }

  function confirmDelete(rec: CheckItem) {
    modal.confirm({
      title: 'ยืนยันการลบ',
      content: `ลบรายการตรวจ "${rec.label}" ? (ผลตรวจเก่าในประวัติ PM ยังดูได้)`,
      okText: 'ลบ',
      okType: 'danger',
      cancelText: 'ยกเลิก',
      onOk: () =>
        deleteCheckItem(rec.id)
          .then(() => {
            message.success('ลบแล้ว')
            load()
          })
          .catch(() => message.error('ลบไม่สำเร็จ')),
    })
  }

  const columns: ColumnsType<CheckItem> = [
    {
      title: 'กลุ่ม',
      dataIndex: 'groupCode',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'หมวด',
      dataIndex: 'category',
      width: 110,
      render: (v: string) =>
        CATEGORIES.find((c) => c.value === v)?.label ?? v,
    },
    { title: 'รายการตรวจ', dataIndex: 'label' },
    { title: 'ลำดับ', dataIndex: 'sortOrder', width: 80, align: 'center' },
    {
      title: 'ใช้งาน',
      dataIndex: 'active',
      width: 90,
      align: 'center',
      render: (v: boolean, r: CheckItem) => (
        <Switch
          size="small"
          checked={v}
          onChange={(c) => toggleActive(r, c)}
        />
      ),
    },
    {
      title: 'จัดการ',
      key: 'action',
      width: 110,
      render: (_: unknown, r: CheckItem) => (
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
        title="จัดการรายการตรวจ PM (Checklist)"
        subtitle="กำหนดรายการตรวจเช็คแยกตามกลุ่มอุปกรณ์ — เปิด/ปิด แก้ไข หรือเพิ่มรายการได้ (เฉพาะผู้ดูแล)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มรายการตรวจ
          </Button>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="กรองตามกลุ่มอุปกรณ์"
            allowClear
            style={{ width: 220 }}
            value={groupFilter}
            onChange={setGroupFilter}
            options={groups.map((g) => ({
              value: g.groupCode,
              label: `${g.groupName} (${g.groupCode})`,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>
            รีเฟรช
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `ทั้งหมด ${t} รายการ`,
          }}
        />
      </Card>

      <Modal
        title={editing ? 'แก้ไขรายการตรวจ' : 'เพิ่มรายการตรวจ'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="groupCode"
            label="กลุ่มอุปกรณ์"
            rules={[{ required: true, message: 'เลือกกลุ่ม' }]}
          >
            <Select
              disabled={!!editing}
              options={groups.map((g) => ({
                value: g.groupCode,
                label: `${g.groupName} (${g.groupCode})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="label"
            label="ข้อความรายการตรวจ"
            rules={[{ required: true, message: 'ระบุข้อความ' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="เช่น ทำความสะอาดฝุ่นภายใน/พัดลม"
            />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item
              name="category"
              label="หมวด"
              style={{ flex: 1 }}
              initialValue="HARDWARE"
            >
              <Select options={CATEGORIES} />
            </Form.Item>
            <Form.Item
              name="sortOrder"
              label="ลำดับการแสดง"
              style={{ flex: 1 }}
              initialValue={0}
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="active" label="ใช้งาน" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
