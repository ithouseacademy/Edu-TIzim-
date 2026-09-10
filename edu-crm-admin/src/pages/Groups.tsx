import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Users, Search, Filter, X, ChevronDown } from "lucide-react"
import { api, loadEmployee } from "../api"
import type { AdminGroup } from "../types"
import WaveHeader from "../components/WaveHeader"

const DAY_SHORT: Record<string, string> = {
  dushanba: "Du", seshanba: "Se", chorshanba: "Ch",
  payshanba: "Pa", juma: "Ju", shanba: "Sh", yakshanba: "Ya",
}

const DAYS = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Dars bo'lyapti", bg: "bg-green-50", text: "text-green-600" },
  upcoming: { label: "Kutilmoqda", bg: "bg-[#2001FF]/10", text: "text-[#2001FF]" },
  finished: { label: "O'tib ketdi", bg: "bg-gray-50", text: "text-gray-500" },
  expired: { label: "Muddati tugagan", bg: "bg-red-50", text: "text-red-600" },
}

const AVATAR_COLORS = ["#2001FF", "#2563eb", "#ea580c", "#7c3aed", "#0891b2"]

function formatLessonDisplay(lesson_times: AdminGroup["lesson_times"]): string {
  if (!lesson_times || lesson_times.length === 0) return ""
  return lesson_times
    .map((lt) => {
      const days = lt.days
        .split(",")
        .map((d) => DAY_SHORT[d.trim().toLowerCase()] || d.trim())
        .filter(Boolean)
        .join(",")
      return `${days} ${lt.start_time}-${lt.end_time}`
    })
    .join(" · ")
}

