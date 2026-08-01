import { useEffect, useState, useRef, useCallback } from "react"
import { api } from "../api"
import type { DashboardGroup } from "../types"

const AVATAR_COLORS = ["#2001ff", "#2563eb", "#ea580c", "#7c3aed", "#0891b2"]
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"]
const DAY_NAMES = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
const DAY_NAMES_URL = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"]

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function GraduateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="4" />
    </svg>
  )
}

function PickerCol({ items, selectedValue, onChange }: { items: { value: string | number; label: string }[]; selectedValue: string | number; onChange: (value: string | number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const ticking = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = items.findIndex(i => i.value === selectedValue)
    if (idx >= 0) {
      el.scrollTop = idx * 38 + 80 - el.clientHeight / 2 + 18
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const elCenter = el.getBoundingClientRect().top + el.clientHeight / 2
      let closest = 0, minDist = Infinity
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement
        const rect = child.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - elCenter)
        if (dist < minDist) { minDist = dist; closest = i }
      }
      const newVal = items[closest]?.value
      if (newVal !== undefined && newVal !== selectedValue) {
        onChange(newVal)
      }
      ticking.current = false
    })
  }, [items, selectedValue, onChange])

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto snap-y snap-mandatory py-16"
      style={{ scrollbarWidth: "none" }}
    >
      {items.map((item) => (
        <div
          key={String(item.value)}
          className={`h-[38px] flex items-center justify-center text-[17px] snap-center cursor-default ${item.value === selectedValue ? "text-gray-900 font-semibold text-[19px]" : "text-gray-400"}`}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}

export default function TeacherDashboard({ onSelectGroup, onStartLesson, onViewAllGroups }: { onSelectGroup: (id: number) => void; onStartLesson: (id: number) => void; onViewAllGroups: () => void }) {
  const [groups, setGroups] = useState<DashboardGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState({ total_groups: 0, today_count: 0, active_count: 0, total_students: 0 })
  const [todayDisplay, setTodayDisplay] = useState("")
  const [filterMode] = useState<"date" | "day">("date")
  const [selectedDay, setSelectedDay] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [showPicker, setShowPicker] = useState(false)

  const [pickerMode, setPickerMode] = useState<"date" | "day">("date")
  const [pickerDay, setPickerDay] = useState(new Date().getDate())
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth())
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())
  const [pickerWeekday, setPickerWeekday] = useState((new Date().getDay() + 6) % 7)
  const [pickerShowAll, setPickerShowAll] = useState(false)

  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    setLoading(true)
    setError("")
    api.teacherDashboard(selectedDay || undefined, selectedDate || undefined)
      .then((data) => {
        setGroups(data.groups)
        setStats({ total_groups: data.total_groups, today_count: data.today_count, active_count: data.active_count, total_students: data.total_students })
        setTodayDisplay(data.today_display)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedDay, selectedDate])

  function getFilterDisplay() {
    if (selectedDay) {
      const idx = DAY_NAMES_URL.indexOf(selectedDay)
      if (idx >= 0) return DAY_NAMES[idx]
    }
    if (selectedDate) {
      const parts = selectedDate.split("-")
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`
      }
      return selectedDate
    }
    return ""
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

  function openPicker() {
    setPickerMode(filterMode)
    setPickerShowAll(false)
    const now = new Date()
    setPickerDay(now.getDate())
    setPickerMonth(now.getMonth())
    setPickerYear(now.getFullYear())
    setPickerWeekday((now.getDay() + 6) % 7)
    setShowPicker(true)
  }

  function applyPicker() {
    if (pickerShowAll) {
      setSelectedDay("")
      setSelectedDate("")
    } else if (pickerMode === "date") {
      const m = String(pickerMonth + 1).padStart(2, "0")
      const d = String(pickerDay).padStart(2, "0")
      setSelectedDate(`${pickerYear}-${m}-${d}`)
      setSelectedDay("")
    } else {
      setSelectedDay(DAY_NAMES_URL[pickerWeekday])
      setSelectedDate("")
    }
    setShowPicker(false)
  }

  const dayItems = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1).padStart(2, "0") }))
  const monthItems = MONTHS.map((m, i) => ({ value: i, label: m }))
  const yearItems = Array.from({ length: 16 }, (_, i) => ({ value: 2020 + i, label: String(2020 + i) }))
  const weekdayItems = DAY_NAMES.map((d, i) => ({ value: i, label: d }))

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
        <div className="min-h-screen bg-white max-w-[480px] mx-auto shadow-lg flex flex-col">
          <header className="flex items-center justify-between px-5 py-4 bg-[#2001ff] text-white sticky top-0 z-20">
            <div className="flex items-center gap-3.5">
              <span className="text-lg font-semibold">O'qituvchi paneli</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={openPicker} className="bg-transparent border-none text-white p-1 cursor-pointer">
                <CalendarIcon className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-white/25 border-2 border-white/40 flex items-center justify-center text-sm font-bold text-white">
                {initials}
              </div>
            </div>
          </header>

          <div className="flex-1 px-5 pt-5 pb-28 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1a1a2e]">
                {getFilterDisplay() || "Barcha guruhlar"}
              </h2>
              <span className="text-xs text-[#2001ff] bg-indigo-50 px-3 py-1 rounded-full font-semibold">
                {groups.length} ta
              </span>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-16">
                <CalendarIcon className="w-14 h-14 text-[#2001ff] opacity-35 mx-auto mb-4" />
                <h3 className="text-[17px] text-[#1a1a2e] mb-1.5">Guruhlar topilmadi</h3>
                <p className="text-sm text-gray-400">
                  {selectedDay || selectedDate ? "Bu kun uchun darslar mavjud emas" : "Sizga biriktirilgan guruhlar mavjud emas"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((g) => {
                  const expired = g.status === "expired"
                  return (
                    <div key={g.id} className="bg-[#f4f4f4] rounded-xl border border-gray-200/50 overflow-hidden">
                      {expired ? (
                        <div className="block px-4 pt-3.5 pb-3 opacity-60 cursor-default">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 gap-x-4">
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <ClockIcon className="w-3 h-3 text-[#2001ff]" />
                              <span className="font-medium text-[#1a1a2e]">{g.lesson_display || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ) : g.status === "active" ? (
                        <div className="bg-white">
                          <button
                            onClick={() => onStartLesson(g.id)}
                            className="block w-full text-left px-4 pt-3.5 pb-[10px] bg-white cursor-pointer border-none"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 gap-x-4">
                              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                <ClockIcon className="w-3 h-3 text-[#2001ff]" />
                                <span className="font-medium text-[#1a1a2e]">{g.lesson_display || "—"}</span>
                              </div>
                            </div>
                          </button>
                          <div className="px-4 pb-3">
                            <button
                              onClick={() => onStartLesson(g.id)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-semibold bg-[#2001ff] text-white border-none cursor-pointer"
                            >
                              <PlayIcon className="w-4 h-4" />
                              Darsni boshlash
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectGroup(g.id)}
                          className="block w-full text-left px-4 pt-3.5 pb-3 bg-white cursor-pointer border-none"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 gap-x-4">
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <ClockIcon className="w-3 h-3 text-[#2001ff]" />
                              <span className="font-medium text-[#1a1a2e]">{g.lesson_display || "—"}</span>
                            </div>
                          </div>
                        </button>
                      )}
                      {expired && (
                        <div className="px-4 pb-1 pt-0.5 text-xs text-gray-500 flex items-center gap-1">
                          <BanIcon className="w-3 h-3 text-red-600" />
                          Muddati tugagan · <strong>{g.student_count}</strong> ta o'quvchi
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={openPicker}
            className="fixed bottom-[90px] left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#2001ff] text-white shadow-lg shadow-[#2001ff]/40 border-none text-[26px] cursor-pointer z-30 flex items-center justify-center"
          >
            <PlusIcon className="w-6 h-6" />
          </button>

          {/* Mobile picker overlay */}
          {showPicker && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                onClick={() => setShowPicker(false)}
              />
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-[440px] bg-white rounded-2xl z-50 shadow-2xl pb-5">
                <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-200">
                  <button onClick={() => setShowPicker(false)} className="bg-none border-none text-sm text-gray-400 font-medium cursor-pointer">
                    Bekor qilish
                  </button>
                  <span className="font-semibold text-base text-[#1a1a2e]">Sanani tanlang</span>
                  <button onClick={applyPicker} className="bg-[#2001ff] border-none text-white text-sm font-semibold px-4 py-1.5 rounded-full cursor-pointer">
                    Tanlash
                  </button>
                </div>

                <div className="flex gap-1.5 px-5 pt-3 pb-1">
                  <button
                    onClick={() => setPickerMode("date")}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border ${pickerMode === "date" ? "bg-[#2001ff] text-white border-[#2001ff]" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                  >
                    Kun bo'yicha
                  </button>
                  <button
                    onClick={() => setPickerMode("day")}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border ${pickerMode === "day" ? "bg-[#2001ff] text-white border-[#2001ff]" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                  >
                    Hafta kuni
                  </button>
                </div>

                <div className="relative flex h-[220px] overflow-hidden px-2">
                  <div className="absolute left-[8%] right-[8%] top-1/2 -translate-y-1/2 h-[38px] bg-indigo-50/50 rounded-xl pointer-events-none border border-indigo-100" />
                  {pickerMode === "date" ? (
                    <div className="flex w-full gap-1">
                      <PickerCol items={dayItems} selectedValue={pickerDay} onChange={(v) => setPickerDay(Number(v))} />
                      <PickerCol items={monthItems} selectedValue={pickerMonth} onChange={(v) => setPickerMonth(Number(v))} />
                      <PickerCol items={yearItems} selectedValue={pickerYear} onChange={(v) => setPickerYear(Number(v))} />
                    </div>
                  ) : (
                    <div className="flex w-full justify-center">
                      <div className="max-w-[180px] flex-1">
                        <PickerCol items={weekdayItems} selectedValue={pickerWeekday} onChange={(v) => setPickerWeekday(Number(v))} />
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 px-5 pt-3 text-sm text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickerShowAll}
                    onChange={(e) => setPickerShowAll(e.target.checked)}
                    className="w-[18px] h-[18px] accent-[#2001ff]"
                  />
                  Barcha guruhlarni ko'rish
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block min-h-screen bg-[#f8fafc]">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-[260px] bg-white border-r border-gray-200 fixed top-0 left-0 h-screen z-50 flex flex-col">
            <div className="px-5 pt-6 pb-5 border-b border-gray-200">
              <h1 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2.5">
                <GraduateIcon className="w-6 h-6 text-[#2001ff]" />
                IT House Academy
              </h1>
              <span className="text-[11px] text-gray-500 block mt-0.5 pl-[42px]">O'qituvchi paneli</span>
            </div>
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#2001ff] text-white font-semibold shadow-md mb-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </div>
              <button
                onClick={onViewAllGroups}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 text-sm font-medium cursor-pointer w-full border-none text-left"
              >
                <UsersIcon className="w-5 h-5" />
                Mening guruhlarim
              </button>
            </nav>
            <div className="px-3 py-4 border-t border-gray-200">
              <button
                onClick={() => { localStorage.clear(); window.location.href = "/" }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 text-sm w-full border-none text-left cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Chiqish
              </button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 ml-[260px] flex flex-col">
            <header className="bg-white border-b border-gray-200 h-[68px] flex items-center gap-5 px-8 sticky top-0 z-40">
              <div className="relative flex-1 max-w-[400px]">
                <SearchIcon className="w-[15px] h-[15px] text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Guruh yoki o'quvchi qidirish..."
                  className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-[#f8fafc] outline-none focus:border-[#2001ff] focus:ring-2 focus:ring-[#2001ff]/10"
                />
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-[#f8fafc] cursor-pointer">
                  <BellIcon className="w-[18px] h-[18px] text-gray-500" />
                  <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex items-center gap-3 px-2 py-1 rounded-lg cursor-pointer hover:bg-[#f8fafc]">
                  <div className="w-9 h-9 rounded-full bg-[#eef0ff] text-[#2001ff] flex items-center justify-center font-semibold text-sm">
                    {initials}
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-[#1a1a2e]">{emp.first_name} {emp.last_name}</div>
                    <div className="text-xs text-gray-500">{emp.position?.name || "O'qituvchi"}</div>
                  </div>
                </div>
              </div>
            </header>

            <div className="px-8 pt-7 pb-8 flex-1">
              <div className="mb-2">
                <p className="text-sm text-gray-500">{todayDisplay} · O'qituvchi paneli</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-4 mt-6 mb-7">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-[#eef0ff] text-[#2001ff] flex items-center justify-center text-lg mb-3.5">
                    <UsersIcon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="text-[28px] font-bold leading-tight">{stats.total_groups}</div>
                  <div className="text-xs text-gray-500 mt-1">Mening guruhlarim</div>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg mb-3.5">
                    <GraduateIcon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="text-[28px] font-bold leading-tight">{stats.today_count}</div>
                  <div className="text-xs text-gray-500 mt-1">Bugungi darslar</div>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg mb-3.5">
                    <UsersIcon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="text-[28px] font-bold leading-tight">{stats.total_students}</div>
                  <div className="text-xs text-gray-500 mt-1">Jami o'quvchilar</div>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-lg mb-3.5">
                    <ChartIcon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="text-[28px] font-bold leading-tight">92%</div>
                  <div className="text-xs text-gray-500 mt-1">Davomat ko'rsatkichi</div>
                </div>
              </div>

              <div className="flex gap-7">
                <div className="flex-1 min-w-0">
                  {/* Section header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-[#2001ff]" />
                      Guruhlarim
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={openPicker}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs cursor-pointer transition-all ${selectedDay || selectedDate ? "bg-[#2001ff] text-white border-[#2001ff]" : "bg-white text-gray-500 border-gray-200 hover:border-[#2001ff] hover:text-[#2001ff]"}`}
                      >
                        <CalendarIcon className="w-3 h-3" />
                        {getFilterDisplay() || "Bugun"}
                      </button>
                      {(selectedDay || selectedDate) && (
                        <button
                          onClick={() => { setSelectedDay(""); setSelectedDate("") }}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-500 hover:border-[#2001ff] hover:text-[#2001ff] cursor-pointer"
                        >
                          <CloseIcon className="w-3 h-3" />
                          Filterni tozalash
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Guruh nomi</th>
                          <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">O'quvchilar</th>
                          <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Dars vaqti</th>
                          <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Holati</th>
                          <th className="text-right px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Amallar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-gray-500">
                              <FolderIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                              Guruhlar topilmadi
                            </td>
                          </tr>
                        ) : (
                          groups.map((g, idx) => {
                            const badge = getStatusBadge(g.status)
                            const expired = g.status === "expired"
                            return (
                              <tr key={g.id} className="hover:bg-gray-50">
                                <td className="px-[18px] py-3.5 border-b border-gray-200">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                      style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                                    >
                                      {g.name.slice(0, 2)}
                                    </div>
                                    <div className="leading-tight">
                                      <div className="text-sm font-semibold text-[#1a1a2e]">{g.name}</div>
                                      <div className="text-xs text-gray-500">{g.course || "—"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-[18px] py-3.5 border-b border-gray-200 text-sm font-semibold text-[#1a1a2e]">{g.student_count} ta</td>
                                <td className="px-[18px] py-3.5 border-b border-gray-200 text-xs text-gray-500">{g.lesson_display || "Vaqt belgilanmagan"}</td>
                                <td className="px-[18px] py-3.5 border-b border-gray-200">
                                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.cls}`}>
                                    {g.status === "active" && <DotIcon className="w-2 h-2" />}
                                    {g.status === "upcoming" && <ClockIcon className="w-3 h-3" />}
                                    {g.status === "finished" && <CheckIcon className="w-3 h-3" />}
                                    {g.status === "expired" && <BanIcon className="w-3 h-3" />}
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-[18px] py-3.5 border-b border-gray-200 text-right">
                                  {expired ? (
                                    <span className="text-xs text-red-600 font-medium flex items-center gap-1 justify-end">
                                      <LockIcon className="w-3 h-3" />
                                      Bloklangan
                                    </span>
                                  ) : g.status === "active" ? (
                                    <button
                                      onClick={() => onStartLesson(g.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 shadow-sm cursor-pointer border-none"
                                    >
                                      <PlayIcon className="w-3 h-3" />
                                      Darsni boshlash
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onSelectGroup(g.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2001ff] text-white hover:bg-[#1a00d9] shadow-sm cursor-pointer border-none"
                                    >
                                      Batafsil
                                      <ArrowRightIcon className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right sidebar */}
                <aside className="w-[320px] shrink-0 flex flex-col gap-5">
                  {/* Today's lessons */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-[#2001ff]" />
                        Bugungi darslar
                      </h3>
                    </div>
                    <div className="px-4 py-3">
                      {groups.filter(g => g.status === "active" || g.status === "upcoming").length === 0 ? (
                        <div className="text-center py-5 text-xs text-gray-500">Bugun dars yo'q</div>
                      ) : (
                        groups.filter(g => g.status === "active" || g.status === "upcoming").map(g => (
                          <div key={g.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${g.status === "active" ? "bg-[#2001ff]" : "bg-orange-400"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold">{g.name}</div>
                              <div className="text-[11px] text-gray-500">{g.student_count} ta o'quvchi · {g.course || "—"}</div>
                            </div>
                            <div className="text-[11px] text-gray-500 whitespace-nowrap">
                              {g.nearest_time || "—"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#2001ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Tezkor amallar
                      </h3>
                    </div>
                    <div className="p-1">
                      <div className="grid grid-cols-2 gap-2 p-1">
                        <button
                          onClick={onViewAllGroups}
                          className="flex flex-col items-center gap-1.5 py-4 rounded-lg bg-gray-50 hover:bg-[#eef0ff] hover:text-[#2001ff] text-gray-700 text-xs font-medium cursor-pointer border-none"
                        >
                          <UsersIcon className="w-5 h-5" />
                          <span>Barcha guruhlar</span>
                        </button>
                        <button
                          onClick={openPicker}
                          className="flex flex-col items-center gap-1.5 py-4 rounded-lg bg-gray-50 hover:bg-[#eef0ff] hover:text-[#2001ff] text-gray-700 text-xs font-medium cursor-pointer border-none"
                        >
                          <CalendarIcon className="w-5 h-5" />
                          <span>Filter</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop date picker overlay */}
        {showPicker && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center"
            onClick={() => setShowPicker(false)}
          >
            <div
              className="bg-white rounded-2xl w-[90%] max-w-[380px] p-5 shadow-2xl animate-[scaleIn_0.25s_ease]"
              onClick={(e) => e.stopPropagation()}
            >
              <style>{`@keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
              <div className="flex gap-2 mb-4 bg-[#f8fafc] rounded-lg p-1">
                <button
                  onClick={() => setPickerMode("date")}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg cursor-pointer border-none ${pickerMode === "date" ? "bg-white text-gray-900 shadow-sm font-semibold" : "text-gray-500 bg-transparent"}`}
                >
                  Kun bo'yicha
                </button>
                <button
                  onClick={() => setPickerMode("day")}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg cursor-pointer border-none ${pickerMode === "day" ? "bg-white text-gray-900 shadow-sm font-semibold" : "text-gray-500 bg-transparent"}`}
                >
                  Hafta kuni
                </button>
              </div>

              {pickerMode === "date" ? (
                <div className="flex gap-2 justify-center h-[200px] overflow-hidden relative">
                  <div className="flex gap-2 flex-1">
                    <div className="max-w-[70px] flex-1">
                      <PickerCol items={dayItems} selectedValue={pickerDay} onChange={(v) => setPickerDay(Number(v))} />
                    </div>
                    <div className="flex-1">
                      <PickerCol items={monthItems} selectedValue={pickerMonth} onChange={(v) => setPickerMonth(Number(v))} />
                    </div>
                    <div className="flex-1">
                      <PickerCol items={yearItems} selectedValue={pickerYear} onChange={(v) => setPickerYear(Number(v))} />
                    </div>
                  </div>
                  <div className="absolute top-1/2 left-0 right-0 h-[38px] -translate-y-1/2 border-t border-b border-gray-200 pointer-events-none" />
                </div>
              ) : (
                <div className="flex gap-2 justify-center h-[200px] overflow-hidden relative">
                  <div className="max-w-[200px] mx-auto flex-1">
                    <PickerCol items={weekdayItems} selectedValue={pickerWeekday} onChange={(v) => setPickerWeekday(Number(v))} />
                  </div>
                  <div className="absolute top-1/2 left-0 right-0 h-[38px] -translate-y-1/2 border-t border-b border-gray-200 pointer-events-none" />
                </div>
              )}

              <label className="flex items-center gap-2.5 py-2.5 text-sm text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickerShowAll}
                  onChange={(e) => setPickerShowAll(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[#2001ff]"
                />
                Barcha guruhlarni ko'rish
              </label>

              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={() => setShowPicker(false)}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer border-none"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={applyPicker}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold bg-[#2001ff] text-white hover:bg-[#1a00d9] cursor-pointer border-none"
                >
                  Tanlash
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
