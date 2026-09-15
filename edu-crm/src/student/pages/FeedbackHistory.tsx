import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, MessageCircle, CheckCircle2, Clock } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { Feedback } from "../types"

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  yangi: { label: "Yangi", color: "text-red-600", bg: "bg-red-50" },
  oqilgan: { label: "O'qilgan", color: "text-amber-600", bg: "bg-amber-50" },
  javob_berilgan: { label: "Javob berilgan", color: "text-green-600", bg: "bg-green-50" },
}
function trStatus(tr: (k: string) => string, status: string): string {
  switch (status) {
    case "yangi":
      return tr("Yangi")
    case "oqilgan":
      return tr("O'qilgan")
    case "javob_berilgan":
      return tr("Javob berilgan")
    default:
      return status
  }
}

export default function FeedbackHistory() {
  const navigate = useNavigate()
  const { tr } = useAppSettings()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.myFeedback()
      .then((res) => setFeedbacks(res.feedbacks || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-10 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/profile/feedback")}
              className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
              aria-label={tr("Orqaga")}
            >
              <ArrowLeft size={16} className="text-gray-700" />
            </button>
            <div className="p-1.5 bg-[#2001FF]/10 rounded-lg">
              <MessageCircle size={18} className="text-[#2001FF]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 tracking-tight">{tr("Mening xabarlarim")}</h1>
              <p className="text-[10px] text-gray-400 font-medium">{tr("Taklif va shikoyatlar tarixi")}</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-gray-400">{feedbacks.length} {tr("ta")}</span>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="card-premium p-6 text-center">
            <div className="w-10 h-10 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center mb-2">
              <MessageCircle size={18} className="text-gray-300" />
            </div>
            <p className="text-xs font-semibold text-gray-700">{tr("Hozircha xabarlar yo'q")}</p>
            <p className="text-[10px] font-medium text-gray-400 mt-1">
              {tr("«Takliflar» sahifasida birinchi taklif yoki shikoyatingizni yuboring.")}
            </p>
          </div>
        ) : (
          <div className="space-y-2 animate-slide-up">
            {feedbacks.map((f) => {
              const isComplaint = f.category === "shikoyat"
              const status = STATUS_META[f.status] || STATUS_META.yangi
              return (
                <div key={f.id} className="card-premium p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        isComplaint ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-600"
                      }`}
                    >
                      {f.category_display}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${status.bg} ${status.color}`}>
                      {f.status === "javob_berilgan" && <CheckCircle2 size={10} className="inline mr-0.5" />}
                      {trStatus(tr, f.status)}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] font-medium text-gray-400">
                      <Clock size={9} />
                      {f.created_at}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">{f.message}</p>
                  {f.admin_response && (
                    <div className="mt-2.5 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-bold text-green-700 mb-1">{tr("Admin javobi")}</p>
                      <p className="text-[11px] font-medium text-green-800 whitespace-pre-wrap leading-relaxed">
                        {f.admin_response}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}