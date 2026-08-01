import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell, BookOpen, Clock, MapPin, ChevronLeft, ChevronRight,
  Menu, Home as HomeIcon,
} from "lucide-react"
import { api } from "../api"
import { useDrawer } from "../context/DrawerContext"
import type { ScheduleDay } from "../types"

const DAYS_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
]

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const days: (number | null)[] = []

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    days.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null)
  }
  return days
}

const weekdayMap = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  upcoming: { label: "Kutilmoqda", bg: "bg-[#2001FF]/10", text: "text-[#2001FF]" },
  ongoing: { label: "Davom etmoqda", bg: "bg-green-50", text: "text-green-600" },
  finished: { label: "Tugagan", bg: "bg-gray-50", text: "text-gray-500" },
}

export default function Home() {
  const navigate = useNavigate()
  const { open: openDrawer } = useDrawer()
  const [classes, setClasses] = useState<any[]>([])
  const [studentName, setStudentName] = useState("")
  const [groupName, setGroupName] = useState("")
  const [groupStart, setGroupStart] = useState("")
  const [stats, setStats] = useState<any>(null)
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [lessonDates, setLessonDates] = useState<string[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({})
  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({})

  useEffect(() => {
    api.profile().then((res) => {
      setStudentName(res.student.first_name || "O'quvchi")
      if (res.groups.length > 0) {
        setGroupName(res.groups[0].name || "")
        setGroupStart(res.groups[0].start_date || "")
      }
    }).catch(() => {})
    api.todayClasses().then((res) => {
      setClasses(res.classes)
    }).catch(() => {})
    api.attendanceHistory().then(setStats).catch(() => {})
    api.schedule().then((res) => {
      setSchedule(res.schedule)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.monthlyCalendar(calYear, calMonth + 1).then((res) => {
      setLessonDates(res.lesson_dates || [])
      setAttendanceMap(res.attendance_map || {})
    }).catch(() => {})
  }, [calYear, calMonth])

  const now = new Date()
  const today = now.getDate()
  const hour = now.getHours()
  const greeting = hour < 12 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech"

  const todayClasses = classes || []

  const initials = studentName ? studentName.charAt(0).toUpperCase() : "O"

  const calendarDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth])

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear((y) => y - 1)
    } else {
      setCalMonth((m) => m - 1)
    }
    setSelectedDay(0)
  }

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear((y) => y + 1)
    } else {
      setCalMonth((m) => m + 1)
    }
    setSelectedDay(0)
  }

  const isLessonDay = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return lessonDates.includes(dateStr)
  }

  const getAttendanceForDay = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return attendanceMap[dateStr] || null
  }

  const isCurrentMonth = calMonth === now.getMonth() && calYear === now.getFullYear()

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-24 animate-page-enter">
      <div className="max-w-lg mx-auto px-4 pt-12">
        <header className="flex items-center justify-between mb-5">
          <button
            onClick={openDrawer}
            className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm btn-hover"
          >
            <Menu size={20} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2001FF] rounded-xl flex items-center justify-center">
              <HomeIcon size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Bosh sahifa</h1>
          </div>
          <button className="relative w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm btn-hover">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#2001FF] rounded-full flex items-center justify-center animate-badge-pulse">
              <span className="text-[8px] font-bold text-white">3</span>
            </span>
          </button>
        </header>

        <section className="mb-3 animate-scale-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#2001FF] rounded-2xl flex items-center justify-center shadow-lg shadow-[#2001FF]/20">
                <span className="text-lg font-bold text-white">{initials}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">{greeting}</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{studentName || "O'quvchi"}</p>
                {groupName && (
                  <p className="text-xs font-medium text-gray-400 mt-0.5">{groupName}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{stats?.percentage || 0}%</p>
              <p className="text-xs font-medium text-gray-400">Davomat</p>
            </div>
          </div>
        </section>

        <section className="mb-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={prevMonth} className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <h2 className="text-base font-bold text-gray-900">
              {MONTHS_UZ[calMonth]} {calYear}
            </h2>
            <button onClick={nextMonth} className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="card-calendar p-3">
            <div className="grid grid-cols-7 mb-1">
              {DAYS_UZ.map((d) => (
                <div key={d} className="text-center py-1.5">
                  <span className="text-[11px] font-semibold text-gray-400">{d}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />
                const isToday = isCurrentMonth && day === today
                const isSelected = day === selectedDay
                    const selDate = new Date(calYear, calMonth, day)
                    const dayKey = weekdayMap[selDate.getDay()]
                    const hasLesson = isLessonDay(day) && (schedule[dayKey]?.lessons?.length || 0) > 0
                    const att = getAttendanceForDay(day)

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className="relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all btn-hover"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                            isSelected
                              ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/20"
                              : isToday
                                ? "text-[#2001FF]"
                                : "text-gray-700"
                          }`}
                        >
                          {day}
                        </div>
                        <div className="flex items-center gap-0.5 mt-0.5 h-2">
                          {hasLesson && (
                            <div className={`w-2 h-2 rounded-full ${
                              att === "present" ? "bg-green-500" :
                              att === "absent" ? "bg-red-500" :
                              att === "excused" ? "bg-yellow-500" :
                              "bg-gray-300"
                            }`} />
                          )}
                        </div>
                      </button>
                )
              })}
            </div>
          </div>

          {selectedDay > 0 && (() => {
            const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
            const att = attendanceMap[ds]
            const isTodaySel = isCurrentMonth && selectedDay === today
            const selDate = new Date(calYear, calMonth, selectedDay)
            const dayKey = weekdayMap[selDate.getDay()]
            const scheduleLessons = schedule[dayKey]?.lessons || []
            const hasLesson = lessonDates.includes(ds) && scheduleLessons.length > 0
            const afterStart = !groupStart || ds >= groupStart

            if (hasLesson && afterStart) {
              const dayClasses = isTodaySel ? todayClasses : scheduleLessons
              return (
                <div className="mt-3 space-y-3 animate-scale-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">
                      {selectedDay} {MONTHS_UZ[calMonth]} - Darslar
                    </h3>
                    {att && (
                      <span className={`text-[11px] font-bold px-3 py-1.5 rounded-xl ${
                        att === "present" ? "bg-green-50 text-green-700" :
                        att === "absent" ? "bg-red-50 text-red-600" :
                        "bg-yellow-50 text-yellow-700"
                      }`}>
                        {att === "present" ? "Darsga qatnashgan" :
                         att === "absent" ? "Kelmagan" : "Sababli Kelmagan"}
                      </span>
                    )}
                  </div>
                  {dayClasses.map((cls: any, idx: number) => (
                    <div key={cls.id || cls.group_id || idx} className="card-premium p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#2001FF]/10 rounded-2xl flex items-center justify-center">
                            <BookOpen size={22} className="text-[#2001FF]" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-gray-900">{cls.subject}</p>
                            <p className="text-xs font-medium text-gray-400 mt-0.5">{cls.group_name}</p>
                          </div>
                        </div>
                        {cls.status && (
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
                            (statusConfig[cls.status]?.bg || "bg-gray-50") + " " + (statusConfig[cls.status]?.text || "text-gray-500")
                          }`}>
                            {statusConfig[cls.status]?.label || cls.status}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-3.5 py-3">
                          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Clock size={15} className="text-[#2001FF]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vaqt</p>
                            <p className="text-sm font-bold text-gray-900">{cls.start_time} - {cls.end_time}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-3.5 py-3">
                          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <MapPin size={15} className="text-[#2001FF]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Xona</p>
                            <p className="text-sm font-bold text-gray-900">{cls.room || "Aniqlanmagan"}-xona</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-500">
                              {cls.teacher ? cls.teacher.charAt(0).toUpperCase() : "O'"}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-400">O'qituvchi</p>
                            <p className="text-sm font-bold text-gray-900">{cls.teacher || "O'qituvchi"}</p>
                          </div>
                        </div>
                        {cls.attendance_status && (
                          <div className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                            cls.attendance_status === "present" ? "bg-green-50 text-green-700" :
                            cls.attendance_status === "absent" ? "bg-red-50 text-red-600" :
                            "bg-yellow-50 text-yellow-700"
                          }`}>
                            {cls.attendance_status === "present" ? "Bor" :
                             cls.attendance_status === "absent" ? "Yo'q" : "Kechikkan"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }

            return (
              <div className="mt-3 card-premium p-5 animate-scale-in">
                <p className="text-sm font-semibold text-gray-400 text-center">
                  {selectedDay} {MONTHS_UZ[calMonth]} - Bu kunda dars yo'q edi
                </p>
              </div>
            )
          })()}
        </section>

        {todayClasses.length > 1 && (
          <section className="mb-4 animate-scale-in stagger-2">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Barcha darslar</h2>
            <div className="space-y-2.5">
              {todayClasses.slice(1).map((cls: any, idx: number) => {
                const sc = statusConfig[cls.status]
                return (
                  <div
                    key={cls.id || idx}
                    onClick={() => navigate(`/lesson/${cls.group_id}`)}
                    className="card-premium-sm p-4 flex items-center justify-between btn-hover cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <BookOpen size={18} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{cls.subject}</p>
                        <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                          {cls.start_time} - {cls.end_time} | {cls.room}-xona
                        </p>
                      </div>
                    </div>
                    {sc && (
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0 ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="mb-4 animate-scale-in stagger-3">
          <button
            onClick={() => navigate("/homework")}
            className="card-premium p-4 w-full flex items-center justify-between btn-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#2001FF]/10 rounded-2xl flex items-center justify-center">
                <BookOpen size={22} className="text-[#2001FF]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">Uy vazifalari</p>
                <p className="text-xs font-medium text-gray-400 mt-0.5">3 ta topshiriq</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                <div className="w-6 h-6 bg-yellow-400 rounded-full border-2 border-white" />
                <div className="w-6 h-6 bg-green-400 rounded-full border-2 border-white" />
                <div className="w-6 h-6 bg-red-400 rounded-full border-2 border-white" />
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </button>
        </section>

      </div>

      <button className="fixed bottom-24 right-5 w-14 h-14 bg-[#2001FF] rounded-full flex items-center justify-center shadow-xl shadow-[#2001FF]/30 animate-float btn-hover z-40">
        <span className="text-2xl font-bold text-white leading-none">+</span>
      </button>
    </div>
  )
}
