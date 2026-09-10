import { useNavigate } from "react-router-dom"
import {
  ChevronLeft, Wallet, Phone, User as UserIcon, GraduationCap, CalendarDays,
  ArrowUpCircle, MessageSquare, History, ChevronRight, Loader2, AlertTriangle,
} from "lucide-react"
import { loadEmployee } from "../api"
import WaveHeader from "../components/WaveHeader"
import { useStudentDetail } from "./student/useStudentDetail"

const statusColors: Record<string, string> = {
  kutilyotgan: "bg-amber-50 text-amber-600",
  bitirilgan: "bg-blue-50 text-blue-600",
  chiqarilgan: "bg-red-50 text-red-600",
}

const sections = [
  { id: "info", label: "Shaxsiy ma'lumotlar", icon: UserIcon, desc: "Ism, familiya, telefon, ota-ona" },
  { id: "groups", label: "Guruhlar", icon: GraduationCap, desc: "Aktiv va o'qigan guruhlar, chiqarish" },
  { id: "debt", label: "Qarz / to'lov holati", icon: Wallet, desc: "Qarzlar, qolgan darslar" },
  { id: "attendance", label: "Davomat", icon: CalendarDays, desc: "Darsga kelishi tarixi" },
  { id: "payments", label: "To'lov tarixi", icon: ArrowUpCircle, desc: "Barcha tranzaksiyalar" },
  { id: "sms", label: "SMS tarixi", icon: MessageSquare, desc: "Yuborilgan xabarlar" },
  { id: "logs", label: "Harakatlar tarixi", icon: History, desc: "Guruh qo'shish, chiqarish va b." },
]

export default function StudentDetail() {
  const navigate = useNavigate()
  const { data, loading, error } = useStudentDetail()

  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="O'quvchi profili"
        leftSlot={
          <button
            onClick={() => navigate("/students")}
            className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover"
          >
            <ChevronLeft size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />
      <div className="max-w-lg mx-auto px-3">
        {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium mb-3">{error}</div>}

        {loading ? (
          <div className="card-premium p-8 flex items-center justify-center">
            <Loader2 size={24} className="text-[#2001FF]/40 animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className="card-premium p-4 mb-3 animate-scale-in">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2001FF] flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-white">
                    {(data.student.first_name[0] || "") + (data.student.last_name[0] || "")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {data.student.first_name} {data.student.last_name}
                  </h2>
                  <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                    <Phone size={11} /> {data.student.phone.startsWith("+998") ? data.student.phone : `+998 ${data.student.phone}`}
                  </p>
                  <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded mt-1 ${statusColors[data.student.status] || "bg-gray-100 text-gray-500"}`}>
                    {data.student.status_display}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-[#2001FF]/5 rounded-xl">
                <Wallet size={14} className="text-[#2001FF]" />
                <div className="flex-1">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Balans</p>
                  <p className={`text-sm font-bold ${data.student.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                    {data.student.balance_str}
                  </p>
                </div>
              </div>
            </div>

            {/* Bo'limlar menyusi */}
            <div className="card-premium divide-y divide-gray-50 overflow-hidden">
              {sections.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/students/${data.student.id}/${s.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left btn-hover"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#2001FF]/10 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#2001FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900">{s.label}</p>
                      <p className="text-[10px] font-medium text-gray-400 truncate">{s.desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="card-premium p-8 text-center">
            <AlertTriangle size={22} className="mx-auto text-gray-300 mb-1.5" />
            <p className="text-xs font-medium text-gray-400">Ma'lumot topilmadi</p>
          </div>
        )}
      </div>
    </div>
  )
}
