import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { Button, Layout, Menu, Space, Spin, Tag } from 'antd'
import {
  BellOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FileExcelOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Dashboard from './pages/Dashboard'
import Equipment from './pages/Equipment'
import PmRecord from './pages/PmRecord'
import Reports from './pages/Reports'
import CheckItems from './pages/CheckItems'
import Login from './pages/Login'
import DailyPmModal from './components/DailyPmModal'
import Brand from './components/Brand'
import { useAuth } from './auth/AuthContext'

const { Header, Sider, Content } = Layout

export default function App() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const isTech = user?.role === 'TECHNICIAN'

  // technician: เด้ง popup งาน PM ครั้งแรกของวัน (ทำข้ามวันได้ ไม่บังคับ)
  useEffect(() => {
    if (!isTech || !user) return
    const key = `pm_popup_${user.id}_${dayjs().format('YYYY-MM-DD')}`
    if (!localStorage.getItem(key)) {
      // เด้ง popup ครั้งแรกของวัน (ตั้งใจ — ไม่ใช่ render loop)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPopupOpen(true)
      localStorage.setItem(key, '1')
    }
  }, [isTech, user])

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/equipment')) return '/equipment'
    if (location.pathname.startsWith('/pm')) return '/pm'
    if (location.pathname.startsWith('/reports')) return '/reports'
    if (location.pathname.startsWith('/check-items')) return '/check-items'
    return '/'
  }, [location.pathname])

  const menuItems = useMemo(() => {
    const items = [
      // Dashboard เฉพาะ admin
      ...(isAdmin
        ? [
            {
              key: '/',
              icon: <DashboardOutlined />,
              label: <Link to="/">Dashboard</Link>,
            },
          ]
        : []),
      {
        key: '/equipment',
        icon: <DesktopOutlined />,
        label: <Link to="/equipment">จัดการอุปกรณ์</Link>,
      },
      {
        key: '/pm',
        icon: <ToolOutlined />,
        label: <Link to="/pm">บันทึกผล PM</Link>,
      },
      {
        key: '/reports',
        icon: <FileExcelOutlined />,
        label: <Link to="/reports">รายงาน</Link>,
      },
      // จัดการรายการตรวจ PM เฉพาะ admin
      ...(isAdmin
        ? [
            {
              key: '/check-items',
              icon: <CheckSquareOutlined />,
              label: <Link to="/check-items">รายการตรวจ PM</Link>,
            },
          ]
        : []),
    ]
    return items
  }, [isAdmin])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  // ยังไม่ login → หน้า Login (ทุก path)
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingInline: 16,
          borderBottom: '1px solid #E4ECEA',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Button
          type="text"
          aria-label={collapsed ? 'เปิดเมนู' : 'ซ่อนเมนู'}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed((v) => !v)}
          style={{ fontSize: 18, marginInlineEnd: 12 }}
        />
        <Brand />
        <Space style={{ marginInlineStart: 'auto' }} size="middle">
          {isTech && (
            <Button
              type="text"
              icon={<BellOutlined />}
              onClick={() => setPopupOpen(true)}
            >
              งานวันนี้
            </Button>
          )}
          <span style={{ color: 'rgba(0,0,0,0.75)' }}>
            {user.displayName}{' '}
            <Tag color={isAdmin ? 'gold' : 'cyan'} style={{ marginInlineEnd: 0 }}>
              {isAdmin ? 'ผู้ดูแล' : 'ช่าง'}
            </Tag>
          </span>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            ออกจากระบบ
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider
          width={220}
          theme="light"
          collapsible
          collapsed={collapsed}
          trigger={null}
          collapsedWidth={0}
          breakpoint="lg"
          onBreakpoint={(broken) => setCollapsed(broken)}
          style={{ borderInlineEnd: '1px solid #E4ECEA' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{ height: '100%', borderInlineEnd: 0, paddingTop: 12 }}
          />
        </Sider>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Routes>
            <Route
              path="/"
              element={isAdmin ? <Dashboard /> : <Navigate to="/pm" replace />}
            />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/pm" element={<PmRecord />} />
            <Route path="/reports" element={<Reports />} />
            <Route
              path="/check-items"
              element={
                isAdmin ? <CheckItems /> : <Navigate to="/pm" replace />
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>

      <DailyPmModal open={popupOpen} onClose={() => setPopupOpen(false)} />
    </Layout>
  )
}
