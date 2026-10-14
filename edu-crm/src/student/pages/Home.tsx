import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  Megaphone, ChevronRight, Star, HelpCircle, Shirt, Smartphone,
  BookOpen, GraduationCap, Clock, MapPin, Smile, Home as HomeIcon,
  Dumbbell, Sparkles, LayoutGrid, ExternalLink,
} from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { NewsItem, ScheduleDay, ScheduleLesson, TodayClass } from "../types"

const PRIMARY = "#1464F4"

const WEEK_DAYS = [
  { key: "dushanba", label: "Dush" },
  { key: "seshanba", label: "Sesh" },
  { key: "chorshanba", label: "Chor" },
  { key: "payshanba", label: "Pay" },
  { key: "juma", label: "Jum" },
  { key: "shanba", label: "Shan" },
]

type WeekDay = (typeof WEEK_DAYS)[number] & {
  date: Date
  day: number
  iso: string
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getWeekDays(now: Date): WeekDay[] {
  const dow = now.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  return WEEK_DAYS.map((d, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + i)
    return { ...d, date, day: date.getDate(), iso: fmtDate(date) }
  })
}

const SERVICES = [
  { id: "support", title: "Support darslari", color: PRIMARY, Icon: GraduationCap, desc: "Qo'shimcha darslar", action: "Yozilish" },
  { id: "library", title: "Onlayn kutubxona", color: "#7C3AED", Icon: BookOpen, desc: "E-kitoblar", action: "Ko'rish" },
  { id: "sport", title: "Sport seksiyalari", color: "#059669", Icon: Dumbbell, desc: "Futbol, basketbol", action: "Yozilish" },
  { id: "individual", title: "Individual darslar", color: "#EA580C", Icon: Sparkles, desc: "Shaxsiy o'qituvchi", action: "Yozilish" },
]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  upcoming: { label: "Kutilmoqda", bg: "bg-[#1464F4]/10", text: "text-[#1464F4]" },
  ongoing: { label: "Davom etmoqda", bg: "bg-green-50", text: "text-green-600" },
  finished: { label: "Tugagan", bg: "bg-gray-50", text: "text-gray-500" },
}

