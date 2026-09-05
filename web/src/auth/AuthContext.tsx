import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  apiLogout,
  fetchMe,
  login as apiLogin,
  TOKEN_KEY,
  type AuthUser,
} from '../api/client'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // เปิดเว็บมา: ถ้ามี token เดิม ลอง restore session
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      // ไม่มี token → จบ loading ทันที (ตั้งใจ — restore session pattern)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const { token, user } = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
  }

  function logout() {
    // เรียกก่อนล้าง token เพื่อให้ backend บันทึก log ออกจากระบบได้ (best-effort)
    apiLogout()
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth ต้องอยู่ใน <AuthProvider>')
  return ctx
}
