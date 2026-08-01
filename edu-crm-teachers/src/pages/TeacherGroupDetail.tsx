import { useEffect, useState } from "react"
import { api } from "../api"
import type { GroupDetailData } from "../types"

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

function ClipboardCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

function getTodayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getTodayDisplay(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

function AttendanceStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "present":
      return <CheckCircleIcon className="w-4 h-4 text-green-600 shrink-0" />
    case "absent":
      return <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />
    case "excused":
      return <AlertTriangleIcon className="w-4 h-4 text-orange-500 shrink-0" />
    default:
      return null
  }
}

function StatusBadge({ status, label }: { status: "active" | "frozen"; label: string }) {
  if (status === "frozen") {
    return (
      <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        {label}
      </span>
    )
  }
  return (
    <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-700 flex items-center gap-1">
      <CheckCircleIcon className="w-3 h-3" />
      {label}
    </span>
  )
}

export default function TeacherGroupDetail({ id, onBack, onAttendance }: { id: number; onBack: () => void; onAttendance: (groupId: number) => void }) {
  const [data, setData] = useState<GroupDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [attendanceRows, setAttendanceRows] = useState<{ student_id: number; status: string; reason: string; notes: string }[]>([])
  const [saving, setSaving] = useState(false)

  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    setLoading(true)
    setError("")
    api.teacherGroupDetail(id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function closeModal() {
    setModalOpen(false)
  }

  function updateAttendanceRow(studentId: number, field: "status" | "reason" | "notes", value: string) {
    setAttendanceRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, [field]: value } : r)))
  }

  async function saveAttendance() {
    if (!data) return
    setSaving(true)
    try {
      const today = getTodayISO()
      const records = attendanceRows.map((r) => {
        let notes = r.notes
        if ((r.status === "absent" || r.status === "excused") && r.reason) {
          notes = notes ? `${r.reason} | ${notes}` : r.reason
        }
        return { student_id: r.student_id, date: today, status: r.status, notes: notes || "" }
      })
      await api.takeAttendance(data.group.id, records)
      closeModal()
      const updated = await api.teacherGroupDetail(id)
      setData(updated)
    } catch (err: any) {
      alert("Xatolik: " + (err.message || ""))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Yuklanmoqda...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl text-sm">{error || "Ma'lumot topilmadi"}</div>
      </div>
    )
  }

  const { group, students, absence_reasons } = data

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden">
        <div className="min-h-screen bg-[#f5f7fc] max-w-[480px] mx-auto shadow-lg flex flex-col">
          <header className="flex items-center gap-3 px-4 py-3.5 bg-[#2001ff] text-white sticky top-0 z-20">
            <button onClick={onBack} className="bg-white/15 w-[34px] h-[34px] rounded-[10px] flex items-center justify-center border-none cursor-pointer text-white">
              <ChevronLeftIcon className="w-[18px] h-[18px]" />
            </button>
            <h1 className="text-[17px] font-semibold flex-1">{group.name}</h1>
            <div className="w-[32px] h-[32px] rounded-full bg-white/25 flex items-center justify-center font-bold text-[12px] text-white border-2 border-white/40 shrink-0">
              {initials}
            </div>
          </header>

          <div className="flex-1 p-5 flex flex-col gap-[18px] pb-28">
            {/* Group info card */}
            <div className="bg-white rounded-[14px] p-[18px] border border-[#eef1ff]">
              <div className="flex items-center gap-2 mb-3.5 pb-3 border-b border-[#eef1ff]">
                <InfoIcon className="w-4 h-4 text-[#2001ff]" />
                <h3 className="text-base font-bold text-[#1a1a2e]">Guruh ma'lumotlari</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Kurs</span>
                  <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.course || "—"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Xona</span>
                  <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.room || "—"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ta'lim turi</span>
                  <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.education_type_display}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Holati</span>
                  <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.status_display}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Boshlanish</span>
                  <span className="text-[15px] font-semibold text-[#1a1a2e]">{formatDate(group.start_date)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tugash</span>
                  <span className="text-[15px] font-semibold text-[#1a1a2e]">{formatDate(group.end_date)}</span>
                </div>
                {group.lesson_times.length > 0 && (
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dars vaqtlari</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {group.lesson_times.map((lt, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-lg text-[13px] font-semibold text-[#2001ff]">
                          <ClockIcon className="w-3 h-3" />
                          {lt.days_display} {lt.start_time.slice(0, 5)}—{lt.end_time.slice(0, 5)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance button */}
            <button
              onClick={() => onAttendance(group.id)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer border-none bg-[#2001ff] text-white"
            >
              <ClipboardCheckIcon className="w-5 h-5" />
              Davomat
            </button>

            {/* Students section */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4 text-[#2001ff]" />
                O'quvchilar
              </h3>
              <span className="text-[13px] text-[#2001ff] bg-[#eef1ff] px-3.5 py-0.5 rounded-full font-semibold">
                {students.length} ta
              </span>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-10">
                <UsersIcon className="w-12 h-12 text-[#2001ff] opacity-30 mx-auto mb-3" />
                <h3 className="text-[17px] text-[#1a1a2e] mb-1">O'quvchilar yo'q</h3>
                <p className="text-sm text-gray-400">Bu guruhda hali o'quvchilar mavjud emas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {students.map((s) => {
                  const avInitials = (s.first_name[0] + s.last_name[0]).toUpperCase()
                  return (
                    <div key={s.id} className="bg-white rounded-[14px] p-3 flex items-center gap-3 border border-[#eef1ff]">
                      <div className="w-[38px] h-[38px] rounded-xl bg-[#f0f4ff] text-[#2001ff] flex items-center justify-center font-bold text-sm shrink-0">
                        {avInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-[#1a1a2e]">{s.first_name} {s.last_name}</span>
                          {s.attendance_status && (
                            <AttendanceStatusIcon status={s.attendance_status} />
                          )}
                        </div>
                        <div className="text-[13px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          +998 {s.phone}
                        </div>
                        {(s.attendance_status === "absent" || s.attendance_status === "excused") && s.attendance_notes && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-red-500">
                            {s.attendance_status === "absent" ? (
                              <XCircleIcon className="w-3 h-3 shrink-0" />
                            ) : (
                              <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                            )}
                            <span>{s.attendance_notes}</span>
                          </div>
                        )}
                      </div>
                      {s.is_frozen ? (
                        <StatusBadge status="frozen" label="Muzlatilgan" />
                      ) : (
                        <StatusBadge status="active" label="Faol" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Telegram link */}
            {group.telegram_link && (
              <a
                href={group.telegram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[15px] font-semibold cursor-pointer bg-transparent text-[#2001ff] border-2 border-[#2001ff] no-underline"
              >
                <TelegramIcon className="w-5 h-5" />
                Telegram guruh
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block min-h-screen bg-[#f8fafc]">
        <div className="flex min-h-screen">
          <aside className="w-[260px] bg-white border-r border-gray-200 fixed top-0 left-0 h-screen z-50 flex flex-col">
            <div className="px-5 pt-6 pb-5 border-b border-gray-200">
              <h1 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2.5">
                <svg className="w-6 h-6 text-[#2001ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
                IT House Academy
              </h1>
              <span className="text-[11px] text-gray-500 block mt-0.5 pl-[42px]">O'qituvchi paneli</span>
            </div>
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              <button
                onClick={onBack}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 text-sm font-medium cursor-pointer w-full border-none text-left"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </button>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#2001ff] text-white font-semibold shadow-md mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                {group.name}
              </div>
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

          <div className="flex-1 ml-[260px] flex flex-col">
            <header className="bg-white border-b border-gray-200 h-[68px] flex items-center gap-5 px-8 sticky top-0 z-40">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#1a1a2e]">{group.name}</h1>
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
                <p className="text-sm text-gray-500">Guruh detallari · O'qituvchi paneli</p>
              </div>

              {/* Desktop group info + students layout */}
              <div className="flex gap-6 mt-4">
                <div className="flex-1 space-y-5">
                  {/* Group info card */}
                  <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                      <InfoIcon className="w-4 h-4 text-[#2001ff]" />
                      <h3 className="text-base font-bold text-[#1a1a2e]">Guruh ma'lumotlari</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Kurs</span>
                        <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.course || "—"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Xona</span>
                        <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.room || "—"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ta'lim turi</span>
                        <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.education_type_display}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Holati</span>
                        <span className="text-[15px] font-semibold text-[#1a1a2e]">{group.status_display}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Boshlanish</span>
                        <span className="text-[15px] font-semibold text-[#1a1a2e]">{formatDate(group.start_date)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tugash</span>
                        <span className="text-[15px] font-semibold text-[#1a1a2e]">{formatDate(group.end_date)}</span>
                      </div>
                      {group.lesson_times.length > 0 && (
                        <div className="col-span-3 flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dars vaqtlari</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {group.lesson_times.map((lt, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-lg text-[13px] font-semibold text-[#2001ff]">
                                <ClockIcon className="w-3 h-3" />
                                {lt.days_display} {lt.start_time.slice(0, 5)}—{lt.end_time.slice(0, 5)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attendance button */}
                  <button
                    onClick={() => onAttendance(group.id)}
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer border-none bg-[#2001ff] text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <ClipboardCheckIcon className="w-5 h-5" />
                    Davomat
                  </button>

                  {/* Students section */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-bold text-[#1a1a2e] flex items-center gap-1.5">
                      <UsersIcon className="w-4 h-4 text-[#2001ff]" />
                      O'quvchilar
                    </h3>
                    <span className="text-[13px] text-[#2001ff] bg-[#eef1ff] px-3.5 py-0.5 rounded-full font-semibold">
                      {students.length} ta
                    </span>
                  </div>

                  {students.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-16 text-center">
                      <UsersIcon className="w-10 h-10 text-[#2001ff] opacity-35 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-[#1a1a2e] mb-1">O'quvchilar yo'q</h3>
                      <p className="text-sm text-gray-400">Bu guruhda hali o'quvchilar mavjud emas</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {students.map((s) => {
                        const avInitials = (s.first_name[0] + s.last_name[0]).toUpperCase()
                        return (
                          <div key={s.id} className="bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-200/80 shadow-sm">
                            <div className="w-[42px] h-[42px] rounded-xl bg-[#f0f4ff] text-[#2001ff] flex items-center justify-center font-bold text-sm shrink-0">
                              {avInitials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[15px] font-semibold text-[#1a1a2e]">{s.first_name} {s.last_name}</span>
                                {s.attendance_status && (
                                  <AttendanceStatusIcon status={s.attendance_status} />
                                )}
                              </div>
                              <div className="text-[13px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                +998 {s.phone}
                              </div>
                              {(s.attendance_status === "absent" || s.attendance_status === "excused") && s.attendance_notes && (
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-red-500">
                                  {s.attendance_status === "absent" ? (
                                    <XCircleIcon className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                                  )}
                                  <span>{s.attendance_notes}</span>
                                </div>
                              )}
                            </div>
                            {s.is_frozen ? (
                              <StatusBadge status="frozen" label="Muzlatilgan" />
                            ) : (
                              <StatusBadge status="active" label="Faol" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Telegram link */}
                  {group.telegram_link && (
                    <a
                      href={group.telegram_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[15px] font-semibold cursor-pointer bg-transparent text-[#2001ff] border-2 border-[#2001ff] no-underline hover:bg-[#eef0ff] transition-colors"
                    >
                      <TelegramIcon className="w-5 h-5" />
                      Telegram guruh
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-[20px] w-[92%] max-w-[440px] max-h-[90vh] flex flex-col shadow-2xl animate-[scaleIn_0.25s_ease]">
            <style>{`@keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            <div className="flex justify-between items-center px-5 py-4 pb-3 border-b border-gray-200 shrink-0">
              <div className="flex flex-col gap-0.5">
                <div className="text-[16px] font-bold text-[#1a1a2e]">{group.name}</div>
                <div className="text-[12px] text-gray-400 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {getTodayDisplay()}
                  </span>
                  {group.lesson_times.length > 0 && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {group.lesson_times[0].start_time.slice(0, 5)}—{group.lesson_times[0].end_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer border-none bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer border-none bg-[#2001ff] text-white hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>

            <div className="py-1 overflow-y-auto flex-1">
              {students.map((s, idx) => {
                const row = attendanceRows.find((r) => r.student_id === s.id)
                const status = row?.status || "present"
                const showReason = status === "absent" || status === "excused"
                return (
                  <div key={s.id} className="flex items-center gap-2 px-5 py-2 border-b border-gray-50 flex-wrap hover:bg-[#fafbff] transition-colors">
                    <span className="w-[30px] text-[13px] text-gray-400 font-medium shrink-0">{idx + 1}.</span>
                    <span className="flex-1 text-[14px] font-medium text-[#1a1a2e] min-w-[100px]">{s.first_name} {s.last_name}</span>
                    <select
                      value={status}
                      onChange={(e) => updateAttendanceRow(s.id, "status", e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border-[1.5px] border-[#e0e3f0] text-[13px] font-semibold outline-none cursor-pointer bg-white focus:border-[#2001ff] focus:ring-3 focus:ring-[#2001ff]/10 min-w-[115px] text-center"
                    >
                      <option value="present">Keldi</option>
                      <option value="absent">Kelmadi</option>
                      <option value="excused">Sababli</option>
                    </select>
                    {showReason && (
                      <select
                        value={row?.reason || ""}
                        onChange={(e) => updateAttendanceRow(s.id, "reason", e.target.value)}
                        className="px-2 py-1 rounded-lg border border-gray-200 text-[11px] outline-none bg-gray-50"
                      >
                        <option value="">Sababni tanlang...</option>
                        {absence_reasons.map((r) => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                        <option value="__other__">Boshqa</option>
                      </select>
                    )}
                    <input
                      type="text"
                      placeholder="Izoh"
                      value={row?.notes || ""}
                      onChange={(e) => updateAttendanceRow(s.id, "notes", e.target.value)}
                      className="w-[120px] px-2.5 py-1 text-[12px] border border-gray-200 rounded-lg outline-none bg-gray-50 focus:border-[#2001ff]"
                    />
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-between items-center shrink-0 text-[12px] text-gray-400">
              <span className="flex items-center gap-1">
                <UsersIcon className="w-3.5 h-3.5" />
                <strong className="text-[#1a1a2e]">{students.length}</strong> ta o'quvchi
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eef0ff] text-[#2001ff] text-[11px] font-semibold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Bugun
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
