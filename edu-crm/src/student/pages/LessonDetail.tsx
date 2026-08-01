import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft, User, MapPin, Clock, BookOpen,
  FileText, CalendarDays, GraduationCap,
} from "lucide-react"
import { api } from "../api"
import type { GroupInfo } from "../types"

export default function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.profile().then((res) => {
      const g = res.groups.find((grp) => grp.id === Number(id))
      setGroup(g || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] p-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center mt-20">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <BookOpen size={32} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">Ma'lumot topilmadi</p>
        </div>
      </div>
    )
  }

  const details = [
    { icon: User, label: "O'qituvchi", value: group.teacher },
    { icon: BookOpen, label: "Fan", value: group.course },
    { icon: MapPin, label: "Xona", value: group.room },
    { icon: CalendarDays, label: "Boshlanish", value: group.start_date },
    { icon: CalendarDays, label: "Tugash", value: group.end_date },
  ]

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24 page-enter">
      <div className="max-w-lg mx-auto px-4 pt-14">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-all font-medium"
        >
          <ArrowLeft size={18} />
          Orqaga
        </button>

        <div className="bg-white rounded-[22px] overflow-hidden card-shadow animate-scale-in">
          <div className="gradient-header p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full -ml-12 -mb-12" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap size={16} className="text-white/70" />
                <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">Guruh</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">{group.name}</h1>
              <p className="text-white/70 text-sm font-medium mt-1">{group.course}</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {details.map((d, idx) => d.value && (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-gray-50 rounded-lg">
                    <d.icon size={14} className="text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">{d.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{d.value}</span>
              </div>
            ))}

            <div className="h-px bg-gray-100" />

            {group.lesson_times?.map((lt, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <Clock size={14} className="text-blue-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Dars vaqti</span>
                </div>
                <span className="text-sm font-bold text-[#2001FF]">
                  {lt.days} | {lt.start_time} - {lt.end_time}
                </span>
              </div>
            ))}

            <div className="pt-2 flex gap-2">
              <button className="flex-1 py-3.5 bg-gradient-to-r from-[#2001FF] to-[#4361FF] text-white rounded-[16px] font-semibold text-sm shadow-lg shadow-[#2001FF]/20 hover:shadow-xl hover:shadow-[#2001FF]/30 transition-all duration-300 btn-scale">
                Uy vazifasi
              </button>
              <button className="flex-1 py-3.5 bg-gray-50 text-gray-700 rounded-[16px] font-semibold text-sm hover:bg-gray-100 transition-all btn-scale">
                Dars yozuvlari
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-[22px] p-5 card-shadow animate-fade-in">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-[#2001FF]" />
            Uy vazifasi
          </h2>
          <div className="bg-gray-50 rounded-[16px] p-5 text-center">
            <p className="text-sm font-medium text-gray-400">Hozircha topshiriqlar mavjud emas</p>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-[22px] p-5 card-shadow mb-6 animate-fade-in">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-[#2001FF]" />
            O'qituvchi eslatmalari
          </h2>
          <div className="bg-amber-50 border border-amber-100 rounded-[16px] p-4">
            <p className="text-sm font-medium text-amber-700">
              Keyingi darsga darslikning 5-bobini o'qib keling
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
