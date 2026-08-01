import { useState } from "react"
import { BookOpen, Clock, AlertCircle, CheckCircle, Hourglass, FileText } from "lucide-react"

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

const statusStyles: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  submitted: { label: "Topshirilgan", bg: "bg-green-50", text: "text-green-600", icon: CheckCircle },
  pending: { label: "Kutilmoqda", bg: "bg-yellow-50", text: "text-yellow-600", icon: Hourglass },
  late: { label: "Kechiktirilgan", bg: "bg-red-50", text: "text-red-600", icon: AlertCircle },
}

export default function Homework() {
  const [filter, setFilter] = useState("all")

  const filtered = filter === "all"
    ? mockHomework
    : mockHomework.filter((h) => h.status === filter)

  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5">
        <div className="flex items-center gap-3 mb-1 animate-fade-in">
          <div className="p-2 bg-[#2001FF]/10 rounded-xl">
            <FileText size={20} className="text-[#2001FF]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Topshiriqlar</h1>
            <p className="text-xs text-gray-500">Uy vazifalari va topshiriqlar</p>
          </div>
        </div>

        <div className="flex gap-1.5 my-4 overflow-x-auto pb-1 scrollbar-hide animate-fade-in">
          {[
            { key: "all", label: "Barchasi" },
            { key: "pending", label: "Kutilmoqda" },
            { key: "submitted", label: "Topshirilgan" },
            { key: "late", label: "Kechiktirilgan" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                filter === tab.key
                  ? "bg-[#2001FF] text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-100 hover:border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 animate-slide-up">
          {filtered.map((hw) => {
            const st = statusStyles[hw.status]
            const Icon = st.icon
            return (
              <div
                key={hw.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="p-1 bg-gray-50 rounded-lg">
                        <BookOpen size={14} className="text-[#2001FF]" />
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900">{hw.subject}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-8">{hw.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 whitespace-nowrap ${st.bg} ${st.text}`}>
                    <Icon size={12} />
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2 ml-8">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Muddat: {hw.deadline}
                  </span>
                  <span>👨‍🏫 {hw.teacher}</span>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-4">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm">Topshiriqlar mavjud emas</p>
          </div>
        )}
      </div>
    </div>
  )
}
