import { useState, useEffect, useCallback } from "react"
import { Home, Users, Wallet, User, CheckSquare } from "lucide-react"
import Login from "./pages/Login"
import TeacherDashboard from "./pages/TeacherDashboard"
import TeacherMyGroups from "./pages/TeacherMyGroups"
import TeacherGroupDetail from "./pages/TeacherGroupDetail"
import TeacherAttendanceDesktop from "./pages/TeacherAttendanceDesktop"
import EmployeeList from "./pages/EmployeeList"
import EmployeeProfile from "./pages/EmployeeProfile"
import Salary from "./pages/Salary"
import Tasks from "./pages/Tasks"
import Profile from "./pages/Profile"
import ChangePassword from "./pages/ChangePassword"
import { api } from "./api"
import { enablePush, syncExistingPush, currentPushEnabled, type PushEnabled } from "./push"

type Page =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "my-groups" }
  | { name: "group-detail"; groupId: number }
  | { name: "attendance-desktop"; groupId: number }
  | { name: "employee-list" }
  | { name: "employee-profile"; employeeId: number }
  | { name: "salary" }
  | { name: "tasks" }
  | { name: "profile" }
  | { name: "change-password" }

const teacherTabs = [
  { key: "dashboard", icon: Home, label: "Dashboard" },
  { key: "my-groups", icon: Users, label: "Guruhlar" },
  { key: "salary", icon: Wallet, label: "Oylik" },
  { key: "tasks", icon: CheckSquare, label: "Topshiriq" },
  { key: "profile", icon: User, label: "Profil" },
]

function parseHash(): Page | null {
  const hash = window.location.hash.replace("#", "")
  if (!hash || hash === "dashboard") return { name: "dashboard" }
  if (hash === "my-groups") return { name: "my-groups" }
  if (hash === "employee-list") return { name: "employee-list" }
  if (hash === "salary") return { name: "salary" }
  if (hash === "tasks") return { name: "tasks" }
  if (hash === "profile") return { name: "profile" }
  if (hash === "change-password") return { name: "change-password" }
  const groupMatch = hash.match(/^group-detail\/(\d+)$/)
  if (groupMatch) return { name: "group-detail", groupId: parseInt(groupMatch[1]) }
  const attMatch = hash.match(/^attendance-desktop\/(\d+)$/)
  if (attMatch) return { name: "attendance-desktop", groupId: parseInt(attMatch[1]) }
  const empMatch = hash.match(/^employee-profile\/(\d+)$/)
  if (empMatch) return { name: "employee-profile", employeeId: parseInt(empMatch[1]) }
  return null
}

