import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Home, CalendarDays, BookOpen, Bell, MessageCircle, User,
  ChevronRight, ChevronDown, Building2, Wallet,
} from "lucide-react"
import { api } from "../api"
import { useDrawer } from "../context/DrawerContext"
import type { StudentProfile } from "../types"

const navItems = [
  { icon: Home, label: "Bosh sahifa", path: "/home" },
  { icon: CalendarDays, label: "Dars jadvali", path: "/schedule" },
  { icon: BookOpen, label: "Uy vazifalari", path: "/homework" },
  { icon: Bell, label: "Bildirishnomalar", path: "/notifications" },
  { icon: MessageCircle, label: "Xabarlar", path: "/messages" },
  { icon: User, label: "Profil", path: "/profile" },
]

export default function SideDrawer() {
  const { isOpen, close } = useDrawer()
  const navigate = useNavigate()
  const [animating, setAnimating] = useState(false)
  const [visible, setVisible] = useState(false)
  const [student, setStudent] = useState<StudentProfile | null>(null)

  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      requestAnimationFrame(() => setAnimating(true))
      api.profile().then((res) => {
        setStudent(res.student)
      }).catch(() => {})
    } else {
      setAnimating(false)
      const timer = setTimeout(() => setVisible(false), 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleNav = (path: string) => {
    close()
    navigate(path)
  }

  const initials = student
    ? ((student.first_name?.charAt(0) || "") + (student.last_name?.charAt(0) || "")).toUpperCase()
    : "O"

  const fullName = student
    ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
    : "O'quvchi"

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className={`absolute inset-0 drawer-overlay ${animating ? "animate-fade-in" : "animate-fade-out"}`}
        onClick={close}
      />
      <div
        className={`absolute top-0 left-0 h-full bg-white rounded-r-[24px] shadow-premium-lg overflow-hidden flex flex-col ${animating ? "animate-slide-in" : "animate-slide-out"}`}
        style={{ width: "82%" }}
      >
        <div className="drawer-scroll flex-1 overflow-y-auto">
          <div className="px-5 pt-14 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-full flex items-center justify-center shadow-lg shadow-[#2001FF]/20">
                  <span className="text-xl font-bold text-white">{initials}</span>
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{fullName}</p>
                  {student?.phone && (
                    <p className="text-xs text-gray-400 font-medium mt-0.5">{student.phone}</p>
                  )}
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Balans</p>
              {student?.balance_str ? (
                <>
                  <p className={`text-2xl font-bold mt-1 ${(student.balance ?? 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {student.balance_str}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Wallet size={14} className={(student.balance ?? 0) >= 0 ? "text-green-500" : "text-red-500"} />
                    <span className={`text-xs font-medium ${(student.balance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(student.balance ?? 0) >= 0 ? "To'lov muddati o'tmagan" : "Qarzingiz mavjud"}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xl font-bold text-gray-400 mt-1">---</p>
              )}
            </div>
          </div>

          <div className="px-3 space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className="ripple-btn w-full flex items-center justify-between px-4 py-3.5 rounded-2xl hover:bg-gray-50 transition-all btn-hover"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                    <item.icon size={18} className="text-gray-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-8 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gray-50">
            <div className="flex items-center gap-3">
              <Building2 size={18} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filialni tanlash</span>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
