import { useState, useEffect, useCallback } from "react"
import Login from "./pages/Login"
import TeacherDashboard from "./pages/TeacherDashboard"
import TeacherMyGroups from "./pages/TeacherMyGroups"
import TeacherGroupDetail from "./pages/TeacherGroupDetail"
import TeacherAttendanceDesktop from "./pages/TeacherAttendanceDesktop"
import EmployeeList from "./pages/EmployeeList"
import EmployeeProfile from "./pages/EmployeeProfile"

type Page =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "my-groups" }
  | { name: "group-detail"; groupId: number }
  | { name: "attendance-desktop"; groupId: number }
  | { name: "employee-list" }
  | { name: "employee-profile"; employeeId: number }

function parseHash(): Page | null {
  const hash = window.location.hash.replace("#", "")
  if (!hash || hash === "dashboard") return { name: "dashboard" }
  if (hash === "my-groups") return { name: "my-groups" }
  if (hash === "employee-list") return { name: "employee-list" }
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
    case "group-detail": return `#group-detail/${page.groupId}`
    case "attendance-desktop": return `#attendance-desktop/${page.groupId}`
    case "employee-profile": return `#employee-profile/${page.employeeId}`
    default: return "#dashboard"
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("employee"))

  const isAdmin = localStorage.getItem("is_admin") === "true"
  const isTeacher = localStorage.getItem("is_teacher") === "true"

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
    const teacher = localStorage.getItem("is_teacher") === "true"
    const admin = localStorage.getItem("is_admin") === "true"
    if (teacher) setPage({ name: "dashboard" })
    else if (admin) setPage({ name: "employee-list" })
    else setPage({ name: "dashboard" })
  }

  if (!loggedIn) return <Login onLogin={handleLogin} />

  const currentPage = page.name

  const isTeacherPage = currentPage === "dashboard" || currentPage === "my-groups" || currentPage === "group-detail" || currentPage === "attendance-desktop"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile bottom tab bar for teacher pages */}
      {isTeacherPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex md:hidden safe-area-bottom">
          <button
            onClick={() => setPage({ name: "dashboard" })}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition border-none bg-transparent cursor-pointer ${currentPage === "dashboard" ? "text-[#2001ff]" : "text-gray-400"}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setPage({ name: "my-groups" })}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition border-none bg-transparent cursor-pointer ${currentPage === "my-groups" || currentPage === "group-detail" || currentPage === "attendance-desktop" ? "text-[#2001ff]" : "text-gray-400"}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <span>Guruhlar</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-gray-400 transition border-none bg-transparent cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Chiqish</span>
          </button>
        </nav>
      )}

      {page.name === "dashboard" && (
        <TeacherDashboard
          onSelectGroup={(id) => setPage({ name: "group-detail", groupId: id })}
          onStartLesson={(id) => setPage({ name: "attendance-desktop", groupId: id })}
          onViewAllGroups={() => setPage({ name: "my-groups" })}
        />
      )}

      {page.name === "my-groups" && (
        <TeacherMyGroups
          onSelectGroup={(id) => setPage({ name: "group-detail", groupId: id })}
          onBack={() => setPage({ name: "dashboard" })}
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
    </div>
  )
}