export default function Home() {
  const navigate = useNavigate()
  const { avatar, tr } = useAppSettings()
  const [studentName, setStudentName] = useState("")
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null)
  const [balanceLabel, setBalanceLabel] = useState("TO'LANGAN")
  const [classes, setClasses] = useState<TodayClass[]>([])
  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({})
  const [lessonDates, setLessonDates] = useState<string[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<"home" | "services">("home")
  const [news, setNews] = useState<NewsItem[]>([])
  const servicesRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const todayIso = fmtDate(now)
  const weekDays = getWeekDays(now)
  const todayIndex = weekDays.findIndex((d) => d.iso === todayIso)
  const [selectedIndex, setSelectedIndex] = useState(todayIndex >= 0 ? todayIndex : 0)

  useEffect(() => {
    api.profile().then((res) => {
      setStudentName(res.student.first_name || "")
      setStudentPhoto(res.student.photo || null)
      if (res.student.debt) setBalanceLabel("QARZDOR")
    }).catch(() => {})
    api.todayClasses().then((res) => setClasses(res.classes)).catch(() => {})
    api.schedule().then((res) => setSchedule(res.schedule)).catch(() => {})
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    api.monthlyCalendar(y, m).then((res) => {
      setLessonDates(res.lesson_dates || [])
      setAttendanceMap(res.attendance_map || {})
    }).catch(() => {})
    api.getNews().then((res) => setNews(res.news || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = weekDays[selectedIndex]
  const isToday = selected.iso === todayIso
  const daySchedule: ScheduleLesson[] = schedule[selected.key]?.lessons || []
  const selectedHasLesson = isToday
    ? classes.length > 0
    : lessonDates.includes(selected.iso) && daySchedule.length > 0
  const selectedClasses: ScheduleLesson[] = isToday ? classes : daySchedule

  const goServices = () => {
    setActiveTab("services")
    servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const goTop = () => {
    setActiveTab("home")
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={topRef} className="min-h-screen bg-[#F8F9FC] pb-28 animate-page-enter">
      <div className="max-w-lg mx-auto px-4 pt-7">
        {/* ===== HEADER ===== */}
        <header className="flex items-center justify-between mb-5">
          <div className="cursor-pointer" onClick={() => navigate("/profile/balance")}>
            <h1 className="text-lg font-extrabold text-gray-900 leading-snug">
              Salom, {studentName || tr("O'quvchi")}
            </h1>
            <div className="flex items-center gap-1 mt-0.5 group">
              <span className="text-[11px] font-semibold text-gray-400">Balans:</span>
              <span className="text-[11px] font-bold text-green-600">{balanceLabel}</span>
              <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-400" />
            </div>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="w-11 h-11 rounded-full bg-[#1464F4] flex items-center justify-center shadow-lg shadow-[#1464F4]/30 btn-hover overflow-hidden"
          >
            {studentPhoto || avatar ? (
              <img src={studentPhoto || avatar || ""} alt="" className="w-full h-full object-cover" />
            ) : (
              <Smile size={22} className="text-white" fill="white" />
            )}
          </button>
        </header>

        {/* ===== YANGILIKLAR ===== */}
        <section className="mb-5 animate-scale-in">
          <div className="card-premium p-3.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1464F4] flex items-center justify-center shadow-sm shadow-[#1464F4]/25">
                <Megaphone size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{tr("Barcha Yangiliklar")}</p>
                <p className="text-[10px] font-medium text-gray-400">{news.length} ta yangi</p>
              </div>
            </div>
            {news.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto drawer-scroll -mx-1 px-1 pb-1">
                {news.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => (n.link ? window.open(n.link, "_blank", "noopener,noreferrer") : navigate(`/news/${n.id}`))}
                    className="shrink-0 w-40 rounded-2xl bg-[#F5F7FB] p-3 text-left btn-hover"
                  >
                    <span className="text-[9px] font-bold text-[#1464F4] uppercase tracking-wide">
                      {n.category_display}
                    </span>
                    <p className="text-[11px] font-semibold text-gray-700 mt-1 leading-snug">{n.title}</p>
                    {n.link && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-[#1464F4]">
                        <ExternalLink size={9} strokeWidth={2.5} />
                        {n.link_text || "Batafsil"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-medium text-gray-400 text-center py-3">
                Hali yangilik yo'q
              </p>
            )}
          </div>
        </section>

        {/* ===== DARS JADVALI ===== */}
        <section className="mb-5 animate-scale-in stagger-1">
          <h2 className="text-sm font-bold text-gray-900 mb-2 px-1">{tr("Dars jadvali")}</h2>
          <div className="flex gap-2 overflow-x-auto drawer-scroll -mx-1 px-1 pb-1">
            {weekDays.map((w, idx) => {
              const active = idx === selectedIndex
              const hasLesson = lessonDates.includes(w.iso) && (schedule[w.key]?.lessons?.length || 0) > 0
              const wAtt = attendanceMap[w.iso]
              return (
                <button
                  key={w.iso}
                  onClick={() => setSelectedIndex(idx)}
                  className={`shrink-0 w-14 rounded-2xl py-2.5 flex flex-col items-center gap-1 transition-all duration-200 btn-hover ${
                    active
                      ? "bg-white border-2 border-[#1464F4] shadow-md shadow-[#1464F4]/10"
                      : "bg-white border-2 border-transparent shadow-sm"
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${active ? "text-[#1464F4]" : "text-gray-400"}`}>{w.label}</span>
                  <span className={`text-base font-extrabold ${active ? "text-[#1464F4]" : "text-gray-800"}`}>{w.day}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    hasLesson
                      ? wAtt === "present" ? "bg-green-500"
                        : wAtt === "absent" ? "bg-red-500"
                          : active ? "bg-[#1464F4]" : "bg-gray-300"
                      : "bg-transparent"
                  }`} />
                </button>
              )
            })}
          </div>

          <div className="mt-3">
            {selectedHasLesson ? (
              <div className="space-y-2.5 animate-scale-in">
                {selectedClasses.map((cls, idx) => {
                  const status = isToday ? (classes[idx]?.status) : undefined
                  const sc = status ? statusConfig[status] : null
                  return (
                    <div key={`${cls.group_id}-${cls.start_time || idx}`} className="card-premium p-3.5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-[#1464F4]/10 rounded-xl flex items-center justify-center">
                            <GraduationCap size={18} className="text-[#1464F4]" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{cls.subject}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-0.5">{cls.group_name}</p>
                          </div>
                        </div>
                        {sc && (
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ${sc.bg} ${sc.text}`}>
                            {tr(sc.label)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Clock size={12} className="text-[#1464F4]" />
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{tr("Vaqt")}</p>
                            <p className="text-xs font-bold text-gray-900">{cls.start_time} - {cls.end_time}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <MapPin size={12} className="text-[#1464F4]" />
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{tr("Xona")}</p>
                            <p className="text-xs font-bold text-gray-900">{cls.room || tr("Aniqlanmagan")}-xona</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="card-premium p-6 animate-scale-in">
                <div className="mx-auto w-14 h-14 bg-[#F5F7FB] rounded-2xl flex items-center justify-center mb-2.5">
                  <CalendarIcon />
                </div>
                <p className="text-[13px] font-semibold text-gray-400 text-center">{tr("Bugun darslar yo'q")}</p>
              </div>
            )}
          </div>
        </section>

        {/* ===== XIZMATLAR ===== */}
        <section ref={servicesRef} className="mb-5 scroll-mt-4 animate-scale-in stagger-2">
          <h2 className="text-sm font-bold text-gray-900 mb-2 px-1">{tr("Xizmatlar")}</h2>
          <div className="flex gap-3 overflow-x-auto drawer-scroll -mx-1 px-1 pb-2">
            {SERVICES.map((s) => (
              <div key={s.id} className="shrink-0 w-44 card-premium p-4 flex flex-col">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${s.color}15` }}>
                  <s.Icon size={22} style={{ color: s.color }} />
                </div>
                <p className="text-[13px] font-bold text-gray-900 leading-tight">{s.title}</p>
                <p className="text-[10px] font-medium text-gray-400 mt-0.5 mb-3">{s.desc}</p>
                <button className="mt-auto w-full py-2 rounded-xl bg-[#1464F4] text-white text-[11px] font-bold btn-hover shadow-sm shadow-[#1464F4]/20">
                  {s.action}
                </button>
              </div>
            ))}
            <button className="shrink-0 w-44 card-premium p-4 flex flex-col items-center justify-center btn-hover border-2 border-dashed border-gray-200">
              <LayoutGrid size={22} className="text-[#1464F4] mb-2" />
              <p className="text-[11px] font-bold text-gray-500">{tr("Barchasi")}</p>
            </button>
          </div>
        </section>

        {/* ===== KO'NGIL OCHAR ===== */}
        <section className="mb-5 animate-scale-in stagger-3">
          <h2 className="text-sm font-bold text-gray-900 mb-2 px-1">{tr("Ko'ngil ochar")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/coins")}
              className="rounded-3xl p-4 flex flex-col items-start h-44 text-white btn-hover text-left relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)", boxShadow: "0 12px 30px rgba(124,58,237,0.25)" }}
            >
              <div className="flex items-center gap-1 mb-auto">
                <Star size={16} className="text-yellow-300" fill="currentColor" />
                <HelpCircle size={13} className="text-white/70" />
              </div>
              <p className="text-[42px] font-extrabold leading-none">7</p>
              <p className="text-sm font-bold mt-1">{tr("Koinlar")}</p>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10" />
              <div className="absolute -right-1 -bottom-1 w-12 h-12 rounded-full bg-white/10" />
            </button>

            <button
              onClick={() => navigate("/shop")}
              className="card-premium p-4 flex flex-col items-start h-44 btn-hover text-left relative overflow-hidden"
            >
              <div className="flex -space-x-1.5 mb-auto">
                <div className="w-9 h-9 rounded-2xl bg-[#1464F4]/10 flex items-center justify-center">
                  <Shirt size={18} className="text-[#1464F4]" />
                </div>
                <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center">
                  <Smartphone size={17} className="text-[#7C3AED]" />
                </div>
              </div>
              <p className="text-sm font-bold text-gray-900 mt-2">{tr("Do'kon")}</p>
              <p className="text-[10px] font-medium text-gray-400 mb-2">{tr("Sovg'alar")}</p>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1464F4] text-white text-[10px] font-bold btn-hover">
                {tr("Ko'rish")} <ChevronRight size={12} />
              </span>
            </button>
          </div>
        </section>

        <div className="h-4" />
      </div>

      {/* ===== BOTTOM NAVIGATION (2 bo'lim) ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100/80 safe-bottom shadow-[0_-4px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around max-w-lg mx-auto px-4 py-2">
          <button
            onClick={goTop}
            className={`flex flex-col items-center gap-1 py-1 px-6 rounded-2xl transition-all duration-200 ${
              activeTab === "home" ? "text-[#1464F4]" : "text-[#9CA3AF]"
            }`}
          >
            <HomeIcon size={21} strokeWidth={activeTab === "home" ? 2.5 : 1.8} />
            <span className="text-[9px] font-semibold leading-none">Bosh sahifa</span>
            {activeTab === "home" && <span className="h-1 w-1 rounded-full bg-[#1464F4]" />}
          </button>
          <button
            onClick={goServices}
            className={`flex flex-col items-center gap-1 py-1 px-6 rounded-2xl transition-all duration-200 ${
              activeTab === "services" ? "text-[#1464F4]" : "text-[#9CA3AF]"
            }`}
          >
            <LayoutGrid size={21} strokeWidth={activeTab === "services" ? 2.5 : 1.8} />
            <span className="text-[9px] font-semibold leading-none">Xizmatlar</span>
            {activeTab === "services" && <span className="h-1 w-1 rounded-full bg-[#1464F4]" />}
          </button>
        </div>
      </nav>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1464F4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}