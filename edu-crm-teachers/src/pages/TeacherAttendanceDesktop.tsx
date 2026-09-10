import { useEffect, useRef, useState, type MouseEvent } from "react"
import { ChevronLeft, UserRound, CalendarDays, CalendarCheck, Download, History, Check, X, User, ChevronDown } from "lucide-react"
import { api } from "../api"
import type { AttendanceData } from "../types"
import DesktopShell from "../components/DesktopShell"

const STATUS_META: Record<string, { label: string; symbol: string; cls: string; text: string }> = {
  present: { label: "Keldi", symbol: "✓", cls: "bg-[#2001FF]", text: "text-[#2001FF]" },
  absent: { label: "Kelmadi", symbol: "✕", cls: "bg-red-500", text: "text-red-400" },
  excused: { label: "Sababli", symbol: "±", cls: "bg-amber-400", text: "text-amber-500" },
}

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]

function StatusCircle({ status }: { status?: string }) {
  if (status === "present") {
    return (
      <span className="inline-flex w-[20px] h-[20px] rounded-full border-[1.5px] border-green-500 bg-white items-center justify-center shrink-0">
        <svg className="w-[11px] h-[11px]" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    )
  }
  if (status === "excused") {
    return (
      <span className="inline-flex w-[20px] h-[20px] rounded-full border-[1.5px] border-slate-400 bg-white items-center justify-center shrink-0">
        <span className="text-amber-500 text-[12px] font-bold leading-none">!</span>
      </span>
    )
  }
  if (status === "absent") {
    return (
      <span className="inline-flex w-[20px] h-[20px] rounded-full border-[1.5px] border-red-500 bg-white items-center justify-center shrink-0">
        <span className="text-red-500 text-[14px] font-bold leading-none">−</span>
      </span>
    )
  }
  return (
    <span className="inline-flex w-[20px] h-[20px] rounded-full border border-slate-200 bg-white items-center justify-center shrink-0" />
  )
}

interface PendingStatus {
  status: string
  reason: string
  comment: string
}

interface DraftEntry {
  status: string
  notes: string
}

function localTodayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function TeacherAttendanceDesktop({ groupId, onBack }: { groupId: number; onBack: () => void }) {
  const [data, setData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({})
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingStatus | null>(null)

  const todayStr = localTodayISO()
  const [selYear, setSelYear] = useState(new Date().getFullYear())
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1)

  const initDraft = (d: AttendanceData): Record<string, DraftEntry> => {
    const map: Record<string, DraftEntry> = {}
    for (const s of d.students) {
      const saved = d.att_matrix[String(s.id)]?.[todayStr]
      const savedNotes = d.att_notes[String(s.id)]?.[todayStr]
      map[String(s.id)] = {
        status: saved ? saved : "present",
        notes: savedNotes || "",
      }
    }
    return map
  }

  useEffect(() => {
    setLoading(true)
    setError("")
    api.groupAttendance(groupId, selYear, selMonth)
      .then((d) => {
        setData(d)
        setDraft(initDraft(d))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [groupId, selYear, selMonth])

  const setDraftStatus = (studentId: number, status: string, notes = "") => {
    setDraft((prev) => ({ ...prev, [String(studentId)]: { status, notes } }))
  }

  const handleStatusTap = (studentId: number, status: string) => {
    if (status === "present") {
      setDraftStatus(studentId, status)
      setSelectedStudent(null)
      setPending(null)
    } else {
      setPending({ status, reason: "", comment: "" })
    }
  }

  const confirmPending = () => {
    if (selectedStudent == null || !pending) return
    const notes = pending.reason && pending.comment.trim()
      ? `${pending.reason} | ${pending.comment.trim()}`
      : pending.reason || pending.comment.trim()
    setDraftStatus(selectedStudent, pending.status, notes)
    setSelectedStudent(null)
    setPending(null)
  }

  const saveAll = async () => {
    if (!data?.can_edit) return
    setSaving(true)
    setError("")
    const records = Object.entries(draft)
      .map(([sid, entry]) => ({
        student_id: Number(sid),
        date: todayStr,
        status: entry.status,
        notes: entry.notes,
      }))
    try {
      await api.takeAttendance(groupId, records)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2500)
      setData((prev) => {
        if (!prev) return prev
        const matrix = { ...prev.att_matrix }
        const notesMap = { ...prev.att_notes }
        for (const [sid, entry] of Object.entries(draft)) {
          const row = { ...(matrix[sid] || {}) }
          row[todayStr] = entry.status
          matrix[sid] = row
          const notesRow = { ...(notesMap[sid] || {}) }
          if (entry.notes) notesRow[todayStr] = entry.notes
          else delete notesRow[todayStr]
          notesMap[sid] = notesRow
        }
        return { ...prev, att_matrix: matrix, att_notes: notesMap }
      })
    } catch (err: any) {
      setError(err.message || "Saqlashda xatolik")
    } finally {
      setSaving(false)
    }
  }

  const students = data?.students || []
  const isTodayLesson = (data?.lesson_dates || []).includes(todayStr)
  const grp = data?.group
  const lessonTimeOnly = (grp?.lesson_time || "").match(/\d{2}:\d{2} - \d{2}:\d{2}/)?.[0] || grp?.lesson_time || "—"

  return (
    <>
    {/* ====== Mobile View ====== */}
    <div className="md:hidden min-h-screen bg-[#F8F9FC] pb-6">
      {/* Nav bar */}
      <div className="bg-[#2001FF] text-white px-4 pt-3 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center btn-hover rounded-full hover:bg-white/10"
          >
            <ChevronLeft size={26} className="text-white" strokeWidth={2.5} />
          </button>
          <h1 className="text-[16px] font-bold tracking-tight truncate px-2">{grp?.name || "Davomat"}</h1>
          <span className="w-9" />
        </div>
      </div>

      {savedToast && (
        <div className="absolute left-0 right-0 mx-auto max-w-lg px-3 z-[95]" style={{ top: "4.5rem" }}>
          <div className="bg-white rounded-full shadow-premium-lg border border-green-100 px-4 py-2.5 mx-auto w-fit flex items-center gap-2 animate-fade-in">
            <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="text-[13px] font-bold text-gray-900">Davomat saqlandi</span>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-3 -mt-1">
        {error && !data && (
          <div className="mt-4 bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[13px] font-medium text-red-500 mb-3">{error}</p>
            <button onClick={onBack} className="text-[13px] font-semibold text-[#2001FF]">Orqaga qaytish</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : !data ? null : (
          <div className="mt-3">
            {/* Group bar */}
            <div className="card-premium overflow-hidden mb-3 animate-scale-in">
              <div className="bg-gradient-to-b from-[#3E37FF] via-[#2001FF] to-[#1B00E0] text-white px-4 py-4 pb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shrink-0">
                    <CalendarCheck size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-tight truncate">{grp?.name}</p>
                    <p className="text-[10px] font-medium text-white/70 mt-px truncate">{grp?.course || "Kurs"}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-50 -mt-4">
                <div className="card-premium-sm m-1.5 p-2.5 text-center rounded-xl">
                  <p className="text-[13px] font-bold text-[#2001FF] leading-none">{students.length}</p>
                  <p className="text-[9px] font-medium text-gray-400 mt-1">O'quvchi</p>
                </div>
                <div className="card-premium-sm m-1.5 p-2.5 text-center rounded-xl">
                  <p className="text-[13px] font-bold text-[#2001FF] leading-none truncate">{lessonTimeOnly}</p>
                  <p className="text-[9px] font-medium text-gray-400 mt-1">Dars vaqti</p>
                </div>
                <div className="card-premium-sm m-1.5 p-2.5 text-center rounded-xl">
                  <p className="text-[13px] font-bold text-[#2001FF] leading-none truncate">{grp?.room || "—"}</p>
                  <p className="text-[9px] font-medium text-gray-400 mt-1">Xona</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 mb-2.5">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-[#2001FF]" />
                <p className="text-[13px] font-bold text-gray-900">Bugungi dars</p>
              </div>
              {data && data.can_edit && isTodayLesson && (
                <button
                  onClick={saveAll}
                  disabled={saving}
                  className="shrink-0 px-5 py-2 rounded-full text-[13px] font-bold text-white bg-[#2001FF] shadow-[0_4px_14px_rgba(32,1,255,0.35)] active:scale-[0.96] active:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {students.length === 0 ? (
                <div className="p-8 text-center">
                  <UserRound size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-[13px] font-medium text-gray-400">O'quvchilar yo'q</p>
                </div>
              ) : !isTodayLesson ? (
                <div className="p-8 text-center">
                  <CalendarDays size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-[13px] font-medium text-gray-400">Bugun dars kuni emas</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {students.map((s, idx) => {
                    const entry = draft[String(s.id)] || { status: "present", notes: "" }
                    const st = entry.status
                    const meta = STATUS_META[st] || null
                    const name = `${s.first_name} ${s.last_name}`
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudent(s.id)}
                        disabled={!data?.can_edit}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 animate-fade-in text-left transition-colors ${
                          data?.can_edit ? "active:bg-gray-50" : ""
                        }`}
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full bg-[#E8E9EB] border-2 border-[#2001FF] flex items-center justify-center">
                            <span className="text-[13px] font-bold text-[#2001FF]">
                              {s.first_name[0]}{s.last_name[0]}
                            </span>
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${st === "present" ? "bg-[#2001FF]" : st === "absent" ? "bg-red-500" : "bg-amber-400"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-[#1C1C1E] truncate">{name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className={`text-[12px] font-medium ${meta ? meta.text : "text-gray-400"}`}>
                              {meta ? meta.label : "Biror holat tanlanmagan"}
                            </p>
                            {(st === "absent" || st === "excused") && entry.notes && (
                              <span className={`text-[11px] font-medium ${st === "absent" ? "text-red-400" : "text-amber-500"}`}>
                                · {entry.notes}
                              </span>
                            )}
                            {typeof s.balance === "number" && (
                              <span className="text-[11px] font-bold text-[#2001FF] bg-[#2001FF]/5 px-1.5 py-0.5 rounded-md shrink-0">
                                {s.balance.toLocaleString("ru-RU")} so'm
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-gray-300 font-bold text-[17px] shrink-0">›</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {data && !data.can_edit && (
              <p className="text-center text-[11px] font-medium text-gray-400 mt-3">
                Davomatni belgilash faqat dars vaqti davomida mumkin
              </p>
            )}
          </div>
        )}
      </div>

      {/* Davomat holati tanlash sheet */}
      {selectedStudent != null && data && data.can_edit && isTodayLesson && (() => {
        const selStudent = students.find((s) => s.id === selectedStudent)
        const current = draft[String(selectedStudent)]?.status || "present"
        return (
          <div className="fixed inset-0 z-[90]">
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={() => { setSelectedStudent(null); setPending(null) }} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] shadow-premium-lg animate-slide-in-upside safe-bottom">
              <div className="max-w-lg mx-auto">
                <div className="pt-3 pb-1 flex justify-between items-center px-4">
                  <div className="w-9 h-1.5 rounded-full bg-gray-200 mx-auto" />
                </div>
                <div className="px-4 py-4">
                  <p className="text-[14px] font-bold text-gray-900 text-center mb-1">
                    {selStudent ? `${selStudent.first_name} ${selStudent.last_name}` : ""}
                  </p>
                  <p className="text-[11px] font-medium text-gray-400 text-center mb-4">Davomat holatini tanlang</p>
                  <div className="space-y-1.5">
                    {Object.entries(STATUS_META).map(([key, m]) => {
                      const active = current === key || (pending && pending.status === key && key !== "present")
                      return (
                        <button
                          key={key}
                          onClick={() => handleStatusTap(selectedStudent, key)}
                          disabled={saving}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all btn-hover active:scale-[0.98] ${
                            active ? "bg-[#2001FF]/5 border border-[#2001FF]/30" : "bg-[#F2F3F5] border border-transparent"
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white ${m.cls}`}>
                            {m.symbol}
                          </span>
                          <span className={`flex-1 text-[14px] font-bold ${active ? "text-[#2001FF]" : "text-gray-900"}`}>
                            {m.label}
                          </span>
                          {(key === "absent" || key === "excused") && pending?.status === key && (
                            <span className="text-[10px] font-semibold text-gray-400">Sababni tanlang ↓</span>
                          )}
                          {active && current === key && <span className="text-[#2001FF]">✓</span>}
                        </button>
                      )
                    })}
                  </div>

                  {pending && (
                    <div className="mt-3 animate-fade-in">
                      <div className="bg-[#F2F3F5] rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-gray-600 mb-1.5">
                          {pending.status === "absent" ? "Kelmadi" : "Sababli"} sababini tanlang{" "}
                          <span className="font-medium text-gray-400">(ixtiyoriy)</span>
                        </p>
                        <select
                          value={pending.reason}
                          onChange={(e) => setPending({ ...pending, reason: e.target.value })}
                          className="w-full px-3 py-2.5 text-[13px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900"
                        >
                          <option value="">Sababni tanlang...</option>
                          {data.absence_reasons?.map((r) => (
                            <option key={r.id} value={r.name}>{r.name}</option>
                          ))}
                          <option value="__other__">Boshqa</option>
                        </select>
                        <input
                          type="text"
                          value={pending.comment}
                          onChange={(e) => setPending({ ...pending, comment: e.target.value })}
                          placeholder="Izoh yozing (ixtiyoriy)..."
                          className="w-full mt-2 px-3.5 py-2.5 text-[13px] bg-white border border-gray-200 rounded-xl outline-none text-gray-900"
                        />
                        <button
                          onClick={confirmPending}
                          disabled={saving}
                          className="w-full mt-2.5 py-3 rounded-xl text-[13px] font-bold text-white bg-[#2001FF] btn-hover active:scale-[0.98] disabled:opacity-50"
                        >
                          {pending.status === "absent" ? "Kelmadi" : "Sababli"} qilib belgilash
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
{/* ====== Desktop View ====== */}
    <TeacherAttendanceDesktopView
      dateStr={todayStr}
      group={grp}
      students={students}
      lessonDates={data?.lesson_dates || []}
      attMatrix={data?.att_matrix || {}}
      attNotes={data?.att_notes || {}}
      attHistory={data?.student_att_history || {}}
      isTodayLesson={isTodayLesson}
      canEdit={!!data?.can_edit}
      draft={draft}
      saving={saving}
      savedToast={savedToast}
      absenceReasons={data?.absence_reasons || []}
      selYear={selYear}
      selMonth={selMonth}
      onYearChange={setSelYear}
      onMonthChange={setSelMonth}
      onApply={setDraftStatus}
      onSave={saveAll}
    />
    </>
  )
}

function AttDot({ status }: { status?: string }) {
  if (status === "present") {
    return <span className="w-7 h-7 rounded-full bg-[#22c55e] text-white flex items-center justify-center text-[12px] font-bold">✓</span>
  }
  if (status === "absent") {
    return <span className="w-7 h-7 rounded-full bg-[#ef4444] text-white flex items-center justify-center text-[12px] font-bold">✕</span>
  }
  if (status === "excused") {
    return <span className="w-7 h-7 rounded-full bg-[#f59e0b] text-white flex items-center justify-center text-[12px] font-bold">!</span>
  }
  return <span className="w-7 h-7 rounded-full border border-slate-300 bg-white text-slate-400 flex items-center justify-center text-[13px] font-bold">–</span>
}

function TeacherAttendanceDesktopView({
  dateStr,
  group,
  students,
  lessonDates,
  attMatrix,
  attNotes,
  attHistory,
  isTodayLesson,
  canEdit,
  draft,
  saving,
  savedToast,
  absenceReasons,
  selYear,
  selMonth,
  onYearChange,
  onMonthChange,
  onApply,
  onSave,
}: {
  dateStr: string
  group: AttendanceData["group"] | undefined
  students: AttendanceData["students"]
  lessonDates: string[]
  attMatrix: Record<string, Record<string, string>>
  attNotes: Record<string, Record<string, string>>
  attHistory: Record<string, { date: string; status: string; notes: string; teacher: string }[]>
  isTodayLesson: boolean
  canEdit: boolean
  draft: Record<string, { status: string; notes: string }>
  saving: boolean
  savedToast: boolean
  absenceReasons: { id: number; name: string }[]
  selYear: number
  selMonth: number
  onYearChange: (y: number) => void
  onMonthChange: (m: number) => void
  onApply: (studentId: number, status: string, notes?: string) => void
  onSave: () => void
}) {
  const [pop, setPop] = useState<{ sid: number; date: string; x: number; y: number } | null>(null)
  const [comment, setComment] = useState<{ sid: number; date: string; status: string; x: number; y: number } | null>(null)
  const [cReason, setCReason] = useState("")
  const [cComment, setCComment] = useState("")
  const [datePop, setDatePop] = useState<{ date: string; x: number; y: number } | null>(null)
  const [histId, setHistId] = useState<number | null>(null)
  const [inlineOpen, setInlineOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState("")
  const [toastErr, setToastErr] = useState(false)
  const toastTimer = useRef<number | null>(null)

  const editable = canEdit && isTodayLesson
  const curYear = new Date().getFullYear()
  const DAYS = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]
  const wdOf = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number)
    return DAYS[new Date(y, m - 1, d).getDay()]
  }
  const fmtDate = (iso: string) => {
    const p = iso.split("-")
    return `${p[2]}.${p[1]}`
  }
  const fmtFullDate = (iso: string) => {
    const p = iso.split("-")
    return `${p[2]}.${p[1]}.${p[0]}`
  }
  const lessonTimeOnly = (group?.lesson_time || "").match(/\d{2}:\d{2} - \d{2}:\d{2}/)?.[0] || group?.lesson_time || "—"

  const statusOf = (sid: number, date: string) =>
    date === dateStr ? draft[String(sid)]?.status || "present" : attMatrix[String(sid)]?.[date]

  const noteFor = (sid: number, date: string) => attNotes[String(sid)]?.[date]

  const counts = { jami: students.length, keldi: 0, kelmadi: 0, sababli: 0 }
  for (const s of students) {
    const st = statusOf(s.id, dateStr)
    if (st === "present") counts.keldi++
    else if (st === "absent") counts.kelmadi++
    else if (st === "excused") counts.sababli++
  }

  const parity = lessonDates.length
    ? Number(lessonDates[0].split("-")[2]) % 2 === 1
      ? "Toq kunlar"
      : "Juft kunlar"
    : ""
  const dayNames = [...new Set(lessonDates.map((d) => wdOf(d)))].join(", ")

  const dayInd = (date: string) => {
    let present = 0
    let absent = 0
    let excused = 0
    let marked = 0
    for (const s of students) {
      const st = statusOf(s.id, date)
      if (!st) continue
      marked++
      if (st === "present") present++
      else if (st === "absent") absent++
      else if (st === "excused") excused++
    }
    if (marked === 0) return { icon: "–", cls: "text-slate-300 bg-slate-100 ring-slate-200", title: "Belgilanmagan" }
    if (present === marked) return { icon: "✓", cls: "text-green-600 bg-green-50 ring-green-200", title: "Hammasi keldi" }
    if (present === 0) return { icon: "✗", cls: "text-red-500 bg-red-50 ring-red-200", title: "Hammasi kelmagan" }
    return { icon: "!", cls: "text-amber-500 bg-amber-50 ring-amber-200", title: "Qisman kelmagan" }
  }

  const histList = (sid: number) =>
    (attHistory[String(sid)] || []).slice().sort((a, b) => b.date.localeCompare(a.date))

  const studentName = (sid: number) => {
    const s = students.find((st) => st.id === sid)
    return s ? `${s.first_name} ${s.last_name}` : ""
  }

  const statusLabel = (st?: string) =>
    st === "present" ? "Keldi" : st === "absent" ? "Kelmadi" : st === "excused" ? "Sababli" : "Belgilanmagan"

  const chipCls = (st?: string) =>
    st === "present"
      ? "bg-green-50 text-green-700"
      : st === "absent"
        ? "bg-red-50 text-red-600"
        : st === "excused"
          ? "bg-amber-50 text-amber-600"
          : "bg-slate-50 text-slate-500"

  const dotColor = (st?: string) =>
    st === "present" ? "bg-green-500" : st === "absent" ? "bg-red-500" : st === "excused" ? "bg-amber-500" : "bg-slate-300"

  const showToast = (msg: string, err = false) => {
    setToastMsg(msg)
    setToastErr(err)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 2600)
  }

  const closeAll = () => {
    setPop(null)
    setComment(null)
    setDatePop(null)
  }

  const openPop = (e: MouseEvent<HTMLButtonElement>, sid: number, date: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vw = window.innerWidth
    let x = r.left
    let y = r.bottom + 6
    if (x + 210 > vw) x = vw - 218
    if (x < 8) x = 8
    if (y + 240 > window.innerHeight) y = Math.max(8, r.top - 252)
    setPop({ sid, date, x, y })
  }

  const openDateAt = (e: MouseEvent<HTMLButtonElement>, date: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    const vw = window.innerWidth
    let x = r.left
    const y = r.bottom + 6
    if (x + 240 > vw) x = vw - 248
    if (x < 8) x = 8
    setDatePop({ date, x, y })
  }

  const openCommentAt = (sid: number, date: string, status: string, x: number, y: number) => {
    let nx = x
    let ny = y
    const vw = window.innerWidth
    if (nx + 320 > vw) nx = vw - 328
    if (nx < 8) nx = 8
    if (ny + 300 > window.innerHeight) ny = Math.max(8, window.innerHeight - 308)
    setComment({ sid, date, status, x: nx, y: ny })
    setCReason("")
    setCComment(noteFor(sid, date) || "")
  }

  const chooseStatus = (status: string) => {
    if (!pop) return
    const { sid, date, x, y } = pop
    if (status === "present") {
      onApply(sid, "present", "")
      setPop(null)
      showToast("Keldi deb belgilandi")
    } else if (status === "absent" || status === "excused") {
      onApply(sid, status, "")
      setPop(null)
      openCommentAt(sid, date, status, x, y)
    } else if (status === "edit") {
      const cur = statusOf(sid, date) || "present"
      setPop(null)
      openCommentAt(sid, date, cur, x, y)
    } else if (status === "clear") {
      onApply(sid, attMatrix[String(sid)]?.[date] || "present", attNotes[String(sid)]?.[date] || "")
      setPop(null)
      showToast("Holat belgilanmagan holatga qaytarildi")
    }
  }

  const saveComment = () => {
    if (!comment) return
    const { sid, status } = comment
    const notes = cReason && cComment.trim() ? `${cReason} | ${cComment.trim()}` : cReason || cComment.trim()
    onApply(sid, status, notes)
    setComment(null)
    setCReason("")
    setCComment("")
    showToast("Izoh saqlandi")
  }

  const markAllPresent = () => {
    if (!datePop) return
    if (!editable || datePop.date !== dateStr) {
      setDatePop(null)
      showToast("Faqat bugungi dars uchun mumkin", true)
      return
    }
    for (const s of students) onApply(s.id, "present", "")
    setDatePop(null)
    showToast("Barcha o'quvchilar Keldi deb belgilandi")
  }

  const clearAllDate = () => {
    if (!datePop) return
    if (!editable || datePop.date !== dateStr) {
      setDatePop(null)
      showToast("Faqat bugungi dars uchun mumkin", true)
      return
    }
    for (const s of students) {
      onApply(s.id, attMatrix[String(s.id)]?.[dateStr] || "present", attNotes[String(s.id)]?.[dateStr] || "")
    }
    setDatePop(null)
    showToast("Bugungi belgilar olib tashlandi")
  }

  const resetDraft = () => {
    for (const s of students) {
      onApply(s.id, attMatrix[String(s.id)]?.[dateStr] || "present", attNotes[String(s.id)]?.[dateStr] || "")
    }
    showToast("O'zgarishlar bekor qilindi")
  }

  const exportCSV = () => {
    const headers = ["№", "Ism", "Telefon raqam", "Balans", "To'lov sanasi", ...lessonDates.map((d, i) => `${i + 1}-dars ${fmtDate(d)}`)]
    const rows = students.map((s, idx) => [
      String(idx + 1).padStart(2, "0"),
      `${s.first_name} ${s.last_name}`,
      `${s.phone}`,
      typeof s.balance === "number" ? String(s.balance) : "",
      "—",
      ...lessonDates.map((d) => statusOf(s.id, d) || ""),
    ])
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${group?.name || "guruh"}-davomat.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DesktopShell
      activeKey="groups"
      navItems={[
        { key: "dashboard", label: "Dashboard", icon: null, onClick: () => (window.location.hash = "#dashboard") },
        { key: "groups", label: "Mening guruhlarim", icon: null, onClick: () => (window.location.hash = "#my-groups") },
        { key: "salary", label: "Mening oyligim", icon: null, onClick: () => (window.location.hash = "#salary") },
        { key: "tasks", label: "Topshiriqlar", icon: null, onClick: () => (window.location.hash = "#tasks") },
        { key: "profile", label: "Profil", icon: null, onClick: () => (window.location.hash = "#profile") },
      ]}
      headerActions={
        <>
          {savedToast && (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold animate-fade-in">
              <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              Saqlandi
            </div>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
          >
            <Download size={15} strokeWidth={2.2} />
            Export
          </button>
          <div className="relative h-9">
            <select
              value={selYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="h-9 pl-3 pr-8 text-[13px] font-medium text-slate-700 bg-white border border-gray-200 rounded-lg outline-none cursor-pointer appearance-none"
            >
              {[curYear, curYear - 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative h-9">
            <select
              value={selMonth}
              onChange={(e) => onMonthChange(Number(e.target.value))}
              className="h-9 pl-3 pr-8 text-[13px] font-medium text-slate-700 bg-white border border-gray-200 rounded-lg outline-none cursor-pointer appearance-none"
            >
              {UZ_MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <input
              type="date"
              value={dateStr}
              readOnly
              className="h-9 pl-3 pr-8 w-[152px] text-[13px] font-medium text-slate-700 bg-white border border-gray-200 rounded-lg outline-none cursor-default"
            />
            <CalendarDays size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </>
      }
    >
      <style>{`@keyframes popFade { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } } .animate-pop { animation: popFade 0.16s ease; } .slide-in-right { animation: slideInRight 0.22s ease; }`}</style>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed left-1/2 top-20 -translate-x-1/2 z-[2000]">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-[13px] font-semibold animate-pop ${toastErr ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-gray-200 text-slate-800"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${toastErr ? "bg-red-500" : "bg-green-500"}`}>
              {toastErr ? <span className="text-[12px] font-bold">!</span> : <Check size={12} strokeWidth={3.5} />}
            </span>
            {toastMsg}
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => (window.location.hash = group?.id ? `#group-detail/${group.id}` : "#my-groups")}
            className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shrink-0"
            title="Orqaga"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-slate-400">O'qituvchi paneli · Guruhlar</p>
            <h2 className="text-[22px] font-bold text-slate-900 leading-tight truncate">Davomat jadvali</h2>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[12px] font-medium text-slate-500 pb-1 shrink-0">
          <span className="flex items-center gap-1.5"><StatusCircle status="present" /> Keldi</span>
          <span className="flex items-center gap-1.5"><StatusCircle status="absent" /> Kelmadi</span>
          <span className="flex items-center gap-1.5"><StatusCircle status="excused" /> Sababli</span>
          <span className="flex items-center gap-1.5"><StatusCircle /> Belgilanmagan</span>
        </div>
      </div>

      {/* Group info card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)] mb-4">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0">
              <CalendarCheck size={16} />
            </span>
            <p className="text-[14px] font-semibold text-slate-800">Guruh ma'lumotlari</p>
          </div>
          <span className="text-[12px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            {typeof group?.remaining_days === "number" ? `${group.remaining_days} dars qoldi` : "—"}
          </span>
        </div>
        <table className="w-full text-[13px] border-separate border-spacing-0">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Nomi</td>
              <td className="px-5 py-3 font-semibold text-slate-800 border-b border-r border-gray-100">{group?.name || "—"}</td>
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Darjasi</td>
              <td className="px-5 py-3 font-medium text-slate-700 border-b border-gray-100">{group?.course || "—"}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Kurs vaqti</td>
              <td className="px-5 py-3 font-medium text-slate-700 border-b border-r border-gray-100">{lessonTimeOnly}</td>
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Turi</td>
              <td className="px-5 py-3 border-b border-gray-100">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eff6ff] text-[#1d4ed8]">Oflayn</span>
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Xona</td>
              <td className="px-5 py-3 font-medium text-slate-700 border-b border-r border-gray-100">{group?.room || "—"}</td>
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Kurs</td>
              <td className="px-5 py-3 font-medium text-slate-700 border-b border-gray-100">{group?.course || "—"}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">Kun</td>
              <td className="px-5 py-3 border-b border-r border-gray-100">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  {parity && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fffbeb] text-[#b45309]">{parity}</span>
                  )}
                  <span className="text-[12.5px] font-medium text-slate-600">{dayNames || "—"}</span>
                </span>
              </td>
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60 border-b border-gray-100">O'qituvchi</td>
              <td className="px-5 py-3 font-medium text-slate-700 border-b border-gray-100">
                <span className="inline-flex items-center gap-1.5">
                  <User size={13} className="text-slate-400 shrink-0" />
                  {group?.teacher || "—"}
                </span>
              </td>
            </tr>
            <tr>
              <td className="w-[150px] px-5 py-3 text-[12px] font-semibold text-slate-400 bg-slate-50/60">Guruh vaqti</td>
              <td colSpan={3} className="px-5 py-3 font-medium text-slate-700">
                {group?.start_date ? fmtFullDate(group.start_date) : "—"}
                {group?.end_date ? ` — ${fmtFullDate(group.end_date)}` : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Stats chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-[15px] font-bold shrink-0">{counts.jami}</span>
          <div>
            <p className="text-[12.5px] font-bold text-slate-800 leading-tight">Jami o'quvchi</p>
            <p className="text-[11px] font-medium text-slate-400 leading-tight">{lessonDates.length} dars</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center text-[15px] font-bold shrink-0">{counts.keldi}</span>
          <div>
            <p className="text-[12.5px] font-bold text-slate-800 leading-tight">Keldi</p>
            <p className="text-[11px] font-medium text-slate-400 leading-tight">Keldi</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-[15px] font-bold shrink-0">{counts.kelmadi}</span>
          <div>
            <p className="text-[12.5px] font-bold text-slate-800 leading-tight">Kelmadi</p>
            <p className="text-[11px] font-medium text-slate-400 leading-tight">Kelmadi</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center text-[15px] font-bold shrink-0">{counts.sababli}</span>
          <div>
            <p className="text-[12.5px] font-bold text-slate-800 leading-tight">Sababli</p>
            <p className="text-[11px] font-medium text-slate-400 leading-tight">Sababli</p>
          </div>
        </div>
      </div>

      {/* Attendance table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-[3px] h-4 bg-[#2563eb] rounded-full" />
            <span className="text-[14px] font-semibold text-slate-800">Davomat jadvali</span>
            <span className="text-[12px] font-medium text-slate-400">{lessonDates.length} dars · {students.length} o'quvchi</span>
          </div>
          {!editable && (
            <span className="text-[11.5px] font-medium text-slate-400">
              Davomatni belgilash faqat dars vaqti davomida mumkin
            </span>
          )}
        </div>
        {students.length === 0 ? (
          <div className="p-14 text-center">
            <UserRound size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-[13px] font-medium text-gray-400">O'quvchilar yo'q</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-440px)]">
            <table className="border-separate border-spacing-0 min-w-full text-[13px]">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-40 w-[44px] px-2 py-3 bg-white border-b border-r border-gray-200 text-center text-[11px] font-semibold text-slate-400">№</th>
                  <th className="sticky top-0 left-[44px] z-40 w-[220px] px-4 py-3 bg-white border-b border-r border-gray-200 text-left text-[12px] font-semibold text-slate-500">O'quvchi</th>
                  <th className="sticky top-0 left-[264px] z-40 w-[130px] px-3 py-3 bg-white border-b border-r border-gray-200 text-left text-[12px] font-semibold text-slate-500">Sabab</th>
                  {lessonDates.map((d, i) => {
                    const isToday = d === dateStr
                    const ind = dayInd(d)
                    return (
                      <th
                        key={d}
                        className={`sticky top-0 z-30 w-[84px] px-1.5 pt-2.5 pb-2 border-b border-l border-gray-100 text-center align-top ${isToday ? "bg-[#eff6ff]" : "bg-white"}`}
                      >
                        <button
                          onClick={(e) => openDateAt(e, d)}
                          className="w-full cursor-pointer group"
                          title="Barcha o'quvchilar uchun belgilash"
                        >
                          <div className={`leading-tight text-[12.5px] font-semibold ${isToday ? "text-[#2563eb]" : "text-slate-600"}`}>{i + 1}-dars</div>
                          <div className={`text-[10.5px] font-medium mt-0.5 group-hover:text-[#2563eb] ${isToday ? "text-[#2563eb]/80" : "text-slate-400"}`}>{fmtDate(d)}</div>
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mt-1 ring-1 ring-inset ${ind.cls}`}
                            title={ind.title}
                          >
                            {ind.icon}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                  <th className="sticky top-0 right-0 z-40 w-[60px] px-2 py-3 bg-white border-b border-l border-gray-200 text-center text-[11px] font-semibold text-slate-400">Tarix</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => {
                  const sabab = noteFor(s.id, dateStr)
                  return (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-20 w-[44px] px-2 py-[11px] bg-white border-b border-r border-gray-100 text-center text-[12px] text-slate-400">{String(idx + 1).padStart(2, "0")}</td>
                      <td className="sticky left-[44px] z-20 w-[220px] px-4 py-[11px] bg-white border-b border-r border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-[11px] font-bold shrink-0">
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-800 truncate">{s.first_name} {s.last_name}</p>
                            <p className="text-[11px] font-medium text-slate-400 truncate">{s.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="sticky left-[264px] z-20 w-[130px] px-3 py-[11px] bg-white border-b border-r border-gray-100">
                        <span className="block text-[12px] font-medium text-slate-500 truncate max-w-[120px]" title={sabab || undefined}>
                          {sabab || "—"}
                        </span>
                      </td>
                      {lessonDates.map((d) => {
                        const isToday = d === dateStr
                        const status = statusOf(s.id, d)
                        return (
                          <td key={d} className={`w-[84px] px-1.5 py-[11px] text-center border-b border-l border-gray-100 ${isToday ? "bg-[#fbfdff]" : "bg-white"}`}>
                            {isToday && editable ? (
                              <button
                                onClick={(e) => openPop(e, s.id, d)}
                                className="inline-flex cursor-pointer border-none bg-transparent p-0"
                                title="Davomatni belgilash"
                              >
                                <AttDot status={status} />
                              </button>
                            ) : (
                              <span className="inline-flex"><AttDot status={status} /></span>
                            )}
                          </td>
                        )
                      })}
                      <td className="sticky right-0 z-20 w-[60px] px-2 py-[11px] bg-white border-b border-l border-gray-100 text-center">
                        <button
                          onClick={() => setHistId(s.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#2563eb] transition-colors cursor-pointer"
                          title="Tarixni ko'rish"
                        >
                          <History size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline history & notes */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.06)] mt-4 overflow-hidden">
        <button
          onClick={() => setInlineOpen(!inlineOpen)}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 cursor-pointer border-none bg-white hover:bg-slate-50/60 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0">
              <History size={16} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-slate-800">Tarix & Izohlar</p>
              <p className="text-[11.5px] font-medium text-slate-400">Saqlangan davomatlar va sabablar</p>
            </div>
          </div>
          <span className={`text-slate-400 transition-transform duration-200 shrink-0 ${inlineOpen ? "rotate-180" : ""}`}>
            <ChevronDown size={18} />
          </span>
        </button>
        {inlineOpen && (
          <div className="border-t border-gray-100 divide-y divide-gray-100 max-h-[380px] overflow-y-auto">
            {students.length === 0 && (
              <div className="p-8 text-center text-[13px] font-medium text-gray-400">Ma'lumotlar yo'q</div>
            )}
            {students.map((s) => {
              const hist = histList(s.id).filter((h) => h.date !== dateStr)
              return (
                <div key={s.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[13px] font-semibold text-slate-700">{s.first_name} {s.last_name}</p>
                    <button
                      onClick={() => setHistId(s.id)}
                      className="text-[11.5px] font-semibold text-[#2563eb] hover:underline cursor-pointer border-none bg-transparent p-0"
                    >
                      Barcha tarix →
                    </button>
                  </div>
                  {hist.length === 0 ? (
                    <p className="text-[12px] font-medium text-slate-400">Saqlangan yozuvlar yo'q</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {hist.slice(0, 8).map((h, i) => (
                        <span key={i} className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2 py-1 ${chipCls(h.status)}`}>
                          <span className={`w-2 h-2 rounded-full ${dotColor(h.status)}`} />
                          {fmtFullDate(h.date)}
                          {h.notes && <span className="font-medium max-w-[160px] truncate">· {h.notes}</span>}
                        </span>
                      ))}
                      {hist.length > 8 && (
                        <span className="inline-flex items-center text-[11px] font-bold rounded-lg px-2 py-1 bg-slate-100 text-slate-500">
                          +{hist.length - 8}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom save bar */}
      {editable && (
        <>
          <div className="h-16" />
          <div className="fixed bottom-0 left-[260px] right-0 z-[60] bg-white/95 backdrop-blur border-t border-gray-200 px-8 py-3 flex items-center justify-between gap-4">
            <p className="text-[12.5px] font-medium text-slate-500">
              Bugungi dars: <span className="font-bold text-green-600">{counts.keldi} keldi</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-bold text-red-500">{counts.kelmadi} kelmadi</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-bold text-amber-500">{counts.sababli} sababli</span>
            </p>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={resetDraft}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Bekor qilish
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-[#2563eb] text-white text-[13px] font-bold hover:bg-[#1d4ed8] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Status popup */}
      {pop && (
        <>
          <div className="fixed inset-0 z-[900]" onClick={closeAll} />
          <div className="fixed z-[1000] w-[210px] bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 animate-pop" style={{ left: pop.x, top: pop.y }}>
            <button
              onClick={() => chooseStatus("present")}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <AttDot status="present" /> Keldi
            </button>
            <button
              onClick={() => chooseStatus("absent")}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <AttDot status="absent" /> Kelmadi
            </button>
            <button
              onClick={() => chooseStatus("excused")}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <AttDot status="excused" /> Sababli
            </button>
            <button
              onClick={() => chooseStatus("edit")}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <span className="w-7 h-7 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-400 text-[12px]">✎</span>
              Sabab yozish
            </button>
            <button
              onClick={() => chooseStatus("clear")}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <AttDot /> Belgilanmagan
            </button>
          </div>
        </>
      )}

      {/* Comment popup */}
      {comment && (
        <>
          <div className="fixed inset-0 z-[900]" onClick={() => setComment(null)} />
          <div className="fixed z-[1000] w-[320px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4 animate-pop" style={{ left: comment.x, top: comment.y }}>
            <div className="flex items-center gap-2.5 mb-3">
              <AttDot status={comment.status} />
              <p className="text-[13px] font-bold text-slate-800 truncate">{studentName(comment.sid)}</p>
              <span className="text-[11.5px] font-semibold text-slate-400">{statusLabel(comment.status)}</span>
              <button
                onClick={() => setComment(null)}
                className="ml-auto w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-sm flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer border-none shrink-0"
              >
                ×
              </button>
            </div>
            <select
              value={cReason}
              onChange={(e) => setCReason(e.target.value)}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none text-slate-800 bg-white focus:border-[#2563eb]"
            >
              <option value="">Sababni tanlang...</option>
              {absenceReasons.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
              <option value="__other__">Boshqa</option>
            </select>
            <input
              type="text"
              value={cComment}
              onChange={(e) => setCComment(e.target.value)}
              placeholder="Izoh yozing (ixtiyoriy)..."
              className="w-full mt-2 text-[13px] border border-gray-200 rounded-lg px-3 py-2 outline-none text-slate-800 bg-white focus:border-[#2563eb]"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setComment(null)}
                className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-500 text-[12.5px] font-semibold hover:bg-slate-200 transition-colors cursor-pointer border-none"
              >
                Bekor qilish
              </button>
              <button
                onClick={saveComment}
                className="flex-1 py-2 rounded-lg bg-[#2563eb] text-white text-[12.5px] font-semibold hover:bg-[#1d4ed8] transition-colors cursor-pointer border-none"
              >
                Saqlash
              </button>
            </div>
          </div>
        </>
      )}

      {/* Date actions popup */}
      {datePop && (
        <>
          <div className="fixed inset-0 z-[900]" onClick={() => setDatePop(null)} />
          <div className="fixed z-[1000] w-[240px] bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 animate-pop" style={{ left: datePop.x, top: datePop.y }}>
            <p className="px-3.5 py-2 text-[11.5px] font-semibold text-slate-400">
              {fmtFullDate(datePop.date)} · o'quvchilar
            </p>
            <button
              onClick={markAllPresent}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-green-50 hover:text-green-700 rounded-lg transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <Check size={15} strokeWidth={2.5} className="text-green-600" />
              Barchini Keldi qilish
            </button>
            <button
              onClick={clearAllDate}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors cursor-pointer border-none bg-transparent text-left"
            >
              <X size={15} strokeWidth={2.5} className="text-red-500" />
              Barchini olib tashlash
            </button>
          </div>
        </>
      )}

      {/* History drawer */}
      {histId != null && (() => {
        const s = students.find((st) => st.id === histId)
        const hist = histList(histId)
        return (
          <>
            <div className="fixed inset-0 z-[9998] bg-slate-900/40" onClick={() => setHistId(null)} />
            <div className="fixed top-0 right-0 h-full w-[380px] z-[9999] bg-white shadow-2xl slide-in-right flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-[13px] font-bold shrink-0">
                  {s ? `${s.first_name[0]}${s.last_name[0]}` : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-slate-900 truncate">{s ? `${s.first_name} ${s.last_name}` : "O'quvchi"}</p>
                  <p className="text-[12px] font-medium text-slate-400">{s?.phone}</p>
                </div>
                <button
                  onClick={() => setHistId(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer border-none shrink-0"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {hist.length === 0 ? (
                  <div className="text-center py-16">
                    <User size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-[13px] font-medium text-gray-400">Tarix yozuvlari yo'q</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {hist.map((h, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3.5 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[12px] font-semibold text-slate-700">{fmtFullDate(h.date)}</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${chipCls(h.status)}`}>
                            <span className={`w-2 h-2 rounded-full ${dotColor(h.status)}`} />
                            {statusLabel(h.status)}
                          </span>
                        </div>
                        {h.notes && <p className="text-[12px] text-slate-500">{h.notes}</p>}
                        {h.teacher && <p className="text-[11px] text-slate-400 mt-1.5">Belgilagan: {h.teacher}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}
    </DesktopShell>
  )
}
