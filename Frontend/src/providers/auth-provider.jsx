"use client"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { deleteAccount, getMe, loginUser, registerUser, logoutUser, updateAccount } from "@/lib/api"
import { useRouter, usePathname } from "next/navigation"

const AuthContext = createContext({})
const SESSION_KEY = "strategyhub.session"
const DEVICE_KEY = "strategyhub.device"
const TRUSTED_DEVICE_KEY = "strategyhub.trustedDevice"

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return ""

  const existing = window.localStorage.getItem(DEVICE_KEY)
  if (existing) return existing

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  window.localStorage.setItem(DEVICE_KEY, id)
  return id
}

function persistSession(user) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      userId: user.id,
      email: user.email,
      deviceId: getOrCreateDeviceId(),
      signedInAt: new Date().toISOString()
    })
  )
}

function clearSessionMarker() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(SESSION_KEY)
  window.localStorage.removeItem(TRUSTED_DEVICE_KEY)
  window.document.cookie = "token=; Max-Age=0; path=/"
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isBooting, setIsBooting] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const logoutInProgressRef = useRef(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let active = true
    async function bootstrapAuth() {
      if (logoutInProgressRef.current) {
        setUser(null)
        setIsBooting(false)
        return
      }

      try {
        const data = await getMe()
        if (active) {
          const nextUser = data.user ?? null
          setUser(nextUser)
          if (nextUser) persistSession(nextUser)
        }
      } catch {
        if (active) {
          setUser(null)
          clearSessionMarker()
        }
      } finally {
        if (active) setIsBooting(false)
      }
    }
    bootstrapAuth()
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    if (!isBooting && !user && pathname?.startsWith('/dashboard') && !logoutInProgressRef.current) {
      router.replace('/login')
    }

    if (!isBooting && user && (pathname === '/login' || pathname === '/register')) {
      router.push('/dashboard')
    }
  }, [isBooting, user, pathname, router])

  async function register(credentials) {
    setIsLoading(true)
    try {
      const data = await registerUser(credentials)
      logoutInProgressRef.current = false
      setUser(data.user)
      persistSession(data.user)
      router.push('/dashboard')
      return data
    } finally {
      setIsLoading(false)
    }
  }

  async function login(credentials) {
    setIsLoading(true)
    try {
      const data = await loginUser(credentials)
      logoutInProgressRef.current = false
      setUser(data.user)
      persistSession(data.user)
      router.push('/dashboard')
      return data
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    logoutInProgressRef.current = true
    setUser(null)
    clearSessionMarker()
    setIsLoading(false)
    router.replace('/')
    router.refresh()
    logoutUser().finally(() => {
      logoutInProgressRef.current = false
    }).catch(() => {})
  }

  async function deleteCurrentAccount() {
    setIsLoading(true)
    try {
      await deleteAccount()
      setUser(null)
      clearSessionMarker()
      router.replace('/')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  async function updateCurrentAccount(payload) {
    setIsLoading(true)
    try {
      const data = await updateAccount(payload)
      setUser(data.user)
      persistSession(data.user)
      return data
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isBooting, isLoading, login, register, logout, updateCurrentAccount, deleteCurrentAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
