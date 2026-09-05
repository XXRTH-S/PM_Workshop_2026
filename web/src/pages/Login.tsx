import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'

const { Text } = Typography

export default function Login() {
  const { login } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function onFinish(v: { username: string; password: string }) {
    setLoading(true)
    try {
      await login(v.username.trim(), v.password)
      message.success('เข้าสู่ระบบสำเร็จ')
      navigate('/', { replace: true })
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'เข้าสู่ระบบไม่สำเร็จ'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #EAF3F1 0%, #F5F8F7 45%, #EEF4EF 100%)',
        padding: 16,
      }}
    >
      <Card
        style={{ width: 400, boxShadow: '0 8px 30px rgba(16,40,36,0.10)' }}
        styles={{ body: { padding: 32 } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Brand size="large" />
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="username"
            label="ชื่อผู้ใช้"
            rules={[{ required: true, message: 'กรอกชื่อผู้ใช้' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="username"
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="รหัสผ่าน"
            rules={[{ required: true, message: 'กรอกรหัสผ่าน' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              เข้าสู่ระบบ
            </Button>
          </Form.Item>
        </Form>
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            background: '#F1F6F5',
            borderRadius: 8,
            border: '1px solid #E4ECEA',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            บัญชีทดสอบ&nbsp;&nbsp;·&nbsp;&nbsp;<b>admin / admin123</b> (ผู้ดูแล)
            <br />
            <b>staffa / staff123</b> · <b>staffb / staff123</b> (ช่าง)
          </Text>
        </div>
      </Card>
    </div>
  )
}
