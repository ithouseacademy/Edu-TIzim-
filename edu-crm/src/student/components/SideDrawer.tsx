import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Home, CalendarDays, BookOpen, Bell, MessageCircle, User,
  ChevronRight, ChevronDown, Building2, Wallet,
} from "lucide-react"
import { api } from "../api"
import { useDrawer } from "../context/DrawerContext"
import { useAppSettings } from "../AppSettings"
import { useMessagingSettings } from "../messaging"
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
  const { tr } = useAppSettings()
  const ms = useMessagingSettings()
  const navigate = useNavigate()
  const [animating, setAnimating] = useState(false)
  const [visible, setVisible] = useState(false)
  const [student, setStudent] = useState<StudentProfile | null>(null)

  const visibleNav = ms && !ms.enabled ? navItems.filter((item) => item.path !== "/messages") : navItems

  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen)
    if (isOpen) setVisible(true)
    else setAnimating(false)
  }

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setAnimating(true))
      api.profile().then((res) => {
        setStudent(res.student)
      }).catch(() => {})
    } else {
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
    : tr("O'quvchi")

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className={`absolute inset-0 drawer-overlay ${animating ? "animate-fade-in" : "animate-fade-out"}`}
        onClick={close}
      />
      <div
        className={`absolute top-0 left-0 h-full bg-white rounded-r-[20px] shadow-premium-lg overflow-hidden flex flex-col ${animating ? "animate-slide-in" : "animate-slide-out"}`}
        style={{ width: "80%" }}
      >
        <div className="drawer-scroll flex-1 overflow-y-auto">
          <div className="px-4 pt-10 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-full flex items-center justify-center shadow-lg shadow-[#2001FF]/20 overflow-hidden">
                  {student?.photo ? (
                    <img src={student.photo} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-white">{initials}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{fullName}</p>
                  {student?.phone && (
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">{student.phone}</p>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{tr("Balans")}</p>
              {student?.balance_str ? (
                <>
                  <p className={`text-xl font-bold mt-0.5 ${(student.balance ?? 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {student.balance_str}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Wallet size={12} className={(student.balance ?? 0) >= 0 ? "text-green-500" : "text-red-500"} />
                    <span className={`text-[11px] font-medium ${(student.balance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(student.balance ?? 0) >= 0 ? tr("To'lov muddati o'tmagan") : tr("Qarzingiz mavjud")}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-lg font-bold text-gray-400 mt-0.5">---</p>
              )}
            </div>
          </div>

          <div className="px-3 space-y-0.5">
            {visibleNav.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className="ripple-btn w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition-all btn-hover"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <item.icon size={15} className="text-gray-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{tr(item.label)}</span>
                </div>
                <ChevronRight size={14} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-6 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50">
            <div className="flex items-center gap-2.5">
              <Building2 size={15} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-700">{tr("Filialni tanlash")}</span>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
