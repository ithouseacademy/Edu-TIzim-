import { useEffect, useState } from "react"
import { api } from "../api"
import type { TeacherGroup } from "../types"
import DesktopShell from "../components/DesktopShell"

const DAY_SHORT: Record<string, string> = {
  dushanba: "Du", seshanba: "Se", chorshanba: "Ch",
  payshanba: "Pa", juma: "Ju", shanba: "Sh", yakshanba: "Ya",
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    </svg>
  )
}

function formatLessonDisplay(lesson_times: TeacherGroup["lesson_times"]): string {
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
    .join("; ")
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return { label: "Dars bo'lyapti", cls: "bg-blue-50 text-[#2001ff]" }
    case "upcoming":
      return { label: "Kutilmoqda", cls: "bg-orange-50 text-[#ea580c]" }
    case "finished":
      return { label: "O'tib ketdi", cls: "bg-gray-100 text-gray-500" }
    case "expired":
      return { label: "Muddati tugagan", cls: "bg-red-50 text-red-600" }
    default:
      return { label: "Kutilmoqda", cls: "bg-gray-100 text-gray-500" }
  }
}

const STATUS_FILTERS = [
  { key: "all", label: "Barcha" },
  { key: "active", label: "Dars bo'lyapti" },
  { key: "upcoming", label: "Kutilmoqda" },
  { key: "finished", label: "O'tib ketdi" },
  { key: "expired", label: "Muddati tugagan" },
]

const DAY_OPTIONS = [
  { value: "", label: "Barcha kunlar" },
  { value: "dushanba", label: "Dushanba" },
  { value: "seshanba", label: "Seshanba" },
  { value: "chorshanba", label: "Chorshanba" },
  { value: "payshanba", label: "Payshanba" },
  { value: "juma", label: "Juma" },
  { value: "shanba", label: "Shanba" },
  { value: "yakshanba", label: "Yakshanba" },
]