function hashForPage(page: Page): string {
  switch (page.name) {
    case "dashboard": return "#dashboard"
    case "my-groups": return "#my-groups"
    case "employee-list": return "#employee-list"
    case "salary": return "#salary"
    case "tasks": return "#tasks"
    case "profile": return "#profile"
    case "change-password": return "#change-password"
    case "group-detail": return `#group-detail/${page.groupId}`
    case "attendance-desktop": return `#attendance-desktop/${page.groupId}`
    case "employee-profile": return `#employee-profile/${page.employeeId}`
    default: return "#dashboard"
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("employee"))
  const [notifCount, setNotifCount] = useState(0)
  const [pushEnabled, setPushEnabled] = useState<PushEnabled | "checking">("checking")
  const [isEnablingPush, setIsEnablingPush] = useState(false)

  const isAdmin = localStorage.getItem("is_admin") === "true"
  const isTeacher = localStorage.getItem("is_teacher") === "true"

  const refreshNotifications = useCallback(async () => {
    try {
      const d = await api.notifications()
      setNotifCount(d.total)
    } catch {}
  }, [])

  const [page, setPageState] = useState<Page>(() => {
    const fromHash = parseHash()
    if (fromHash) return fromHash
    if (isTeacher) return { name: "dashboard" }
    if (isAdmin) return { name: "employee-list" }
    return { name: "dashboard" }
  })

  const setPage = useCallback((p: Page) => {
    setPageState(p)
    window.location.hash = hashForPage(p)
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const fromHash = parseHash()
      if (fromHash) setPageState(fromHash)
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const handleLogout = async () => {
    try { await fetch("/api/employee/logout/", { method: "POST", credentials: "include" }) } catch {}
    localStorage.removeItem("employee")
    localStorage.removeItem("is_admin")
    localStorage.removeItem("is_teacher")
    setLoggedIn(false)
    window.location.hash = ""
  }

  const handleLogin = () => {
    setLoggedIn(true)
    refreshNotifications()
    const teacher = localStorage.getItem("is_teacher") === "true"
    const admin = localStorage.getItem("is_admin") === "true"
    if (teacher) setPage({ name: "dashboard" })
    else if (admin) setPage({ name: "employee-list" })
    else setPage({ name: "dashboard" })
  }

  useEffect(() => {
    if (loggedIn) {
      refreshNotifications()
      setPushEnabled(currentPushEnabled())
      syncExistingPush().then(() => setPushEnabled(currentPushEnabled()))
      const interval = setInterval(refreshNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [loggedIn, refreshNotifications])

  useEffect(() => {
    if (page.name === "tasks") {
      api.markNotificationsSeen().then(() => refreshNotifications())
    }
  }, [page.name, refreshNotifications])

  const handleEnablePush = async () => {
    if (isEnablingPush) return
    setIsEnablingPush(true)
    try {
      const on = await enablePush()
      setPushEnabled(on ? "on" : currentPushEnabled())
      if (on) refreshNotifications()
    } finally {
      setIsEnablingPush(false)
    }
  }

  if (!loggedIn) return <Login onLogin={handleLogin} />

  const currentPage = page.name
  const isTeacherPage = currentPage === "dashboard" || currentPage === "my-groups" || currentPage === "group-detail" || currentPage === "attendance-desktop" || currentPage === "salary" || currentPage === "tasks" || currentPage === "profile" || currentPage === "change-password"

  const activeIndex = teacherTabs.findIndex((t) => {
    if (currentPage === t.key) return true
    if (t.key === "my-groups" && (currentPage === "group-detail" || currentPage === "attendance-desktop")) return true
    return false
  })

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Push notification banner */}
      {(pushEnabled === "off" || pushEnabled === "denied") && (
        <div className="bg-[#2001FF] text-white text-sm px-4 py-2.5 flex flex-wrap items-center justify-center gap-3">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.66V4a2 2 0 10-4 0v1.34A6 6 0 006 11v3.2c0 .53-.21 1.04-.59 1.41L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {pushEnabled === "denied" ? (
              <span>Bildirishnomalar bloklangan. Brauzer sozlamalaridan ruxsat bering.</span>
            ) : (
              <span>Yangi topshiriq va eslatmalar haqida darhol xabar olish uchun bildirishnomalarni yoqing.</span>
            )}
          </span>
          {pushEnabled === "off" && (
            <button
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="px-4 py-1.5 rounded-lg bg-white text-[#2001FF] text-sm font-semibold hover:bg-blue-50 transition border-none cursor-pointer disabled:opacity-60"
            >
              {isEnablingPush ? "So'ralmoqda…" : "Ruxsat berish"}
            </button>
          )}
        </div>
      )}

      {/* iOS-style bottom tab bar — faqat mobil */}
      {isTeacherPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none bottom-nav md:hidden">
          <div className="max-w-lg mx-auto px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-0.5 pointer-events-auto animate-page-enter">
            <div className="bg-white/90 backdrop-blur-2xl rounded-[20px] shadow-lg shadow-[#2001FF]/10 border border-[#2001FF]/20 px-1.5 py-1">
              <div className="relative">
                <div className="flex items-center">
                  {teacherTabs.map((tab) => {
                    const active = currentPage === tab.key || (tab.key === "my-groups" && (currentPage === "group-detail" || currentPage === "attendance-desktop"))
                    return (
                      <button
                        key={tab.key}
                        onClick={() => {
                          if (tab.key === "tasks") setPage({ name: "tasks" })
                          else if (tab.key === "profile") setPage({ name: "profile" })
                          else if (tab.key === "my-groups") setPage({ name: "my-groups" })
                          else if (tab.key === "dashboard") setPage({ name: "dashboard" })
                          else if (tab.key === "salary") setPage({ name: "salary" })
                        }}
                        className="relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-200 btn-hover bg-transparent border-none cursor-pointer"
                      >
                        <span className="relative">
                          <tab.icon
                            size={19}
                            strokeWidth={active ? 2.2 : 1.6}
                            className={`transition-all duration-300 ${active ? "text-[#2001FF]" : "text-gray-400"}`}
                          />
                          {tab.key === "tasks" && notifCount > 0 && (
                            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-badge-pulse">
                              {notifCount}
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-[8px] font-semibold leading-none transition-all duration-300 ${
                            active ? "text-[#2001FF]" : "text-gray-400"
                          }`}
                        >
                          {tab.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div
                  className="absolute inset-y-0 z-0 bg-[#2001FF]/15 rounded-full pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ width: `${100 / teacherTabs.length}%`, transform: `translateX(${Math.max(0, activeIndex) * 100}%)` }}
                />
              </div>
            </div>
          </div>
        </nav>
      )}

      {page.name === "dashboard" && (
        <TeacherDashboard
          onSelectGroup={(id) => setPage({ name: "group-detail", groupId: id })}
          onStartLesson={(id) => setPage({ name: "attendance-desktop", groupId: id })}
          onViewAllGroups={() => setPage({ name: "my-groups" })}
          onViewSalary={() => setPage({ name: "salary" })}
          onViewTasks={() => setPage({ name: "tasks" })}
          notifCount={notifCount}
        />
      )}

      {page.name === "my-groups" && (
        <TeacherMyGroups
          onSelectGroup={(id) => setPage({ name: "group-detail", groupId: id })}
          onBack={() => setPage({ name: "dashboard" })}
        />
      )}

      {page.name === "salary" && (
        <Salary
          onBack={() => setPage({ name: "dashboard" })}
          onViewAllGroups={() => setPage({ name: "my-groups" })}
          onViewTasks={() => setPage({ name: "tasks" })}
        />
      )}

      {page.name === "tasks" && (
        <Tasks
          onBack={() => setPage({ name: "dashboard" })}
          onNotify={refreshNotifications}
          notifCount={notifCount}
        />
      )}

      {page.name === "group-detail" && (
        <TeacherGroupDetail
          id={page.groupId}
          onBack={() => setPage({ name: "dashboard" })}
          onAttendance={(groupId) => setPage({ name: "attendance-desktop", groupId })}
        />
      )}

      {page.name === "attendance-desktop" && (
        <TeacherAttendanceDesktop
          groupId={page.groupId}
          onBack={() => setPage({ name: "group-detail", groupId: page.groupId })}
        />
      )}

      {page.name === "employee-list" && isAdmin && (
        <EmployeeList
          onSelect={(id) => {
            if (id === 0) {
              window.location.href = "/employees/create/"
              return
            }
            setPage({ name: "employee-profile", employeeId: id })
          }}
        />
      )}

      {page.name === "employee-profile" && isAdmin && (
        <EmployeeProfile
          id={page.employeeId}
          onBack={() => setPage({ name: "employee-list" })}
        />
      )}

      {page.name === "profile" && (
        <Profile
          onNavigate={(p) => {
            if (p === "salary") setPage({ name: "salary" })
            else if (p === "change-password") setPage({ name: "change-password" })
          }}
          onLogout={handleLogout}
        />
      )}

      {page.name === "change-password" && (
        <ChangePassword onBack={() => setPage({ name: "profile" })} />
      )}
    </div>
  )
}
