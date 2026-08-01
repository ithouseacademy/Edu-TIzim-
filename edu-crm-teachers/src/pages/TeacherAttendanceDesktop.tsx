import { useEffect, useState, useRef, useCallback, type JSX } from "react"
import { api } from "../api"
import type { AttendanceData } from "../types"
import * as XLSX from "xlsx"

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function GraduationCapIcon({ className }: { className?: string }) {
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} fill="none" />
    </svg>
  )
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
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

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}



const MONTHS_UZ = ["", "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"]

const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; label: string; iconEl: (cn?: string) => JSX.Element }> = {
  present: { icon: "check", color: "text-green-600", bg: "bg-green-500", border: "border-green-500", label: "Keldi", iconEl: (cn) => <CheckIcon className={cn || "w-3.5 h-3.5"} /> },
  absent: { icon: "x", color: "text-red-500", bg: "bg-red-500", border: "border-red-500", label: "Kelmadi", iconEl: (cn) => <XIcon className={cn || "w-3.5 h-3.5"} /> },
  excused: { icon: "exclamation", color: "text-orange-500", bg: "bg-orange-500", border: "border-orange-500", label: "Sababli", iconEl: (cn) => <ExclamationIcon className={cn || "w-3.5 h-3.5"} /> },
  none: { icon: "minus", color: "text-gray-300", bg: "bg-white", border: "border-gray-200", label: "Belgilanmagan", iconEl: (cn) => <MinusIcon className={cn || "w-3.5 h-3.5"} /> },
}

