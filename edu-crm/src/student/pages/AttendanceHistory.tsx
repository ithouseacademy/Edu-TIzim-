import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, ChevronLeft } from "lucide-react"

export default function AttendanceHistory() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    api.attendanceHistory().then(setStats).catch(() => {})
  }, [])

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] pb-24 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
      </div>
    )
  }

  const statusMap: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    present: { label: "Qatnashgan", dot: "bg-green-500", bg: "bg-green-50", text: "text-green-600" },
    absent: { label: "Kelmagan", dot: "bg-red-500", bg: "bg-red-50", text: "text-red-600" },
    excused: { label: "Uzrli", dot: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-600" },
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24 page-enter">
      <div className="max-w-lg mx-auto px-4 pt-14">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-all font-medium"
        >
          <ChevronLeft size={18} />
          Profile
        </button>

        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <div className="p-2.5 bg-[#2001FF]/10 rounded-xl">
            <TrendingUp size={22} className="text-[#2001FF]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Davomat</h1>
            <p className="text-xs text-gray-400 font-medium">Oylik hisobot</p>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-white rounded-[22px] p-6 card-shadow mb-4 animate-scale-in">
          <div className="flex items-center justify-center mb-5">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke="#10B981" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.percentage / 100) * 339.29} 339.29`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-900">{stats.percentage}%</span>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Davomat</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-green-600">
                <CheckCircle2 size={18} />
                <span className="text-xl font-bold">{stats.present}</span>
              </div>
              <p className="text-[10px] font-medium text-gray-400">Qatnashgan</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-red-500">
                <XCircle size={18} />
                <span className="text-xl font-bold">{stats.absent}</span>
              </div>
              <p className="text-[10px] font-medium text-gray-400">Kelmagan</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-yellow-500">
                <AlertCircle size={18} />
                <span className="text-xl font-bold">{stats.excused}</span>
              </div>
              <p className="text-[10px] font-medium text-gray-400">Uzrli</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-[22px] p-5 card-shadow mb-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-gray-900">Umumiy davomat</span>
            <span className="text-sm font-bold text-gray-900">{stats.total} kun</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#10B981] to-[#34D399] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>

        {/* Records */}
        <div className="flex items-center gap-1.5 mb-3 animate-fade-in">
          <TrendingUp size={16} className="text-[#2001FF]" />
          <p className="text-sm font-bold text-gray-900">Yozuvlar</p>
          <span className="text-xs font-medium text-gray-400 ml-1">({stats.records?.length || 0})</span>
        </div>
        <div className="space-y-1.5 animate-slide-up">
          {stats.records?.length === 0 && (
            <div className="bg-white rounded-[22px] p-10 text-center card-shadow">
              <p className="text-sm font-medium text-gray-400">Hozircha yozuvlar mavjud emas</p>
            </div>
          )}
          {stats.records?.map((rec: any, idx: number) => {
            const st = statusMap[rec.status] || { label: rec.status, dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-600" }
            return (
              <div
                key={idx}
                className="bg-white rounded-[18px] p-3.5 card-shadow card-shadow-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span className="text-sm font-medium text-gray-700">{rec.date}</span>
                    {rec.group && (
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{rec.group}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${st.bg} ${st.text}`}>
                    {st.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
