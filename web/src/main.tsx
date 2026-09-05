import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as AntApp, ConfigProvider, type ThemeConfig } from 'antd'
import thTH from 'antd/locale/th_TH'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'

dayjs.locale('th')

// ───────── ธีม Teal / Sage — โทน minimal สบายตา ─────────
// แก้สีทั้งระบบที่จุดเดียว (token = ค่ากลาง, components = ปรับเฉพาะส่วน)
const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2F8F83',
    colorInfo: '#2F8F83',
    colorSuccess: '#4F9D69',
    colorWarning: '#C9952F',
    colorError: '#C05A52',
    colorLink: '#2F8F83',
    borderRadius: 8,
    colorBgLayout: '#F5F8F7',
    colorBorderSecondary: '#E4ECEA',
    fontFamily:
      "'Sarabun', 'Noto Sans Thai', -apple-system, 'Segoe UI', Roboto, Tahoma, sans-serif",
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerColor: 'rgba(0,0,0,0.88)',
      headerHeight: 56,
      bodyBg: '#F5F8F7',
      siderBg: '#FFFFFF',
    },
    Menu: {
      itemSelectedBg: '#E6F2F0',
      itemSelectedColor: '#207067',
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
    Card: {
      borderRadiusLG: 12,
      colorBorderSecondary: '#EAEFEE',
    },
    Table: {
      headerBg: '#F2F6F5',
      headerColor: 'rgba(0,0,0,0.65)',
      headerSplitColor: 'transparent',
      borderColor: '#EEF2F1',
      rowHoverBg: '#F4F9F8',
    },
    Button: {
      controlHeight: 36,
      fontWeight: 500,
    },
    Segmented: {
      itemSelectedBg: '#2F8F83',
      itemSelectedColor: '#FFFFFF',
    },
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={thTH} theme={theme}>
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
