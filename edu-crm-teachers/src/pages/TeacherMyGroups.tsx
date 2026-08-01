import { useEffect, useState } from "react"
import { api } from "../api"
import type { TeacherGroup } from "../types"

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

function GraduateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
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

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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

export default function TeacherMyGroups({ onSelectGroup, onBack }: { onSelectGroup: (id: number) => void; onBack: () => void }) {
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    setLoading(true)
    setError("")
    api.myGroups()
      .then((data) => setGroups(data.groups))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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
          <header className="flex items-center gap-3 px-5 py-4 bg-[#2001ff] text-white sticky top-0 z-20">
            <button onClick={onBack} className="bg-transparent border-none text-white p-0 cursor-pointer">
              <BackIcon className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold flex-1">Mening guruhlarim</h1>
            <span className="text-sm opacity-80 mr-2">{groups.length} ta</span>
            <div className="w-8 h-8 rounded-full bg-white/25 border-2 border-white/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
          </header>

          <div className="flex-1 px-5 pt-5 pb-28 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1a1a2e]">Barcha guruhlar</h2>
              <span className="text-xs text-[#2001ff] bg-indigo-50 px-3 py-1 rounded-full font-semibold">
                {groups.length} ta
              </span>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-16">
                <FolderIcon className="w-14 h-14 text-[#2001ff] opacity-35 mx-auto mb-4" />
                <h3 className="text-[17px] text-[#1a1a2e] mb-1.5">Guruhlar topilmadi</h3>
                <p className="text-sm text-gray-400">Sizga biriktirilgan guruhlar mavjud emas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((g) => {
                  const expired = g.status === "expired"
                  const badge = getStatusBadge(g.status)
                  const lessonDisplay = formatLessonDisplay(g.lesson_times)
                  return (
                    <div key={g.id} className="bg-[#f4f4f4] rounded-xl border border-gray-200/50 overflow-hidden">
                      {expired ? (
                        <div className="block px-4 pt-3.5 pb-3 opacity-60 cursor-default">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 gap-x-4">
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <ClockIcon className="w-3 h-3 text-[#2001ff]" />
                              <span className="font-medium text-[#1a1a2e]">{lessonDisplay || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectGroup(g.id)}
                          className="block w-full text-left px-4 pt-3.5 pb-3 bg-white cursor-pointer border-none"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-bold text-[15px] text-[#1a1a2e]">{g.name}</div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 gap-x-4">
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="font-medium text-[#1a1a2e]">{g.course || "—"}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                              <ClockIcon className="w-3 h-3 text-[#2001ff]" />
                              <span className="font-medium text-[#1a1a2e]">{lessonDisplay || "Vaqt belgilanmagan"}</span>
                            </div>
                          </div>
                        </button>
                      )}
                      {expired && (
                        <div className="px-4 pb-3 pt-0.5 text-xs text-gray-500 flex items-center gap-1.5">
                          <BanIcon className="w-3 h-3 text-red-600 shrink-0" />
                          <span>Muddati tugagan · <strong>{g.student_count}</strong> ta o'quvchi</span>
                        </div>
                      )}
                      {!expired && (
                        <div className="px-4 pb-3 pt-1 text-xs text-gray-500 flex items-center gap-1.5">
                          <UsersIcon className="w-3 h-3 text-[#2001ff] shrink-0" />
                          <span><strong>{g.student_count}</strong> ta o'quvchi</span>
                        </div>
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
              <button
                onClick={onBack}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 text-sm font-medium cursor-pointer w-full border-none text-left mb-0.5"
              >
                <GridIcon className="w-5 h-5" />
                Dashboard
              </button>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#2001ff] text-white font-semibold shadow-md">
                <UsersIcon className="w-5 h-5" />
                Mening guruhlarim
              </div>
            </nav>
            <div className="px-3 py-4 border-t border-gray-200">
              <button
                onClick={() => { localStorage.clear(); window.location.href = "/" }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 text-sm w-full border-none text-left cursor-pointer"
              >
                <LogoutIcon className="w-5 h-5" />
                Chiqish
              </button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 ml-[260px] flex flex-col">
            <header className="bg-white border-b border-gray-200 h-[68px] flex items-center gap-5 px-8 sticky top-0 z-40">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#1a1a2e]">Mening guruhlarim</h1>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-3 px-2 py-1 rounded-lg">
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
                <p className="text-sm text-gray-500">Barcha guruhlar · O'qituvchi paneli</p>
              </div>

              <div className="flex items-center justify-between mb-5 mt-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-[#2001ff]" />
                  Guruhlarim
                </h2>
                <span className="text-xs bg-indigo-50 text-[#2001ff] px-3 py-1 rounded-full font-semibold">
                  {groups.length} ta
                </span>
              </div>

              {groups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-16 text-center">
                  <FolderIcon className="w-10 h-10 text-[#2001ff] opacity-35 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[#1a1a2e] mb-1">Guruhlar topilmadi</h3>
                  <p className="text-sm text-gray-400">Sizga biriktirilgan guruhlar mavjud emas</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groups.map((g) => {
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
          </div>
        </div>
      </div>
    </>
  )
}
