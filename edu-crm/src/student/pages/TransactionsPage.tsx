import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Wallet, TrendingUp, Clock, BookOpen } from "lucide-react"
import { api } from "../api"
import type { Transaction } from "../types"

const typeColors: Record<string, { bg: string; text: string; icon: any }> = {
  lesson: { bg: "bg-red-50", text: "text-red-600", icon: BookOpen },
  payment: { bg: "bg-green-50", text: "text-green-600", icon: TrendingUp },
  correction: { bg: "bg-amber-50", text: "text-amber-600", icon: Clock },
}

export default function TransactionsPage() {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.profile()
      .then((res) => setTransactions(res.transactions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">So'nggi tranzaksiyalar</h1>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="card-premium px-5 py-10 text-center">
            <Wallet size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-medium text-gray-400">Tranzaksiyalar mavjud emas</p>
          </div>
        ) : (
          <div className="card-premium divide-y divide-gray-50 overflow-hidden">
            {transactions.map((t) => {
              const cfg = typeColors[t.type] || typeColors.correction
              const Icon = cfg.icon
              return (
                <div key={t.id} className="px-3 py-3 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={15} className={cfg.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900">
                      {t.type_display}
                      {t.group ? ` - ${t.group}` : ""}
                    </p>
                    {t.description && (
                      <p className="text-[10px] font-medium text-gray-400 mt-0.5 truncate">{t.description}</p>
                    )}
                    <p className="text-[9px] font-medium text-gray-400 mt-0.5">{t.created_at}</p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {t.amount_str}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
