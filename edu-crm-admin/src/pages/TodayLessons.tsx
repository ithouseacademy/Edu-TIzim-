import { useState, useEffect } from "react"
import {
  BookOpen, Clock, MapPin, Users, Menu, LogOut,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api, loadEmployee, clearSession } from "../api"
import type { DashboardGroup } from "../types"
import WaveHeader from "../components/WaveHeader"

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Dars bo'lyapti", bg: "bg-green-50", text: "text-green-600" },
  upcoming: { label: "Kutilmoqda", bg: "bg-[#2001FF]/10", text: "text-[#2001FF]" },
  finished: { label: "O'tib ketdi", bg: "bg-gray-50", text: "text-gray-500" },
  expired: { label: "Muddati tugagan", bg: "bg-red-50", text: "text-red-600" },
}

const AVATAR_COLORS = ["#2001FF", "#2563eb", "#ea580c", "#7c3aed", "#0891b2"]

export default function TodayLessons() {
  const nav = useNavigate()
  const [groups, setGroups] = useState<DashboardGroup[]>([])
  const [todayDisplay, setTodayDisplay] = useState("")
  const [stats, setStats] = useState({ total_groups: 0, today_count: 0, active_count: 0, total_students: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)

  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    api.teacherDashboard(undefined, today)
      .then((data) => {
        setGroups(data.groups)
        setTodayDisplay(data.today_display)
        setStats({ total_groups: data.total_groups, today_count: data.today_count, active_count: data.active_count, total_students: data.total_students })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const todayGroups = groups.filter((g) =>
    g.status !== "expired" &&
    g.status !== "finished" &&
    g.status_display !== "O'tib ketdi" &&
    g.status_display !== "Muddati tugagan"
  )

  const handleLogout = async () => {
    try { await api.logout() } catch {}
    clearSession()
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Bugungi darslar"
        subtitle={todayDisplay}
        leftSlot={
          <button
            onClick={() => setMenuOpen(true)}
            className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover"
          >
            <Menu size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />
      <div className="max-w-lg mx-auto px-3">

        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium mb-3">{error}</div>
        )}

        <section className="mb-3 animate-scale-in">
          <div className="card-premium p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-[#2001FF] rounded-xl flex items-center justify-center shadow-md shadow-[#2001FF]/15 shrink-0">
                <span className="text-sm font-bold text-white">{initials || "A"}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-400">{todayDisplay}</p>
                <p className="text-[13px] font-bold text-gray-900 leading-tight truncate">{emp?.first_name} {emp?.last_name}</p>
                <p className="text-[10px] font-medium text-gray-400">{emp?.position?.name || emp?.role?.name || "Admin"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-base font-bold text-gray-900">{stats.today_count}</p>
                <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Bugungi</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-base font-bold text-gray-900">{stats.active_count}</p>
                <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Davom etmoqda</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-base font-bold text-gray-900">{stats.total_students}</p>
                <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">O'quvchilar</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-3">
          <h2 className="text-xs font-bold text-gray-900 mb-2">Bugungi darslar</h2>
          {loading ? (
            <div className="card-premium p-6 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
            </div>
          ) : todayGroups.length === 0 ? (
            <div className="card-premium p-6 text-center">
              <BookOpen size={24} className="mx-auto text-gray-300 mb-1.5" />
              <p className="text-xs font-medium text-gray-400">Bugun darslar yo'q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayGroups.map((g, idx) => {
                const cfg = statusConfig[g.status] || statusConfig.upcoming
                return (
                  <div
                    key={g.id}
                    onClick={() => nav(`/groups/${g.id}`)}
                    className="card-premium p-3 animate-scale-in btn-hover active:scale-[0.98] cursor-pointer transition-transform"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${AVATAR_COLORS[idx % AVATAR_COLORS.length]}1A`, color: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                        >
                          <BookOpen size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 truncate">{g.name}</p>
                          <p className="text-[10px] font-medium text-gray-400 truncate">{g.course || "Kurs belgilanmagan"}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-2 min-w-0">
                        <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center shadow-sm shrink-0">
                          <Clock size={11} className="text-[#2001FF]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Vaqt</p>
                          <p className="text-[11px] font-bold text-gray-900 truncate">{g.lesson_display || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-2 min-w-0">
                        <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center shadow-sm shrink-0">
                          <Users size={11} className="text-[#2001FF]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">O'quvchilar</p>
                          <p className="text-[11px] font-bold text-gray-900">{g.student_count} ta</p>
                        </div>
                      </div>
                    </div>

                    {g.room && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-500">
                        <MapPin size={10} className="text-gray-400" />
                        {g.room}-xona
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 drawer-overlay animate-fade-in" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 left-0 h-full bg-white rounded-r-[20px] shadow-premium-lg overflow-hidden flex flex-col animate-slide-in" style={{ width: "78%" }}>
            <div className="drawer-scroll flex-1 overflow-y-auto">
              <div className="px-4 pt-12 pb-3">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-full flex items-center justify-center shadow-md shadow-[#2001FF]/15">
                    <span className="text-base font-bold text-white">{initials || "A"}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{emp?.first_name} {emp?.last_name}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{emp?.phone || ""}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Balans</p>
                  <p className="text-lg font-bold mt-0.5 text-gray-900">
                    {(emp?.teacher_balance ?? 0).toLocaleString() || 0} so'm
                  </p>
                </div>
              </div>
              <div className="px-2.5 space-y-0.5">
                <button
                  onClick={handleLogout}
                  className="ripple-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-all btn-hover text-red-500"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <LogOut size={16} className="text-red-500" />
                  </div>
                  <span className="text-xs font-semibold">Chiqish</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