export default function TeacherMyGroups({ onSelectGroup, onBack }: { onSelectGroup: (id: number) => void; onBack: () => void }) {
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dayFilter, setDayFilter] = useState("")
  const [timeFilter, setTimeFilter] = useState("")

  useEffect(() => {
    setLoading(true)
    setError("")
    api.myGroups()
      .then((data) => setGroups(data.groups))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const timeOptions = [...new Set(
    groups
      .flatMap((g) => (g.lesson_times || []).map((lt) => lt.start_time))
      .filter(Boolean),
  )].sort()

  const filteredGroups = groups.filter((g) => {
    const q = query.trim().toLowerCase()
    const okQuery = !q || [g.name, g.course || "", g.room || ""].some((v) => v.toLowerCase().includes(q))
    const okStatus = statusFilter === "all" || g.status === statusFilter
    const okDay = !dayFilter || (g.lesson_times || []).some((lt) =>
      lt.days.split(",").map((d) => d.trim().toLowerCase()).includes(dayFilter),
    )
    const okTime = !timeFilter || (g.lesson_times || []).some((lt) => lt.start_time === timeFilter)
    return okQuery && okStatus && okDay && okTime
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Yuklanmoqda...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl text-sm">{error}</div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden">
        <div className="min-h-screen bg-[#F8F9FC] max-w-[480px] mx-auto flex flex-col">
          <header className="relative bg-gradient-to-b from-[#3E37FF] via-[#2001FF] to-[#1B00E0] text-white sticky top-0 z-20 shadow-md shadow-[#2001FF]/20">
            <div className="relative px-4 pt-2 pb-3">
              <div className="flex items-center justify-between gap-2">
                <button onClick={onBack} className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover shrink-0">
                  <BackIcon className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="flex-1 text-center min-w-0">
                  <h1 className="text-[13px] font-bold leading-tight truncate">Mening guruhlarim</h1>
                  <p className="text-[9px] font-medium text-white/65 mt-px truncate">{groups.length} ta guruh</p>
                </div>
                <div className="w-7 shrink-0" />
              </div>
            </div>
          </header>

          <div className="px-3 pt-3 flex flex-col gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Guruh nomi bo'yicha qidirish..."
              className="w-full px-3.5 py-2.5 text-[13px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900 focus:border-[#2001FF]"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer border ${
                    statusFilter === f.key
                      ? "bg-[#2001FF] text-white border-[#2001FF]"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="flex-1 px-3 py-2.5 text-[13px] font-medium bg-white border border-gray-200 rounded-xl outline-none text-gray-800"
              >
                {DAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="flex-1 px-3 py-2.5 text-[13px] font-medium bg-white border border-gray-200 rounded-xl outline-none text-gray-800"
              >
                <option value="">Barcha vaqtlar</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 px-3 pt-3 pb-28 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="text-center py-16 animate-scale-in">
                <FolderIcon className="w-14 h-14 text-[#2001FF] opacity-20 mx-auto mb-4" />
                <h3 className="text-[17px] text-[#1a1a2e] mb-1.5">Guruhlar topilmadi</h3>
                <p className="text-[12px] text-gray-400">Sizga biriktirilgan guruhlar mavjud emas</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-16 animate-scale-in">
                <FolderIcon className="w-14 h-14 text-[#2001FF] opacity-20 mx-auto mb-4" />
                <h3 className="text-[17px] text-[#1a1a2e] mb-1.5">Hech narsa topilmadi</h3>
                <p className="text-[12px] text-gray-400">Qidiruv yoki filtrga mos guruh yo'q</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredGroups.map((g, idx) => {
                  const expired = g.status === "expired"
                  const badge = getStatusBadge(g.status)
                  const lessonDisplay = formatLessonDisplay(g.lesson_times)
                  return (
                    <div key={g.id} className={`card-premium overflow-hidden animate-page-enter ${expired ? "opacity-60" : ""}`} style={{ animationDelay: `${idx * 40}ms` }}>
                      {expired ? (
                        <div className="px-3.5 pt-3 pb-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-bold text-[14px] text-[#1a1a2e]">{g.name}</div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 gap-x-4">
                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                              <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                              <ClockIcon className="w-3 h-3 text-[#2001FF]" />
                              <span className="font-medium text-[#1a1a2e]">{lessonDisplay || "—"}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center gap-1.5">
                            <BanIcon className="w-3 h-3 text-red-600 shrink-0" />
                            <span>Muddati tugagan · <strong>{g.student_count}</strong> ta o'quvchi</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectGroup(g.id)}
                          className="block w-full text-left px-3.5 pt-3 pb-2.5 bg-transparent cursor-pointer border-none"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-bold text-[14px] text-[#1a1a2e]">{g.name}</div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 gap-x-4">
                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                              <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                              <ClockIcon className="w-3 h-3 text-[#2001FF]" />
                              <span className="font-medium text-[#1a1a2e]">{lessonDisplay || "Vaqt belgilanmagan"}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center gap-1.5">
                            <UsersIcon className="w-3 h-3 text-[#2001FF] shrink-0" />
                            <span><strong>{g.student_count}</strong> ta o'quvchi</span>
                          </div>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <DesktopShell
        activeKey="groups"
        navItems={[
          { key: "dashboard", label: "Dashboard", icon: null, onClick: () => (window.location.hash = "#dashboard") },
          { key: "groups", label: "Mening guruhlarim", icon: null, onClick: () => {} },
          { key: "salary", label: "Mening oyligim", icon: null, onClick: () => (window.location.hash = "#salary") },
          { key: "tasks", label: "Topshiriqlar", icon: null, onClick: () => (window.location.hash = "#tasks") },
          { key: "profile", label: "Profil", icon: null, onClick: () => (window.location.hash = "#profile") },
        ]}
      >
        <div className="pt-7 pb-8">

              <div className="mb-2">
                <p className="text-sm text-gray-500">Barcha guruhlar · O'qituvchi paneli</p>
              </div>

              <div className="flex items-center justify-between gap-4 mb-4 mt-6 flex-wrap">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-[#2001ff]" />
                  Guruhlarim
                  <span className="text-xs bg-indigo-50 text-[#2001ff] px-3 py-1 rounded-full font-semibold">
                    {filteredGroups.length}/{groups.length} ta
                  </span>
                </h2>
                <div className="relative w-[240px] shrink-0">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Guruh qidirish..."
                    className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-sm bg-[#f8fafc] outline-none focus:border-[#2563eb] focus:bg-white focus:ring-[3px] focus:ring-[#2563eb]/10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-4 py-2 rounded-lg border text-[12.5px] font-semibold transition-colors cursor-pointer ${
                      statusFilter === f.key
                        ? "bg-[#2563eb] text-white border-[#2563eb]"
                        : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                    className="h-9 px-3 text-[13px] font-medium text-slate-700 bg-white border border-gray-200 rounded-lg outline-none cursor-pointer hover:border-slate-300"
                  >
                    {DAY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    className="h-9 px-3 text-[13px] font-medium text-slate-700 bg-white border border-gray-200 rounded-lg outline-none cursor-pointer hover:border-slate-300"
                  >
                    <option value="">Barcha vaqtlar</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-16 text-center">
                  <FolderIcon className="w-10 h-10 text-[#2001ff] opacity-35 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[#1a1a2e] mb-1">Guruhlar topilmadi</h3>
                  <p className="text-sm text-gray-400">Sizga biriktirilgan guruhlar mavjud emas</p>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-16 text-center">
                  <FolderIcon className="w-10 h-10 text-[#2001ff] opacity-35 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[#1a1a2e] mb-1">Hech narsa topilmadi</h3>
                  <p className="text-sm text-gray-400">Qidiruv yoki filtrga mos guruh yo'q</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredGroups.map((g) => {
                    const expired = g.status === "expired"
                    const badge = getStatusBadge(g.status)
                    const lessonDisplay = formatLessonDisplay(g.lesson_times)
                    return (
                      <div
                        key={g.id}
                        className={`bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden transition-all hover:shadow-md ${expired ? "opacity-70" : "hover:-translate-y-0.5"}`}
                      >
                        {expired ? (
                          <div className="p-4 cursor-default">
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium shrink-0 ml-2 ${badge.cls}`}>{badge.label}</span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">{g.course || "—"}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-3">
                              <ClockIcon className="w-3 h-3 text-[#2001ff] shrink-0" />
                              {lessonDisplay || "Vaqt belgilanmagan"}
                            </div>
                            <div className="pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1.5">
                              <BanIcon className="w-3 h-3 text-red-600 shrink-0" />
                              Muddati tugagan · {g.student_count} ta o'quvchi
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => onSelectGroup(g.id)}
                            className="block w-full text-left cursor-pointer border-none bg-transparent p-0"
                          >
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium shrink-0 ml-2 ${badge.cls}`}>{badge.label}</span>
                              </div>
                              <div className="text-xs text-gray-500 mb-2">{g.course || "—"}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-3">
                                <ClockIcon className="w-3 h-3 text-[#2001ff] shrink-0" />
                                {lessonDisplay || "Vaqt belgilanmagan"}
                              </div>
                            </div>
                            <div className="px-4 pb-3 pt-0 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1.5">
                              <UsersIcon className="w-3 h-3 text-[#2001ff] shrink-0" />
                              <strong>{g.student_count}</strong> ta o'quvchi
                            </div>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </DesktopShell>
    </>
  )
}