function formatISO(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}.${m}`
}

function getTodayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function TeacherAttendanceDesktop({ groupId, onBack }: { groupId: number; onBack: () => void }) {
  const [data, setData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [localMatrix, setLocalMatrix] = useState<Record<string, Record<string, string>>>({})
  const [localNotes, setLocalNotes] = useState<Record<string, Record<string, string>>>({})
  const [selectedCell, setSelectedCell] = useState<{ studentId: number; date: string; el: HTMLElement } | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [sheetStudent, setSheetStudent] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const [sheetNotesOpen, setSheetNotesOpen] = useState(false)
  const [sheetReason, setSheetReason] = useState("")
  const [sheetComment, setSheetComment] = useState("")
  const sheetRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await api.groupAttendance(groupId, year, month)
      setData(result)
      setLocalMatrix(result.att_matrix || {})
      setLocalNotes(result.att_notes || {})
    } catch (err: any) {
      setError(err.message || "Ma'lumot yuklanmadi")
    } finally {
      setLoading(false)
    }
  }, [groupId, year, month])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (selectedCell && !(e.target as HTMLElement).closest("[data-popup]") && !(e.target as HTMLElement).closest("[data-att-btn]")) {
        setSelectedCell(null)
      }
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [selectedCell])

  const setCellStatus = useCallback(async (studentId: number, date: string, status: string, notes?: string) => {
    setLocalMatrix(prev => ({ ...prev, [studentId]: { ...prev[studentId], [date]: status } }))
    if (notes !== undefined) {
      setLocalNotes(prev => ({ ...prev, [studentId]: { ...prev[studentId], [date]: notes } }))
    }
    const key = `${studentId}-${date}`
    setFlashKey(key)
    setTimeout(() => setFlashKey(null), 800)
    setSelectedCell(null)
    try {
      await api.takeAttendance(groupId, [{ student_id: studentId, date, status, notes: notes || "" }])
    } catch (err: any) {
      console.error("Save failed", err)
    }
  }, [groupId])

  function openCellPopup(studentId: number, date: string, el: HTMLElement) {
    setSelectedCell({ studentId, date, el })
  }

  function getStats() {
    let present = 0, absent = 0, excused = 0
    if (!data) return { total: 0, present: 0, absent: 0, excused: 0 }
    const students = data.students
    const dates = data.lesson_dates
    for (const s of students) {
      const row = localMatrix[s.id] || {}
      for (const d of dates) {
        const st = row[d]
        if (st === "present") present++
        else if (st === "absent") absent++
        else if (st === "excused") excused++
      }
    }
    return { total: students.length, present, absent, excused }
  }

  function getTodayStatus(studentId: number): string {
    const today = getTodayISO()
    return localMatrix[studentId]?.[today] || "none"
  }

  function exportCSV() {
    if (!data) return
    const { students, lesson_dates, att_matrix, att_notes, group } = data
    const statusLabel: Record<string, string> = { present: "Keldi", absent: "Kelmadi", excused: "Sababli" }
    const months = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"]
    const header = ["O'quvchi", "Telefon", ...lesson_dates.map(d => {
      const [, m, day] = d.split("-")
      return `${day}.${m}`
    }), "Izoh"]
    const rows = students.map(s => {
      const rowData = lesson_dates.map(d => {
        const st = att_matrix[s.id]?.[d]
        return statusLabel[st] || "-"
      })
      const notes = lesson_dates.map(d => att_notes[s.id]?.[d]).filter(Boolean).join("; ")
      return [`${s.first_name} ${s.last_name}`, `+998${s.phone}`, ...rowData, notes || ""]
    })
    const csvContent = [header.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n")
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${group.name}_davomat_${year}_${months[month-1]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  function exportExcel() {
    if (!data) return
    const { students, lesson_dates, att_matrix, att_notes, group } = data
    const statusLabel: Record<string, string> = { present: "Keldi", absent: "Kelmadi", excused: "Sababli" }
    const months = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"]
    const header = ["O'quvchi", "Telefon", ...lesson_dates.map(d => {
      const [, m, day] = d.split("-")
      return `${day}.${m}`
    }), "Izoh"]
    const rows = students.map(s => {
      const rowData = lesson_dates.map(d => {
        const st = att_matrix[s.id]?.[d]
        return statusLabel[st] || "-"
      })
      const notes = lesson_dates.map(d => att_notes[s.id]?.[d]).filter(Boolean).join("; ")
      return [`${s.first_name} ${s.last_name}`, `+998${s.phone}`, ...rowData, notes || ""]
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws["!cols"] = [{ wch: 25 }, { wch: 18 }, ...lesson_dates.map(() => ({ wch: 12 })), { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, "Davomat")
    XLSX.writeFile(wb, `${group.name}_davomat_${year}_${months[month-1]}.xlsx`)
    setShowExport(false)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function openSheet(studentId: number) {
    setSheetStudent(studentId)
    setShowSheet(true)
    setSheetNotesOpen(false)
    setSheetReason("")
    setSheetComment("")
  }

  function closeSheet() {
    setShowSheet(false)
    setSheetStudent(null)
  }

  async function mobileSetStatus(status: string) {
    if (sheetStudent === null) return
    const today = getTodayISO()
    await setCellStatus(sheetStudent, today, status)
    closeSheet()
  }

  async function mobileSaveNotes() {
    if (sheetStudent === null) return
    if (!sheetReason && !sheetComment.trim()) return
    const notes = sheetReason && sheetComment.trim() ? `${sheetReason} | ${sheetComment.trim()}` : sheetReason || sheetComment.trim()
    const today = getTodayISO()
    const currentStatus = localMatrix[sheetStudent]?.[today] || "present"
    await setCellStatus(sheetStudent, today, currentStatus, notes)
    closeSheet()
  }

  async function saveAllRecords() {
    if (!data) return
    setSaving(true)
    try {
      const records: { student_id: number; date: string; status: string; notes?: string }[] = []
      for (const s of data.students) {
        const row = localMatrix[s.id] || {}
        const notesRow = localNotes[s.id] || {}
        for (const d of data.lesson_dates) {
          const status = row[d]
          if (status && status !== "none") {
            records.push({ student_id: s.id, date: d, status, notes: notesRow[d] || "" })
          }
        }
      }
      await api.takeAttendance(groupId, records)
      alert("Davomat saqlandi")
    } catch (err: any) {
      alert("Xatolik: " + (err.message || ""))
    } finally {
      setSaving(false)
    }
  }

  function getStudentHistory(studentId: number): { date: string; status: string; notes: string; teacher: string }[] {
    return data?.student_att_history?.[studentId] || []
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <div className="text-gray-500 text-lg">Yuklanmoqda...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl text-sm">
          {error || "Ma'lumot topilmadi"}
          <button onClick={loadData} className="ml-3 underline">Qayta urinish</button>
        </div>
      </div>
    )
  }

  const { group, students, lesson_dates } = data

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* ===== DESKTOP SIDEBAR ===== */}
      <div className="hidden md:flex fixed top-0 left-0 w-[260px] h-screen bg-white border-r border-gray-200 z-50 flex-col">
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
            onClick={() => window.location.hash = "#dashboard"}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 text-sm font-medium cursor-pointer w-full border-none text-left mb-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Dashboard
          </button>
          <button
            onClick={() => window.location.hash = "#my-groups"}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:bg-gray-100 text-sm font-medium cursor-pointer w-full border-none text-left"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
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
      </div>

      {/* ===== MAIN CONTENT (shared mobile + desktop) ===== */}
      <div className="min-h-screen md:ml-[260px] flex flex-col">
        {/* ===== DESKTOP HEADER ===== */}
        <div className="hidden md:flex bg-white border-b border-gray-200 h-[68px] items-center px-8 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#2001ff] hover:border-[#2001ff] transition-all cursor-pointer bg-white">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-[#1a1a2e] ml-2">Davomat jadvali</h1>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg border border-gray-200 bg-white text-[12px] font-semibold text-gray-700 hover:border-[#2001ff] hover:text-[#2001ff] hover:bg-[#eef0ff] transition-all cursor-pointer"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Export
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px] z-50">
                  <button onClick={exportCSV} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer border-none bg-transparent text-left">
                    <DownloadIcon className="w-4 h-4 text-gray-500" />
                    CSV
                  </button>
                  <button onClick={exportExcel} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer border-none bg-transparent text-left">
                    <DownloadIcon className="w-4 h-4 text-gray-500" />
                    Excel
                  </button>
                </div>
              )}
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-[7px] pr-7 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 bg-white appearance-none cursor-pointer outline-none focus:border-[#2001ff] focus:ring-3 focus:ring-[#2001ff]/10 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22 fill=%22%2394a3b8%22%3E%3Cpath d=%22M0 0l5 6 5-6z%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center]"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-[7px] pr-7 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 bg-white appearance-none cursor-pointer outline-none focus:border-[#2001ff] focus:ring-3 focus:ring-[#2001ff]/10 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22 fill=%22%2394a3b8%22%3E%3Cpath d=%22M0 0l5 6 5-6z%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center]"
            >
              {MONTHS_UZ.filter((_, i) => i > 0).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ===== MOBILE HEADER ===== */}
        <div className="block md:hidden flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-40">
          <button onClick={onBack} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 cursor-pointer bg-white shrink-0">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold text-[#1a1a2e]">Davomat jadvali</h1>
        </div>

        <div className="flex-1 px-4 md:px-8 pt-4 md:pt-6 pb-28 md:pb-8 overflow-y-auto">
          {/* ===== GROUP BAR ===== */}
          <div className="bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] px-5 py-4 mb-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#eef0ff] flex items-center justify-center text-[#2001ff] shrink-0">
                  <GraduationCapIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-[#0f172a]">{group.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px] text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <GraduationCapIcon className="w-3 h-3 text-gray-400" />
                      Davomat
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      {students.length} ta o'quvchi
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-[12px] flex-wrap">
                {group.start_date && group.end_date && (
                  <>
                    <span className="text-gray-500 font-medium px-3 py-1 rounded-lg bg-gray-50 border border-gray-200">
                      {group.start_date.slice(8,10)}.{group.start_date.slice(5,7)}.{group.start_date.slice(0,4)} - {group.end_date.slice(8,10)}.{group.end_date.slice(5,7)}.{group.end_date.slice(0,4)}
                    </span>
                    {group.remaining_days !== null && group.remaining_days !== undefined ? (
                      group.remaining_days > 0 ? (
                        <span className="text-orange-500 font-semibold px-3 py-1 rounded-lg bg-orange-50 border border-orange-200">
                          Tugashiga {group.remaining_days} kun
                        </span>
                      ) : (
                        <span className="text-red-500 font-semibold px-3 py-1 rounded-lg bg-red-50 border border-red-200">
                          Muddati tugagan
                        </span>
                      )
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ===== STATS ROW ===== */}
          <div className="hidden md:grid grid-cols-4 gap-2 mb-5">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] text-[13px] font-semibold text-[#2001ff]">
              <span className="text-[18px] font-extrabold">{stats.total}</span>
              Jami o'quvchi
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] text-[13px] font-semibold text-green-600">
              <span className="text-[18px] font-extrabold">{stats.present}</span>
              Keldi
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] text-[13px] font-semibold text-red-500">
              <span className="text-[18px] font-extrabold">{stats.absent}</span>
              Kelmadi
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] text-[13px] font-semibold text-orange-500">
              <span className="text-[18px] font-extrabold">{stats.excused}</span>
              Sababli
            </div>
          </div>

          {/* ===== MOBILE STUDENT LIST ===== */}
          <div className="block md:hidden">
            <div className="flex flex-col gap-2">
              {students.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <UsersIcon className="w-9 h-9 mx-auto mb-2 opacity-30" />
                  O'quvchilar mavjud emas
                </div>
              ) : (
                students.map((s) => {
                  const status = getTodayStatus(s.id)
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none
                  const initials = (s.first_name[0] + s.last_name[0]).toUpperCase()
                  return (
                    <div
                      key={s.id}
                      onClick={() => data?.can_edit && openSheet(s.id)}
                      className={`bg-white rounded-[14px] px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] flex items-center gap-3 ${data?.can_edit ? "cursor-pointer active:scale-[0.98]" : ""} transition-transform select-none`}
                    >
                      <div className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 relative ${["present", "none"].includes(status) ? "bg-green-500" : status === "absent" ? "bg-red-500" : status === "excused" ? "bg-orange-500" : "bg-gray-400"}`}>
                        {initials}
                        <div className={`absolute inset-[-3px] rounded-xl border-[3px] border-transparent ${["present", "none"].includes(status) ? "border-green-500/30" : status === "absent" ? "border-red-500/30" : status === "excused" ? "border-orange-500/30" : "border-gray-400/30"}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-[#0f172a]">{s.first_name} {s.last_name}</div>
                        <div className={`text-[12px] font-medium mt-0.5 flex items-center gap-1 ${cfg.color}`}>
                          {cfg.iconEl("w-3.5 h-3.5")}
                          {cfg.label}
                        </div>
                      </div>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] shrink-0 border-[1.5px] ${status === "present" || status === "none" ? "bg-green-50 border-green-300 text-green-600" : status === "absent" ? "bg-red-50 border-red-300 text-red-500" : status === "excused" ? "bg-orange-50 border-orange-300 text-orange-500" : "bg-gray-50 border-gray-300 text-gray-500"}`}>
                        {cfg.iconEl("w-3.5 h-3.5")}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ===== TARIX & IZOHLAR (Mobile) ===== */}
          {data.is_admin && (
          <div className="block md:hidden mt-4">
            <div className="bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-[14px] font-bold text-[#0f172a]">Tarix & Izohlar</span>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {(() => {
                  const historyEntries: { date: string; studentName: string; studentId: number; status: string; notes: string }[] = []
                  for (const [sid, entries] of Object.entries(data.student_att_history || {})) {
                    const s = students.find(st => st.id === Number(sid))
                    const studentName = s ? `${s.first_name} ${s.last_name}` : `#${sid}`
                    for (const e of entries) {
                      historyEntries.push({ date: e.date, studentName, studentId: Number(sid), status: e.status, notes: e.notes })
                    }
                  }
                  historyEntries.sort((a, b) => b.date.localeCompare(a.date))
                  if (historyEntries.length === 0) {
                    return <div className="text-center py-6 text-gray-400 text-[12px]">Izohlar mavjud emas</div>
                  }
                  return (
                    <div className="divide-y divide-gray-50">
                      {historyEntries.map((h, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-start gap-2 text-[12px]">
                          <div className="flex-shrink-0 w-[60px] text-[10px] font-semibold text-gray-400 pt-0.5">{h.date.slice(5)}</div>
                          <a href={`/students/${h.studentId}/profile/`} className="flex-shrink-0 text-[12px] font-semibold text-gray-700 min-w-[100px] hover:text-[#2001ff] underline underline-offset-2 decoration-gray-300">{h.studentName}</a>
                          <span className={`flex-shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${h.status === "Kelmadi" ? "bg-red-50 text-red-600" : h.status === "Sababli" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>
                            {h.status}
                          </span>
                          <span className="text-gray-500 flex-1">{h.notes && h.notes !== "None" ? h.notes : <span className="text-gray-300">&mdash;</span>}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
          )}

        {/* ===== BOTTOM SHEET (Mobile) ===== */}
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}
          className={`fixed inset-0 bg-black/35 z-[999] backdrop-blur-[2px] ${showSheet ? "block" : "hidden"}`}
        ></div>
        <div
          ref={sheetRef}
          className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-[20px] z-[1000] px-4 pb-7 pt-3 transition-transform duration-300 max-h-[80vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.15)] ${showSheet ? "translate-y-0" : "translate-y-full"}`}
          style={{ transform: showSheet ? "translateY(0)" : "translateY(100%)" }}
        >
          <div className="w-9 h-1 rounded bg-gray-200 mx-auto mb-3.5"></div>
          <div className="text-[16px] font-bold text-[#0f172a] text-center mb-3.5">
            {sheetStudent !== null && (() => {
              const s = students.find((st) => st.id === sheetStudent)
              return s ? `${s.first_name} ${s.last_name}` : ""
            })()}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => mobileSetStatus("present")}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer border-none w-full text-left bg-green-50 text-green-600 border-[1.5px] border-green-300 active:scale-[0.98] transition-transform"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Keldi
            </button>
            <button
              onClick={() => mobileSetStatus("absent")}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer border-none w-full text-left bg-red-50 text-red-500 border-[1.5px] border-red-300 active:scale-[0.98] transition-transform"
            >
              <XCircleIcon className="w-5 h-5" />
              Kelmadi
            </button>
            <button
              onClick={() => mobileSetStatus("excused")}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer border-none w-full text-left bg-orange-50 text-orange-500 border-[1.5px] border-orange-300 active:scale-[0.98] transition-transform"
            >
              <AlertCircleIcon className="w-5 h-5" />
              Sababli
            </button>
          </div>
          <button
            onClick={() => setSheetNotesOpen(!sheetNotesOpen)}
            className="block mx-auto mt-2.5 w-9 h-9 rounded-full border-[1.5px] border-dashed border-gray-300 bg-gray-50 cursor-pointer text-base text-gray-400 hover:text-[#2001ff] hover:border-[#2001ff] hover:bg-[#eef0ff] transition-all"
          >
            <PlusIcon className="w-4 h-4 mx-auto" />
          </button>
          {sheetNotesOpen && (
            <div className="mt-2.5 pt-2.5 border-t border-gray-200">
              <div className="text-[12px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Izoh qo'shish
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={sheetReason}
                  onChange={(e) => setSheetReason(e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-2.5 text-[13px] border border-gray-200 rounded-[10px] outline-none bg-gray-50 text-gray-700"
                >
                  <option value="">Sababni tanlang...</option>
                </select>
                <input
                  type="text"
                  value={sheetComment}
                  onChange={(e) => setSheetComment(e.target.value)}
                  placeholder="Izoh yozing..."
                  className="flex-[2] min-w-[120px] px-3.5 py-2.5 text-[13px] border border-gray-200 rounded-[10px] outline-none bg-gray-50"
                />
                <button
                  onClick={mobileSaveNotes}
                  className="px-4 py-2.5 rounded-[10px] text-[14px] font-bold border-none cursor-pointer bg-[#2001ff] text-white"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
              {sheetStudent !== null && getStudentHistory(sheetStudent).length > 0 && (
                <div className="mt-2 max-h-[150px] overflow-y-auto">
                  <div className="text-[11px] font-semibold text-gray-400 mb-1">Tarix</div>
                  {getStudentHistory(sheetStudent).map((h, i) => (
                    <div key={i} className="flex items-center gap-1.5 py-1 border-b border-gray-50 text-[12px] text-gray-600">
                      <span className="font-semibold text-gray-400 whitespace-nowrap min-w-[50px]">{h.date.slice(5)}</span>
                      <span className={`inline-block px-1.5 rounded text-[10px] font-semibold whitespace-nowrap ${h.status === "Kelmadi" ? "bg-red-50 text-red-600" : h.status === "Sababli" ? "bg-orange-50 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                        {h.status}
                      </span>
                      <span className="flex-1">{h.notes === "None" ? "" : h.notes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== DESKTOP TABLE ===== */}
        <div className="bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden hidden md:block">
          <div ref={tableRef} className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-[#f8fafc] border-b-2 border-gray-200 whitespace-nowrap" style={{ minWidth: 40, width: 40 }}>
                    №
                  </th>
                  <th className="sticky left-[40px] z-10 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-[#f8fafc] border-b-2 border-gray-200 whitespace-nowrap" style={{ minWidth: 220 }}>
                    O'quvchi
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-[#f8fafc] border-b-2 border-gray-200 whitespace-nowrap max-lg:hidden" style={{ minWidth: 110 }}>
                    Telefon
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-[#f8fafc] border-b-2 border-gray-200 whitespace-nowrap max-[480px]:hidden" style={{ minWidth: 70 }}>
                    Balans
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-[#f8fafc] border-b-2 border-gray-200 whitespace-nowrap" style={{ minWidth: 120 }}>
                    Sabab
                  </th>
                  {lesson_dates.map((ld, i) => (
                    <th key={ld} className="text-center px-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-[#f8fafc] border-b-2 border-gray-200 whitespace-nowrap" style={{ minWidth: 52 }}>
                      <span className="block text-[11px] font-bold text-[#0f172a] normal-case tracking-normal">{i + 1}-dars</span>
                      <span className="block text-[9px] font-semibold text-gray-500 normal-case tracking-normal">{formatISO(ld)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5 + lesson_dates.length} className="text-center py-10 text-gray-400">
                      O'quvchilar mavjud emas
                    </td>
                  </tr>
                ) : (
                  students.map((s, idx) => {
                    const matrix = localMatrix[s.id] || {}
                    const initials = (s.first_name[0] + s.last_name[0]).toUpperCase()
                    return (
                      <tr key={s.id} className="transition-colors hover:bg-[#fafbff]">
                        <td className="sticky left-0 z-[5] bg-white px-3 py-2 border-b border-gray-100 text-gray-400 font-medium text-[12px]" style={{ width: 40, minWidth: 40 }}>
                          {idx + 1}
                        </td>
                        <td className="sticky left-[40px] z-[5] bg-white px-3 py-2 border-b border-gray-100" style={{ minWidth: 220 }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-[10px] bg-[#eef0ff] text-[#2001ff] flex items-center justify-center text-[10px] font-bold shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800 text-[13px]">{s.first_name} {s.last_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-400 text-[11px] font-medium max-lg:hidden">
                          +998 {s.phone}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-400 text-[11px] font-medium max-[480px]:hidden">
                          0 UZS
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100 text-gray-400 text-[11px] font-medium">
                          {(() => {
                            const notes = localNotes[s.id]
                            if (notes) {
                              const lastDate = lesson_dates.filter(d => notes[d]).pop()
                              if (lastDate && notes[lastDate]) {
                                return <span>{notes[lastDate]}</span>
                              }
                            }
                            return <span>&mdash;</span>
                          })()}
                        </td>
                        {lesson_dates.map((ld) => {
                          const status = matrix[ld] || "none"
                          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none
                          const key = `${s.id}-${ld}`
                          const isFlashing = flashKey === key
                          return (
                            <td key={ld} className="text-center px-0.5 py-1 border-b border-gray-100 relative" style={{ minWidth: 52 }}>
                              <div className="relative inline-flex">
                                {data?.can_edit ? (
                                  <button
                                    data-att-btn="true"
                                    onClick={(e) => openCellPopup(s.id, ld, e.currentTarget)}
                                    className={`w-7 h-7 rounded-full inline-flex items-center justify-center border-2 transition-all duration-150 hover:scale-110 hover:shadow-md active:scale-90 ${
                                      status === "present" ? "border-green-500 text-green-600 bg-white cursor-pointer" :
                                      status === "absent" ? "border-red-500 text-red-500 bg-white cursor-pointer" :
                                      status === "excused" ? "border-orange-500 text-orange-500 bg-white cursor-pointer" :
                                      "border-gray-200 text-gray-300 bg-white cursor-pointer"
                                    }`}
                                    style={isFlashing ? {
                                      boxShadow: status === "present" ? "0 0 0 3px rgba(34,197,94,0.3)" :
                                                status === "absent" ? "0 0 0 3px rgba(239,68,68,0.3)" :
                                                status === "excused" ? "0 0 0 3px rgba(245,158,11,0.3)" :
                                                "none",
                                      transition: "box-shadow 0.3s"
                                    } : {}}
                                  >
                                    {cfg.iconEl("w-3 h-3")}
                                  </button>
                                ) : (
                                  <span
                                    className={`w-7 h-7 rounded-full inline-flex items-center justify-center border-2 ${
                                      status === "present" ? "border-green-500 text-green-600 bg-white" :
                                      status === "absent" ? "border-red-500 text-red-500 bg-white" :
                                      status === "excused" ? "border-orange-500 text-orange-500 bg-white" :
                                      
                                      "border-gray-200 text-gray-300 bg-white"
                                    }`}
                                  >
                                    {cfg.iconEl("w-3 h-3")}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ===== POPUP MENU ===== */}
          {selectedCell && (() => {
            const rect = selectedCell.el.getBoundingClientRect()
            const popupWidth = 160
            let left = rect.left + rect.width / 2 - popupWidth / 2
            let top = rect.bottom + 6
            if (left < 8) left = 8
            if (left + popupWidth > window.innerWidth - 8) left = window.innerWidth - popupWidth - 8
            if (top + 200 > window.innerHeight - 8) top = Math.max(8, rect.top - 200)
            return (
              <div
                data-popup="true"
                className="fixed z-[1000] bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-gray-200 py-1 min-w-[140px] animate-[fadeIn_0.15s_ease]"
                style={{ top, left }}
              >
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                <button
                  onClick={() => setCellStatus(selectedCell.studentId, selectedCell.date, "present")}
                  className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium cursor-pointer rounded-lg border-none w-full text-left bg-transparent text-green-600 hover:bg-gray-50 transition-colors"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  Keldi
                </button>
                <button
                  onClick={() => setCellStatus(selectedCell.studentId, selectedCell.date, "absent")}
                  className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium cursor-pointer rounded-lg border-none w-full text-left bg-transparent text-red-500 hover:bg-gray-50 transition-colors"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Kelmadi
                </button>
                <button
                  onClick={() => setCellStatus(selectedCell.studentId, selectedCell.date, "excused")}
                  className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium cursor-pointer rounded-lg border-none w-full text-left bg-transparent text-orange-500 hover:bg-gray-50 transition-colors"
                >
                  <AlertCircleIcon className="w-4 h-4" />
                  Sababli
                </button>
              </div>
            )
          })()}

          {/* ===== SAVE BAR ===== */}
          {students.length > 0 && (
            <div className="px-5 py-3.5 border-t border-gray-100 flex justify-end gap-2.5 bg-white">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-[10px] text-[13px] font-semibold cursor-pointer border-none bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
                Bekor qilish
              </button>
              <button
                onClick={saveAllRecords}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-[10px] text-[13px] font-semibold cursor-pointer border-none bg-[#2001ff] text-white shadow-[0_2px_8px_rgba(32,1,255,0.25)] hover:bg-[#1a00e0] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 transition-all"
              >
                {saving ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" />
                    Saqlash
                  </>
                )}
              </button>
            </div>
          )}
        </div>

          {/* ===== TARIX & IZOHLAR (Desktop) ===== */}
          {data.is_admin && (
          <div className="hidden md:block mt-5">
            <div className="bg-white rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-[14px] font-bold text-[#0f172a]">Tarix & Izohlar</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {(() => {
                    const historyEntries: { date: string; studentName: string; studentId: number; status: string; notes: string; teacher: string }[] = []
                    for (const [sid, entries] of Object.entries(data.student_att_history || {})) {
                      const s = students.find(st => st.id === Number(sid))
                      const studentName = s ? `${s.first_name} ${s.last_name}` : `#${sid}`
                      for (const e of entries) {
                        historyEntries.push({ ...e, studentName, studentId: Number(sid) })
                      }
                    }
                  historyEntries.sort((a, b) => b.date.localeCompare(a.date))
                  if (historyEntries.length === 0) {
                    return <div className="text-center py-8 text-gray-400 text-[13px]">Izohlar mavjud emas</div>
                  }
                  return (
                    <div className="divide-y divide-gray-50">
                    {historyEntries.map((h, i) => (
                         <div key={i} className="px-5 py-2.5 flex items-start gap-3 text-[13px]">
                           <div className="flex-shrink-0 w-[70px] text-[11px] font-semibold text-gray-400 pt-0.5">{h.date.slice(5)}</div>
                           <a href={`/students/${h.studentId}/profile/`} className="flex-shrink-0 text-[12px] font-semibold text-gray-700 min-w-[120px] hover:text-[#2001ff] underline underline-offset-2 decoration-gray-300">{h.studentName}</a>
                          <span className={`flex-shrink-0 inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${h.status === "Kelmadi" ? "bg-red-50 text-red-600" : h.status === "Sababli" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>
                            {h.status}
                          </span>
                          <span className="text-gray-500 flex-1">{h.notes && h.notes !== "None" ? h.notes : <span className="text-gray-300">&mdash;</span>}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
          )}

          </div>
        </div>
      </div>
  )
}
