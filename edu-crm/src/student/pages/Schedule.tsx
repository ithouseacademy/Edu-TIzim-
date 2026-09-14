import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, Clock, MapPin, BookOpen, ChevronRight } from "lucide-react"
import { api } from "../api"
import type { ScheduleDay } from "../types"

const dayKeys = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"]
const dayLabels: Record<string, string> = {
  dushanba: "Du", seshanba: "Se", chorshanba: "Ch",
  payshanba: "Pa", juma: "Ju", shanba: "Sh",
}

const colors = [
  { bg: "from-blue-400 to-blue-500", light: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  { bg: "from-indigo-400 to-indigo-500", light: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
  { bg: "from-cyan-400 to-cyan-500", light: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200" },
  { bg: "from-violet-400 to-violet-500", light: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  { bg: "from-emerald-400 to-emerald-500", light: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  { bg: "from-rose-400 to-rose-500", light: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
]

export default function Schedule() {
  const navigate = useNavigate()
  const today = new Date()
  const weekdayMap = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"]
  const [activeDay, setActiveDay] = useState(weekdayMap[today.getDay()])
  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({})

  useEffect(() => {
    api.schedule().then((res) => {
      setSchedule(res.schedule)
    }).catch(() => {})
  }, [])

  if (activeDay === "yakshanba") setActiveDay("dushanba")

  const lessons = schedule[activeDay]?.lessons || []
  const fullLabels: Record<string, string> = {
    dushanba: "Dushanba", seshanba: "Seshanba", chorshanba: "Chorshanba",
    payshanba: "Payshanba", juma: "Juma", shanba: "Shanba",
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-20 page-enter">
      <div className="max-w-lg mx-auto px-2.5 pt-8">
        <div className="flex items-center gap-2.5 mb-3 animate-fade-in">
          <div className="p-2 bg-[#2001FF]/10 rounded-lg">
            <CalendarDays size={18} className="text-[#2001FF]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 tracking-tight">Schedule</h1>
            <p className="text-[10px] text-gray-400 font-medium">Haftalik darslar tartibi</p>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-hide animate-fade-in">
          {dayKeys.map((key) => {
            const isActive = activeDay === key
            const isToday = weekdayMap[today.getDay()] === key
            return (
              <button
                key={key}
                onClick={() => setActiveDay(key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/20"
                    : isToday
                    ? "bg-[#2001FF]/10 text-[#2001FF] border border-[#2001FF]/20"
                    : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 card-shadow"
                }`}
              >
                {dayLabels[key]}
                {isToday && <span className="ml-1 inline-block w-1 h-1 bg-current rounded-full" />}
              </button>
            )
          })}
        </div>

        {/* Day title */}
        <div className="flex items-center justify-between mb-2 animate-fade-in">
          <p className="text-xs font-bold text-gray-900">{fullLabels[activeDay]}</p>
          <span className="text-[9px] font-semibold text-gray-400 bg-white px-2 py-0.5 rounded-lg card-shadow">
            {lessons.length} ta dars
          </span>
        </div>

        {/* Lessons */}
        <div className="space-y-2 animate-slide-up">
          {lessons.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center card-shadow">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <CalendarDays size={22} className="text-gray-300" />
              </div>
              <p className="text-xs font-medium text-gray-400">Bu kunga darslar mavjud emas</p>
            </div>
          )}

          {lessons.map((lesson, idx) => {
            const color = colors[idx % colors.length]
            return (
              <div
                key={`${lesson.group_id}-${lesson.start_time}-${idx}`}
                onClick={() => navigate(`/lesson/${lesson.group_id}`)}
                className="bg-white rounded-2xl p-3 card-shadow card-shadow-hover transition-all cursor-pointer btn-scale"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-1 self-stretch rounded-full shrink-0 bg-gradient-to-b ${color.bg}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-xs text-gray-900">{lesson.subject}</h3>
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Clock size={9} />
                        {lesson.start_time} - {lesson.end_time}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                      {lesson.teacher && (
                        <span className={`px-1.5 py-0.5 rounded-lg ${color.light} ${color.text} font-medium`}>
                          👨‍🏫 {lesson.teacher}
                        </span>
                      )}
                      {lesson.room && (
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin size={9} />
                          {lesson.room}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-medium">
                        <BookOpen size={9} />
                        {lesson.group_name}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 mt-0.5 shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
