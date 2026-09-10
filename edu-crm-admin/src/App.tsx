import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Home, Users, Wallet, User, GraduationCap } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import Login from "./pages/Login"
import TodayLessons from "./pages/TodayLessons"
import Groups from "./pages/Groups"
import Payments from "./pages/Payments"
import Students from "./pages/Students"
import StudentDetail from "./pages/StudentDetail"
import StudentInfo from "./pages/student/StudentInfo"
import StudentGroups from "./pages/student/StudentGroups"
import StudentDebt from "./pages/student/StudentDebt"
import StudentAttendance from "./pages/student/StudentAttendance"
import StudentPayments from "./pages/student/StudentPayments"
import StudentSms from "./pages/student/StudentSms"
import StudentLogs from "./pages/student/StudentLogs"
import BalancePage from "./pages/BalancePage"
import Profile from "./pages/Profile"
import ChangePassword from "./pages/ChangePassword"
import GroupDetail from "./pages/GroupDetail"
import { loadEmployee } from "./api"

const tabs = [
  { icon: Home, label: "Bugungi", path: "/today" },
  { icon: Users, label: "Guruhlar", path: "/groups" },
  { icon: Wallet, label: "To'lovlar", path: "/payments" },
  { icon: GraduationCap, label: "O'quvchilar", path: "/students" },
  { icon: User, label: "Profil", path: "/profile" },
]

function BottomNav() {
  const location = useLocation()
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => location.pathname === t.path)
  )
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none bottom-nav">
      <div className="max-w-lg mx-auto px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-0.5 pointer-events-auto animate-page-enter">
        <div className="bg-white/90 backdrop-blur-2xl rounded-[20px] shadow-lg shadow-[#2001FF]/10 border border-[#2001FF]/20 px-1.5 py-1">
          <div className="relative">
            <div className="flex items-center">
              {tabs.map((tab) => {
                const active = location.pathname === tab.path
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className="relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-200 btn-hover"
                  >
                    <tab.icon
                      size={19}
                      strokeWidth={active ? 2.2 : 1.6}
                      className={`transition-all duration-300 ${active ? "text-[#2001FF]" : "text-gray-400"}`}
                    />
                    <span
                      className={`text-[8px] font-semibold leading-none transition-all duration-300 ${
                        active ? "text-[#2001FF]" : "text-gray-400"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </Link>
                )
              })}
            </div>
            <div
              className="absolute inset-y-0 z-0 bg-[#2001FF]/15 rounded-full pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ width: `${100 / tabs.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}

function ProtectedLayout({ children }: { children: ReactNode }) {
  const emp = loadEmployee()
  if (!emp) return <Navigate to="/login" replace />
  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {children}
      <BottomNav />
    </div>
  )
}

export default function App() {
  const emp = loadEmployee()
  const first = emp ? "/today" : "/login"
  return (
    <BrowserRouter>
      <Routes>
      <Route path="/" element={<Navigate to={first} replace />} />
      <Route path="/login" element={emp ? <Navigate to="/today" replace /> : <Login />} />
      <Route
        path="/today"
        element={
          <ProtectedLayout>
            <TodayLessons />
          </ProtectedLayout>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedLayout>
            <Groups />
          </ProtectedLayout>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedLayout>
            <GroupDetail />
          </ProtectedLayout>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedLayout>
            <Payments />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedLayout>
            <Students />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id"
        element={
          <ProtectedLayout>
            <StudentDetail />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/info"
        element={
          <ProtectedLayout>
            <StudentInfo />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/groups"
        element={
          <ProtectedLayout>
            <StudentGroups />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/debt"
        element={
          <ProtectedLayout>
            <StudentDebt />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/attendance"
        element={
          <ProtectedLayout>
            <StudentAttendance />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/payments"
        element={
          <ProtectedLayout>
            <StudentPayments />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/sms"
        element={
          <ProtectedLayout>
            <StudentSms />
          </ProtectedLayout>
        }
      />
      <Route
        path="/students/:id/logs"
        element={
          <ProtectedLayout>
            <StudentLogs />
          </ProtectedLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedLayout>
            <Profile />
          </ProtectedLayout>
        }
      />
      <Route
        path="/profile/balance"
        element={
          <ProtectedLayout>
            <BalancePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedLayout>
            <ChangePassword />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to={first} replace />} />
      </Routes>
    </BrowserRouter>
  )
}