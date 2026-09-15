import { useState } from "react"
import { BookOpen, Clock, AlertCircle, CheckCircle, Hourglass, FileText, type LucideIcon } from "lucide-react"
import { useAppSettings } from "../AppSettings"

const mockHomework = [
  {
    id: 1, subject: "Matematika", teacher: "Mr. Khan",
    deadline: "2026-06-30", status: "pending",
    description: "Algebra masalalari: 1-20 gacha",
  },
  {
    id: 2, subject: "Ingliz tili", teacher: "Javlon",
    deadline: "2026-06-28", status: "submitted",
    description: "Essay: My favorite book",
  },
  {
    id: 3, subject: "Fizika", teacher: "Azizjon",
    deadline: "2026-06-25", status: "late",
    description: "Laboratoriya ishi №5",
  },
  {
    id: 4, subject: "Kimyo", teacher: "Zarina",
    deadline: "2026-07-02", status: "pending",
    description: "Elementlar davriy jadvali",
  },
]

const statusStyles: Record<string, { label: string; bg: string; text: string; icon: LucideIcon }> = {
  submitted: { label: "Topshirilgan", bg: "bg-green-50", text: "text-green-600", icon: CheckCircle },
  pending: { label: "Kutilmoqda", bg: "bg-yellow-50", text: "text-yellow-600", icon: Hourglass },
  late: { label: "Kechiktirilgan", bg: "bg-red-50", text: "text-red-600", icon: AlertCircle },
}

export default function Homework() {
  const [filter, setFilter] = useState("all")
  const { tr } = useAppSettings()

  const filtered = filter === "all"
    ? mockHomework
    : mockHomework.filter((h) => h.status === filter)

  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-20">
      <div className="max-w-lg mx-auto px-2.5 pt-4">
        <div className="flex items-center gap-2.5 mb-1 animate-fade-in">
          <div className="p-1.5 bg-[#2001FF]/10 rounded-lg">
            <FileText size={16} className="text-[#2001FF]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{tr("Topshiriqlar")}</h1>
            <p className="text-[10px] text-gray-500">{tr("Uy vazifalari va topshiriqlar")}</p>
          </div>
        </div>

        <div className="flex gap-1 my-3 overflow-x-auto pb-1 scrollbar-hide animate-fade-in">
          {[
            { key: "all", label: tr("Barchasi") },
            { key: "pending", label: tr("Kutilmoqda") },
            { key: "submitted", label: tr("Topshirilgan") },
            { key: "late", label: tr("Kechiktirilgan") },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                filter === tab.key
                  ? "bg-[#2001FF] text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 animate-slide-up">
          {filtered.map((hw) => {
            const st = statusStyles[hw.status]
            const Icon = st.icon
            return (
              <div
                key={hw.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="p-0.5 bg-gray-50 rounded-lg">
                        <BookOpen size={11} className="text-[#2001FF]" />
                      </div>
                      <h3 className="font-semibold text-xs text-gray-900">{hw.subject}</h3>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 ml-5">{hw.description}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-medium flex items-center gap-1 whitespace-nowrap ${st.bg} ${st.text}`}>
                    <Icon size={10} />
                    {tr(st.label)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1.5 ml-5">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {tr("Muddat")}: {hw.deadline}
                  </span>
                  <span>👨‍🏫 {hw.teacher}</span>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center mt-3">
            <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FileText size={18} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-xs">{tr("Topshiriqlar mavjud emas")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
