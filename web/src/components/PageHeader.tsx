import type { ReactNode } from 'react'
import { Typography } from 'antd'

const { Title, Text } = Typography

/** หัวหน้าจอมาตรฐาน — ทุกหน้าใช้รูปแบบเดียวกัน (ชื่อ + คำอธิบายช่วยผู้ใช้ + ปุ่ม) */
export default function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 20,
      }}
    >
      <div>
        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
          {title}
        </Title>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            {subtitle}
          </Text>
        )}
      </div>
      {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
    </div>
  )
}
