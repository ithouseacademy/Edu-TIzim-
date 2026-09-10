import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ChevronLeft, UserRound, CalendarDays, CalendarCheck, Info, BookOpen, MapPin, Users, Clock, GraduationCap } from "lucide-react"
import { api } from "../api"
import type { GroupAttendanceData } from "../types"

const STATUS_META: Record<string, { label: string; symbol: string; cls: string; text: string }> = {
  present: { label: "Keldi", symbol: "✓", cls: "bg-[#2001FF]", text: "text-[#2001FF]" },
  absent: { label: "Kelmadi", symbol: "✕", cls: "bg-red-500", text: "text-red-400" },
  excused: { label: "Sababli", symbol: "±", cls: "bg-amber-400", text: "text-amber-500" },
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

export default function GroupDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState<GroupAttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({})
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingStatus | null>(null)
  const [view, setView] = useState<"choose" | "info" | "attendance">("choose")
  const groupId = Number(id)

  const todayStr = localTodayISO()

  const initDraft = (d: GroupAttendanceData): Record<string, DraftEntry> => {
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
    const now = new Date()
    setLoading(true)
    setError("")
    api.groupAttendance(groupId, now.getFullYear(), now.getMonth() + 1)
      .then((d) => {
        setData(d)
        setDraft(initDraft(d))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [groupId])

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
      await api.saveAttendance(groupId, records)
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

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-6">
      {/* Nav bar */}
      <div className="bg-[#2001FF] text-white px-4 pt-3 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => nav("/groups")}
            className="w-9 h-9 flex items-center justify-center btn-hover rounded-full hover:bg-white/10"
          >
            <ChevronLeft size={26} className="text-white" strokeWidth={2.5} />
          </button>
          <h1 className="text-[16px] font-bold tracking-tight truncate px-2">
            {grp?.name || "Guruh"}
          </h1>
          {view !== "choose" && (
            <button
              onClick={() => setView("choose")}
              className="text-[13px] font-semibold text-white/90 px-2 py-1 rounded-lg hover:bg-white/10 btn-hover"
            >
              Orqaga
            </button>
          )}
          {view === "choose" && <span className="w-9" />}
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
            <button onClick={() => nav("/groups")} className="text-[13px] font-semibold text-[#2001FF]">Guruhlarga qaytish</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : !data ? null : view === "choose" ? (
          /* ============ TANLOV EKRANI ============ */
          <div className="mt-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 text-center mb-5">
              <div className="w-16 h-16 mx-auto bg-[#2001FF] rounded-full flex items-center justify-center mb-3 shadow-lg shadow-[#2001FF]/20">
                <BookOpen size={26} className="text-white" />
              </div>
              <p className="text-[16px] font-bold text-gray-900">{grp?.name}</p>
              {grp?.course && <p className="text-[12px] font-medium text-gray-400 mt-0.5">{grp.course}</p>}
              <div className="flex items-center justify-center gap-2 mt-2">
                {grp?.teacher && (
                  <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                    <GraduationCap size={12} /> {grp.teacher}
                  </span>
                )}
                {grp?.room && (
                  <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                    <MapPin size={12} /> {grp.room}-xona
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setView("attendance")}
                className="w-full card-premium p-5 flex items-center gap-4 text-left btn-hover active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-[#2001FF] rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-[#2001FF]/20">
                  <CalendarCheck size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-gray-900">Davomat qilish</p>
                  <p className="text-[12px] font-medium text-gray-400 mt-0.5">Bugungi darsda qatnashganlarni belgilang</p>
                </div>
                <span className="text-gray-300 font-bold text-[20px]">›</span>
              </button>

              <button
                onClick={() => setView("info")}
                className="w-full card-premium p-5 flex items-center gap-4 text-left btn-hover active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-[#2001FF]/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Info size={22} className="text-[#2001FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-gray-900">Guruh ma'lumotlari</p>
                  <p className="text-[12px] font-medium text-gray-400 mt-0.5">Kurs, xona va dars vaqtini ko'ring</p>
                </div>
                <span className="text-gray-300 font-bold text-[20px]">›</span>
              </button>
            </div>
          </div>
        ) : view === "info" ? (
          /* ============ GURUH MA'LUMOTLARI ============ */
          <div className="mt-4">
            <div className="card-premium overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#2001FF] rounded-2xl flex items-center justify-center shrink-0">
                    <BookOpen size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">{grp?.name}</p>
                    <p className="text-[11px] font-medium text-gray-400">{grp?.course || "Kurs yo'q"}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {grp?.teacher && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-3">
                      <GraduationCap size={17} className="text-[#2001FF] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">O'qituvchi</p>
                        <p className="text-[13px] font-bold text-gray-900">{grp.teacher}</p>
                      </div>
                    </div>
                  )}
                  {grp?.lesson_time && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-3">
                      <Clock size={17} className="text-[#2001FF] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Dars vaqti</p>
                        <p className="text-[13px] font-bold text-gray-900">{grp.lesson_time}</p>
                      </div>
                    </div>
                  )}
                  {grp?.room && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-3">
                      <MapPin size={17} className="text-[#2001FF] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Xona</p>
                        <p className="text-[13px] font-bold text-gray-900">{grp.room}-xona</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3.5 py-3">
                    <Users size={17} className="text-[#2001FF] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">O'quvchilar</p>
                      <p className="text-[13px] font-bold text-gray-900">{students.length} ta</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============ DAVOMAT ============ */
          <div className="mt-3">
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
                            <UserRound size={20} className="text-gray-400" />
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
  )
}
