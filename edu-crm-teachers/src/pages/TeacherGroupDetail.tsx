import { useEffect, useState, type ReactNode } from "react"
import { api } from "../api"
import type { GroupDetailData } from "../types"
import DesktopShell from "../components/DesktopShell"

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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

const DAYS: [string, string][] = [
  ["dushanba", "Dushanba"],
  ["seshanba", "Seshanba"],
  ["chorshanba", "Chorshanba"],
  ["payshanba", "Payshanba"],
  ["juma", "Juma"],
  ["shanba", "Shanba"],
  ["yakshanba", "Yakshanba"],
]

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

function InfoCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-6 py-5 border-r border-gray-100 last:border-r-0 min-w-0">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="text-[14.5px] font-semibold text-slate-900 leading-snug break-words">{children}</div>
    </div>
  )
}

export default function TeacherGroupDetail({ id, onBack, onAttendance }: { id: number; onBack: () => void; onAttendance: (groupId: number) => void }) {
  const [data, setData] = useState<GroupDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [attendanceRows, setAttendanceRows] = useState<{ student_id: number; status: string; reason: string; notes: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editLessonTimes, setEditLessonTimes] = useState<{ days: string; start_time: string; end_time: string }[]>([])
  const [editTelegram, setEditTelegram] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

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

  function openEdit() {
    if (!data) return
    setEditName(data.group.name)
    setEditLessonTimes(data.group.lesson_times.map((lt) => ({
      days: lt.days,
      start_time: lt.start_time.slice(0, 5),
      end_time: lt.end_time.slice(0, 5),
    })))
    setEditTelegram(data.group.telegram_link || "")
    setEditError("")
    setEditOpen(true)
  }

  function toggleEditDay(rowIdx: number, day: string) {
    setEditLessonTimes((prev) => prev.map((row, i) => {
      if (i !== rowIdx) return row
      const daysList = row.days ? row.days.split(",").map((d) => d.trim()) : []
      if (daysList.includes(day)) {
        return { ...row, days: daysList.filter((d) => d !== day).join(",") }
      }
      return { ...row, days: [...daysList, day].join(",") }
    }))
  }

  function setEditRowTime(rowIdx: number, field: "start_time" | "end_time", value: string) {
    setEditLessonTimes((prev) => prev.map((row, i) => (i === rowIdx ? { ...row, [field]: value } : row)))
  }

  async function saveEdit() {
    if (!data) return
    if (!editName.trim()) {
      setEditError("Guruh nomini kiriting")
      return
    }
    for (let i = 0; i < editLessonTimes.length; i++) {
      const row = editLessonTimes[i]
      if (!row.days) {
        setEditError(`${i + 1}-dars vaqtiga kamida 1 kun tanlang`)
        return
      }
      if (!row.start_time || !row.end_time) {
        setEditError(`${i + 1}-dars vaqti soatini kiriting`)
        return
      }
    }
    setEditSaving(true)
    setEditError("")
    try {
      await api.updateTeacherGroup(data.group.id, {
        name: editName.trim(),
        lesson_times: editLessonTimes,
        telegram_link: editTelegram.trim() || undefined,
      })
      setEditOpen(false)
      const updated = await api.teacherGroupDetail(data.group.id)
      setData(updated)
    } catch (err: any) {
      setEditError(err.message || "Saqlashda xatolik")
    } finally {
      setEditSaving(false)
    }
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
        <div className="min-h-screen bg-[#F8F9FC] max-w-[480px] mx-auto flex flex-col">
          <header className="relative bg-gradient-to-b from-[#3E37FF] via-[#2001FF] to-[#1B00E0] text-white sticky top-0 z-20 shadow-md shadow-[#2001FF]/20">
            <div className="relative px-4 pt-2 pb-3">
              <div className="flex items-center justify-between gap-2">
                <button onClick={onBack} className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover shrink-0">
                  <ChevronLeftIcon className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="flex-1 text-center min-w-0">
                  <h1 className="text-[13px] font-bold leading-tight truncate">{group.name}</h1>
                  <p className="text-[9px] font-medium text-white/65 mt-px truncate">{group.course || "Guruh detallari"}</p>
                </div>
                <div className="w-7 shrink-0 flex justify-end">
                  <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 px-3 pt-4 pb-28 flex flex-col gap-[14px]">
            {/* Group info card */}
            <div className="card-premium p-[16px] animate-scale-in">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#eef1ff]">
                <InfoIcon className="w-4 h-4 text-[#2001FF]" />
                <h3 className="text-[14px] font-bold text-[#1a1a2e] flex-1">Guruh ma'lumotlari</h3>
                <button onClick={openEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#2001FF] bg-[#2001FF]/10 border-none cursor-pointer btn-hover">
                  <PencilIcon className="w-3 h-3" />
                  Tahrirlash
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Kurs</span>
                  <span className="text-[14px] font-semibold text-[#1a1a2e]">{group.course || "—"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Xona</span>
                  <span className="text-[14px] font-semibold text-[#1a1a2e]">{group.room || "—"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Ta'lim turi</span>
                  <span className="text-[14px] font-semibold text-[#1a1a2e]">{group.education_type_display}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Holati</span>
                  <span className="text-[14px] font-semibold text-[#1a1a2e]">{group.status_display}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Boshlanish</span>
                  <span className="text-[14px] font-semibold text-[#1a1a2e]">{formatDate(group.start_date)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tugash</span>
                  <span className="text-[14px] font-semibold text-[#1a1a2e]">{formatDate(group.end_date)}</span>
                </div>
                {group.lesson_times.length > 0 && (
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Dars vaqtlari</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {group.lesson_times.map((lt, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-[#2001FF]/10 rounded-lg text-[12px] font-semibold text-[#2001FF]">
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
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[14px] font-semibold cursor-pointer border-none bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/15 active:scale-[0.98] transition-transform"
            >
              <ClipboardCheckIcon className="w-5 h-5" />
              Davomat
            </button>

            {/* Students section */}
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1a1a2e] flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4 text-[#2001FF]" />
                O'quvchilar
              </h3>
              <span className="text-[12px] text-[#2001FF] bg-[#2001FF]/10 px-3 py-0.5 rounded-full font-semibold">
                {students.length} ta
              </span>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-10">
                <UsersIcon className="w-12 h-12 text-[#2001FF] opacity-20 mx-auto mb-3" />
                <h3 className="text-[17px] text-[#1a1a2e] mb-1">O'quvchilar yo'q</h3>
                <p className="text-[12px] text-gray-400">Bu guruhda hali o'quvchilar mavjud emas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {students.map((s, idx) => {
                  const avInitials = (s.first_name[0] + s.last_name[0]).toUpperCase()
                  return (
                    <div key={s.id} className="card-premium p-3 flex items-center gap-3 animate-page-enter" style={{ animationDelay: `${idx * 40}ms` }}>
                      <div className="w-[36px] h-[36px] rounded-xl bg-[#2001FF]/10 text-[#2001FF] flex items-center justify-center font-bold text-[13px] shrink-0">
                        {avInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-[#1a1a2e]">{s.first_name} {s.last_name}</span>
                          {s.attendance_status && (
                            <AttendanceStatusIcon status={s.attendance_status} />
                          )}
                        </div>
                        <div className="text-[12px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {s.phone}
                        </div>
                        {typeof s.balance === "number" && (
                          <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                            s.balance < 0 ? "text-red-500 bg-red-50" : "text-[#2001FF] bg-[#2001FF]/5"
                          }`}>
                            Balans: {s.balance.toLocaleString("ru-RU")} so'm
                          </span>
                        )}
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
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[14px] font-semibold cursor-pointer bg-transparent text-[#2001FF] border-2 border-[#2001FF] no-underline"
              >
                <TelegramIcon className="w-5 h-5" />
                Telegram guruh
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <DesktopShell
        activeKey="groups"
        navItems={[
          { key: "dashboard", label: "Dashboard", icon: null, onClick: () => (window.location.hash = "#dashboard") },
          { key: "groups", label: "Mening guruhlarim", icon: null, onClick: () => (window.location.hash = "#my-groups") },
          { key: "salary", label: "Mening oyligim", icon: null, onClick: () => (window.location.hash = "#salary") },
          { key: "tasks", label: "Topshiriqlar", icon: null, onClick: () => (window.location.hash = "#tasks") },
          { key: "profile", label: "Profil", icon: null, onClick: () => (window.location.hash = "#profile") },
        ]}
      >
        <div className="pt-7 pb-10 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500 mb-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 hover:text-[#2563eb] transition-colors cursor-pointer border-none bg-transparent p-0 font-medium text-slate-500"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              Guruhlarim
            </button>
            <span className="text-slate-300 font-semibold">/</span>
            <span className="font-semibold text-slate-800">{group.name}</span>
          </div>

          {/* Page heading */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[13px] font-medium text-slate-400">Guruh profili · O'qituvchi paneli</p>
              <h2 className="text-[22px] font-bold text-slate-900 mt-0.5 flex items-center gap-2.5">
                {group.name}
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md ${group.status === "active" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {group.status_display}
                </span>
              </h2>
              <p className="text-[13px] text-slate-500 mt-1">
                {[group.course, group.room].filter(Boolean).join(" · ") || "Guruh ma'lumotlari"}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {group.telegram_link && (
                <a
                  href={group.telegram_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 hover:text-[#2563eb] transition-colors cursor-pointer no-underline"
                >
                  <TelegramIcon className="w-4 h-4" />
                  Telegram
                </a>
              )}
              <button
                onClick={openEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] shadow-sm transition-colors cursor-pointer border-none"
              >
                <PencilIcon className="w-4 h-4" />
                Tahrirlash
              </button>
            </div>
          </div>

          {/* Group info card */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)] mb-6">
            <div className="divide-y divide-gray-100">
              <div className="grid grid-cols-2 xl:grid-cols-4">
                <InfoCell label="Nomi">{group.name}</InfoCell>
                <InfoCell label="Kurs">{group.course || "—"}</InfoCell>
                <InfoCell label="Xona">{group.room || "—"}</InfoCell>
                <InfoCell label="Ta'lim turi">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#dbeafe] text-[#1d4ed8] text-[12.5px] font-semibold">
                    {group.education_type_display}
                  </span>
                </InfoCell>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4">
                <InfoCell label="Dars vaqti">
                  {group.lesson_times.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {group.lesson_times.map((lt, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-green-600">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {lt.start_time.slice(0, 5)}—{lt.end_time.slice(0, 5)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </InfoCell>
                <InfoCell label="Kun">
                  {group.lesson_times.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {group.lesson_times.map((lt, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#fffbeb] text-[#b45309] text-[12px] font-semibold">
                          {lt.days_display}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </InfoCell>
                <InfoCell label="O'qituvchi">
                  {[emp.first_name, emp.last_name].filter(Boolean).join(" ") || "—"}
                </InfoCell>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4">
                <InfoCell label="Guruh vaqti">
                  <span className="text-slate-900">{formatDate(group.start_date)}</span>
                  <span className="mx-2 text-slate-300">—</span>
                  <span className="text-slate-900">{formatDate(group.end_date)}</span>
                </InfoCell>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => onAttendance(group.id)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2001FF] text-white text-[14px] font-semibold hover:opacity-90 shadow-sm transition-opacity cursor-pointer border-none"
            >
              <ClipboardCheckIcon className="w-5 h-5" />
              Davomat
            </button>
            {group.telegram_link && (
              <a
                href={group.telegram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-transparent text-[#2563eb] border-2 border-[#2563eb] text-[14px] font-semibold hover:bg-[#eff6ff] transition-colors cursor-pointer no-underline"
              >
                <TelegramIcon className="w-5 h-5" />
                Telegram guruh
              </a>
            )}
          </div>

          {/* Students card */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
              <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                <UsersIcon className="w-[18px] h-[18px] text-[#2001FF]" />
                O'quvchilar
                <span className="min-w-[24px] h-6 px-2 rounded-md bg-[#2563eb] text-white text-[11px] font-bold inline-flex items-center justify-center">
                  {students.length}
                </span>
              </h3>
            </div>

            {students.length === 0 ? (
              <div className="p-16 text-center">
                <UsersIcon className="w-10 h-10 text-[#2001ff] opacity-35 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-[#1a1a2e] mb-1">O'quvchilar yo'q</h3>
                <p className="text-sm text-gray-400">Bu guruhda hali o'quvchilar mavjud emas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-3 text-left w-12">№</th>
                      <th className="px-6 py-3 text-left">O'quvchi</th>
                      <th className="px-6 py-3 text-left">Holati</th>
                      <th className="px-6 py-3 text-left">Bugungi davomat</th>
                      <th className="px-6 py-3 text-right">Balans</th>
                      <th className="px-6 py-3 text-right">Telefon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s, idx) => {
                      const avInitials = (s.first_name[0] + s.last_name[0]).toUpperCase()
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 text-slate-400 font-medium">{idx + 1}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#eff6ff] border border-[#bfdbfe] text-[#2563eb] flex items-center justify-center font-bold text-[13px] shrink-0">
                                {avInitials}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
                                {(s.attendance_status === "absent" || s.attendance_status === "excused") && s.attendance_notes && (
                                  <p className={`text-[12px] mt-0.5 flex items-center gap-1 ${s.attendance_status === "absent" ? "text-red-500" : "text-orange-500"}`}>
                                    {s.attendance_status === "absent" ? (
                                      <XCircleIcon className="w-3 h-3 shrink-0" />
                                    ) : (
                                      <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                                    )}
                                    {s.attendance_notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            {s.is_frozen ? (
                              <StatusBadge status="frozen" label="Muzlatilgan" />
                            ) : (
                              <StatusBadge status="active" label="Faol" />
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            {s.attendance_status ? (
                              <span className="inline-flex items-center gap-1.5">
                                <AttendanceStatusIcon status={s.attendance_status} />
                                <span className={s.attendance_status === "present" ? "text-green-700" : s.attendance_status === "absent" ? "text-red-500" : "text-orange-500"}>
                                  {s.attendance_status === "present" ? "Keldi" : s.attendance_status === "absent" ? "Kelmadi" : "Sababli"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right whitespace-nowrap">
                            {typeof s.balance === "number" ? (
                              <span className={`font-bold ${s.balance < 0 ? "text-red-500" : "text-slate-700"}`}>
                                {s.balance.toLocaleString("ru-RU")} so'm
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right text-slate-600 font-medium whitespace-nowrap">
                            {s.phone}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-[#2563eb] transition-colors cursor-pointer border-none bg-transparent p-0"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Orqaga · Guruhlarim
          </button>
        </div>
      </DesktopShell>

      {/* Edit group sheet */}
      {editOpen && data && (
        <div className="fixed inset-0 z-[110]">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={() => setEditOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-premium-lg animate-slide-in-upside max-h-[92vh] overflow-hidden">
            <div className="max-w-lg mx-auto w-full flex flex-col max-h-[92vh] overflow-hidden">
              <div className="pt-3 pb-1 px-4 shrink-0">
                <div className="w-9 h-1.5 rounded-full bg-gray-200 mx-auto" />
              </div>
              <div className="px-5 py-3 pb-2 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[17px] font-bold text-gray-900">Guruhni tahrirlash</h3>
                  <p className="text-[11px] font-medium text-gray-400">O'zingiz biriktirilgan guruh ma'lumotlari</p>
                </div>
                <button onClick={() => setEditOpen(false)} className="w-8 h-8 rounded-full bg-[#F2F3F5] flex items-center justify-center text-gray-500 btn-hover border-none cursor-pointer shrink-0">
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="px-5 overflow-y-auto pb-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Guruh nomi</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Guruh nomini kiriting"
                    className="w-full px-3.5 py-3 text-[14px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900 focus:border-[#2001FF]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dars vaqtlari</label>
                    <button
                      onClick={() => setEditLessonTimes((prev) => [...prev, { days: "", start_time: "10:00", end_time: "11:00" }])}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#2001FF] bg-[#2001FF]/10 border-none cursor-pointer btn-hover"
                    >
                      + Qo'shish
                    </button>
                  </div>
                  {editLessonTimes.length === 0 ? (
                    <p className="text-center text-[12px] text-gray-400 py-6 bg-[#F7F8FA] rounded-2xl">Dars vaqtlari yo'q. Qo'shing.</p>
                  ) : (
                    <div className="space-y-3">
                      {editLessonTimes.map((row, i) => (
                        <div key={i} className="bg-[#F7F8FA] rounded-2xl p-3.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-bold text-gray-700">Dars vaqti {i + 1}</span>
                            <button
                              onClick={() => setEditLessonTimes((prev) => prev.filter((_, idx) => idx !== i))}
                              className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-red-500 border border-gray-200 btn-hover cursor-pointer"
                            >
                              <CloseIcon className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {DAYS.map(([key, label]) => {
                              const active = row.days.split(",").map((d) => d.trim()).includes(key)
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => toggleEditDay(i, key)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                                    active ? "bg-[#2001FF] text-white border-[#2001FF] shadow-sm shadow-[#2001FF]/25" : "bg-white text-gray-500 border-gray-200"
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={row.start_time}
                              onChange={(e) => setEditRowTime(i, "start_time", e.target.value)}
                              className="flex-1 px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900"
                            />
                            <span className="text-gray-300 font-bold shrink-0">—</span>
                            <input
                              type="time"
                              value={row.end_time}
                              onChange={(e) => setEditRowTime(i, "end_time", e.target.value)}
                              className="flex-1 px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Telegram guruh havolasi (ixtiyoriy)</label>
                  <input
                    value={editTelegram}
                    onChange={(e) => setEditTelegram(e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full px-3.5 py-3 text-[14px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900 focus:border-[#2001FF]"
                  />
                </div>

                {editError && <p className="text-[12px] font-semibold text-red-500">{editError}</p>}
              </div>

              <div className="px-5 py-3.5 border-t border-gray-100 shrink-0 safe-bottom">
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="w-full py-3 rounded-xl text-[14px] font-bold text-white bg-[#2001FF] btn-hover active:scale-[0.98] disabled:opacity-50"
                >
                  {editSaving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