export default function Groups() {
  const nav = useNavigate()
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "aktiv" | "kutilyotgan">("all")
  const [statusOpen, setStatusOpen] = useState(false)
  const [dayFilter, setDayFilter] = useState("all")
  const [dayOpen, setDayOpen] = useState(false)
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [teacherFilter, setTeacherFilter] = useState("all")
  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    api.adminGroups()
      .then((data) => setGroups(data.groups))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.body.classList.toggle("modal-open", dayOpen || teacherOpen || statusOpen)
    return () => document.body.classList.remove("modal-open")
  }, [dayOpen, teacherOpen, statusOpen])

  const teachers = Array.from(new Set(groups.map((g) => g.teacher).filter((t): t is string => !!t))).sort()

  const filtered = groups.filter((g) => {
    if (statusFilter !== "all" && g.status_display !== (statusFilter === "aktiv" ? "Aktiv" : "Kutilmoqda")) return false
    const q = query.trim().toLowerCase()
    if (q && !`${g.name} ${g.course || ""} ${g.teacher || ""}`.toLowerCase().includes(q)) return false
    if (dayFilter !== "all") {
      const hasDay = (g.lesson_times || []).some((lt) =>
        lt.days.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean).includes(dayFilter)
      )
      if (!hasDay) return false
    }
    if (teacherFilter !== "all" && g.teacher !== teacherFilter) return false
    return true
  })

  const chips: { key: typeof statusFilter; label: string; count: number }[] = [
    { key: "all", label: "Barchasi", count: groups.length },
    { key: "aktiv", label: "Aktiv", count: groups.filter((g) => g.status_display === "Aktiv").length },
    { key: "kutilyotgan", label: "Kutilmoqda", count: groups.filter((g) => g.status_display === "Kutilmoqda").length },
  ]

  const hasActiveFilters = query.trim() || dayFilter !== "all" || teacherFilter !== "all"

  const clearFilters = () => {
    setQuery("")
    setDayFilter("all")
    setTeacherFilter("all")
    setStatusFilter("all")
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Guruhlar"
        leftSlot={
          <button className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover">
            <Users size={14} className="text-white" />
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

        <div className="card-premium p-3 mb-3 animate-scale-in">
            <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-lg px-3 focus-within:ring-1.5 ring-[#2001FF]/40 transition-all">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent text-[13px] font-normal outline-none placeholder:text-gray-400 py-2.5"
                placeholder="Nom, kurs yoki ustoz"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500 btn-hover">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="mt-3">
              <p className="text-[11px] text-gray-500 font-semibold mb-1.5">Kun</p>
              <button
                type="button"
                onClick={() => setDayOpen(true)}
                className="w-full h-9 bg-[#F2F2F7] rounded-lg px-3 flex items-center justify-between text-[13px] font-medium text-gray-900 transition-all active:scale-[0.98]"
              >
                <span>
                  {dayFilter === "all" ? "Haftaning barcha kunlari" : `${DAY_SHORT[dayFilter]} kuni`}
                </span>
                <ChevronDown size={15} className="text-gray-400" />
              </button>
            </div>

            {teachers.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] text-gray-500 font-semibold mb-1">O'qituvchi</p>
                <button
                  type="button"
                  onClick={() => setTeacherOpen(true)}
                  className="w-full h-9 bg-[#F2F2F7] rounded-lg px-3 flex items-center justify-between text-[13px] font-medium text-gray-900 transition-all active:scale-[0.98]"
                >
                  <span className="truncate">
                    {teacherFilter === "all" ? "Barcha o'qituvchilar" : teacherFilter}
                  </span>
                  <ChevronDown size={15} className="text-gray-400 shrink-0 ml-2" />
                </button>
              </div>
            )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-semibold text-red-500 h-7 rounded-lg bg-red-50 btn-hover"
            >
              <Filter size={11} /> Filtrlarni tozalash
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setStatusOpen(true)}
          className="w-full h-10 bg-white rounded-xl shadow-sm px-3 flex items-center justify-between text-[13px] font-semibold text-gray-900 mb-3 transition-all active:scale-[0.98]"
        >
          <span>
            {chips.find((c) => c.key === statusFilter)?.label || "Barchasi"} · {chips.find((c) => c.key === statusFilter)?.count || 0}
          </span>
          <ChevronDown size={15} className="text-gray-400 shrink-0 ml-2" />
        </button>

        {loading ? (
          <div className="card-premium p-6 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-premium p-6 text-center">
            <Users size={24} className="mx-auto text-gray-300 mb-1.5" />
            <p className="text-xs font-medium text-gray-400">Guruhlar topilmadi</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-[10px] font-semibold text-[#2001FF]">
                Filtrlarni tozalash
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((g, idx) => {
              const cfg = statusConfig[g.status] || statusConfig.upcoming
              return (
                <div
                  key={g.id}
                  onClick={() => nav(`/groups/${g.id}`)}
                  className="card-premium-sm p-3 animate-scale-in btn-hover active:scale-[0.98] transition-transform cursor-pointer"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${AVATAR_COLORS[idx % AVATAR_COLORS.length]}1A`, color: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                    >
                      <span className="text-xs font-bold">{g.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{g.name}</p>
                      <p className="text-[10px] font-medium text-gray-400">{g.course || "Kurs yo'q"}</p>
                    </div>
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {formatLessonDisplay(g.lesson_times) && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-500">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatLessonDisplay(g.lesson_times)}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <span className="font-bold text-gray-700">{g.student_count} ta</span> o'quvchi
                    </div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[55%]">
                      {g.teacher || g.room ? `${g.teacher || ""}${g.teacher && g.room ? " · " : ""}${g.room ? `${g.room}-xona` : ""}` : ""}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {dayOpen && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={() => setDayOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-premium-lg animate-slide-in-upside safe-bottom">
            <div className="max-w-lg mx-auto">
              <div className="pt-3 pb-1 flex justify-between items-center px-4">
                <div className="w-9 h-1.5 rounded-full bg-gray-200 mx-auto" />
                <button
                  onClick={() => setDayOpen(false)}
                  className="absolute top-3 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center btn-hover"
                >
                  <X size={15} className="text-gray-500" />
                </button>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm font-bold text-gray-900 mb-3 text-center">Hafta kunini tanlang</p>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((d) => {
                    const active = dayFilter === d
                    return (
                      <button
                        key={d}
                        onClick={() => { setDayFilter(active ? "all" : d); setDayOpen(false) }}
                        className={`h-11 rounded-xl text-[12px] font-bold transition-all btn-hover ${
                          active
                            ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/15"
                            : "bg-[#F2F2F7] text-gray-600"
                        }`}
                      >
                        {DAY_SHORT[d]}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => { setDayFilter("all"); setDayOpen(false) }}
                  className={`mt-2.5 w-full h-11 rounded-xl text-[13px] font-bold transition-all btn-hover ${
                    dayFilter === "all"
                      ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/15"
                      : "bg-[#F2F2F7] text-gray-600"
                  }`}
                >
                  Haftaning barchasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {teacherOpen && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={() => setTeacherOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-premium-lg animate-slide-in-upside safe-bottom">
            <div className="max-w-lg mx-auto">
              <div className="pt-3 pb-1 flex justify-between items-center px-4">
                <div className="w-9 h-1.5 rounded-full bg-gray-200 mx-auto" />
                <button
                  onClick={() => setTeacherOpen(false)}
                  className="absolute top-3 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center btn-hover"
                >
                  <X size={15} className="text-gray-500" />
                </button>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm font-bold text-gray-900 mb-3 text-center">O'qituvchini tanlang</p>
                <button
                  onClick={() => { setTeacherFilter("all"); setTeacherOpen(false) }}
                  className={`w-full text-left px-4 py-3 rounded-xl mb-1 text-[13px] font-bold transition-all btn-hover flex items-center justify-between ${
                    teacherFilter === "all"
                      ? "bg-[#2001FF]/5 text-[#2001FF]"
                      : "bg-[#F2F2F7] text-gray-600"
                  }`}
                >
                  Barcha o'qituvchilar
                  {teacherFilter === "all" && <span className="text-[#2001FF]">✓</span>}
                </button>
                <div className="max-h-[50vh] overflow-y-auto space-y-1">
                  {teachers.map((t) => {
                    const active = teacherFilter === t
                    return (
                      <button
                        key={t}
                        onClick={() => { setTeacherFilter(t); setTeacherOpen(false) }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-[13px] font-bold transition-all btn-hover flex items-center justify-between ${
                          active
                            ? "bg-[#2001FF]/5 text-[#2001FF]"
                            : "bg-[#F2F2F7] text-gray-600"
                        }`}
                      >
                        {t}
                        {active && <span className="text-[#2001FF]">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusOpen && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={() => setStatusOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-premium-lg animate-slide-in-upside safe-bottom">
            <div className="max-w-lg mx-auto">
              <div className="pt-3 pb-1 flex justify-between items-center px-4">
                <div className="w-9 h-1.5 rounded-full bg-gray-200 mx-auto" />
                <button
                  onClick={() => setStatusOpen(false)}
                  className="absolute top-3 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center btn-hover"
                >
                  <X size={15} className="text-gray-500" />
                </button>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm font-bold text-gray-900 mb-3 text-center">Holatni tanlang</p>
                <div className="space-y-1">
                  {chips.map((c) => {
                    const active = statusFilter === c.key
                    return (
                      <button
                        key={c.key}
                        onClick={() => { setStatusFilter(c.key); setStatusOpen(false) }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-[13px] font-bold transition-all btn-hover flex items-center justify-between ${
                          active
                            ? "bg-[#2001FF]/5 text-[#2001FF]"
                            : "bg-[#F2F2F7] text-gray-600"
                        }`}
                      >
                        {c.label} · {c.count}
                        {active && <span className="text-[#2001FF]">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
