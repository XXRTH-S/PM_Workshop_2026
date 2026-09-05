import { ToolOutlined } from '@ant-design/icons'

/** โลโก้/ชื่อระบบ — ใช้ซ้ำที่ Header และหน้า Login ให้เป็นเอกลักษณ์เดียวกัน */
export default function Brand({
  size = 'header',
}: {
  size?: 'header' | 'large'
}) {
  const large = size === 'large'
  const box = large ? 48 : 34
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: large ? 14 : 10 }}>
      <div
        style={{
          width: box,
          height: box,
          borderRadius: large ? 14 : 10,
          background: 'linear-gradient(135deg, #2F8F83 0%, #4F9D69 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: large ? 24 : 18,
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(47,143,131,0.28)',
        }}
      >
        <ToolOutlined />
      </div>
      <div style={{ lineHeight: 1.15 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: large ? 20 : 16,
            color: 'rgba(0,0,0,0.88)',
            whiteSpace: 'nowrap',
          }}
        >
          ระบบบำรุงรักษาเชิงป้องกัน
        </div>
        <div
          style={{
            fontSize: large ? 13 : 11,
            color: '#6E827D',
            letterSpacing: 0.3,
          }}
        >
          Preventive Maintenance
        </div>
      </div>
    </div>
  )
}
