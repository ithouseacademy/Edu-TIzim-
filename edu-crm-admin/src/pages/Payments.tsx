import { useState, useEffect } from "react"
import {
  Wallet, CalendarDays, ArrowUpCircle, ArrowDownCircle, BookOpen, RefreshCcw, Clock,
} from "lucide-react"
import { api, loadEmployee } from "../api"
import type { AdminTransactionsResponse } from "../types"
import WaveHeader from "../components/WaveHeader"

const typeColors: Record<string, { bg: string; text: string; icon: any }> = {
  payment: { bg: "bg-green-50", text: "text-green-600", icon: ArrowUpCircle },
  lesson: { bg: "bg-red-50", text: "text-red-600", icon: BookOpen },
  correction: { bg: "bg-amber-50", text: "text-amber-600", icon: RefreshCcw },
  withdrawal: { bg: "bg-violet-50", text: "text-violet-600", icon: ArrowDownCircle },
  wrong: { bg: "bg-gray-100", text: "text-gray-500", icon: Clock },
}

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type Period = "hammasi" | "bugun" | "oy"

export default function Payments() {
  const [data, setData] = useState<AdminTransactionsResponse | null>(null)
  const [period, setPeriod] = useState<Period>("hammasi")
  const [selYear, setSelYear] = useState(new Date().getFullYear())
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    api.transactions(500)
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const today = localToday()
  const nowYear = new Date().getFullYear()
  const allTx = (data?.transactions || []).filter((t) => t.type === "payment" || t.type === "withdrawal")
  const txYears = Array.from(new Set(allTx.map((t) => Number(t.date.slice(0, 4))))).filter((y) => !isNaN(y))
  const minYear = txYears.length ? Math.min(...txYears) : nowYear
  const yearOptions: number[] = []
  for (let y = minYear; y <= nowYear; y++) yearOptions.push(y)
  const selPrefix = `${selYear}-${String(selMonth).padStart(2, "0")}`
  const periodTx = allTx.filter((t) => {
    if (period === "hammasi") return t.date.startsWith(String(selYear))
    if (period === "bugun") return t.date === today
    return t.date.startsWith(selPrefix)
  })

  const totalIn = periodTx.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0)
  const totalOut = periodTx.reduce((s, t) => s + (t.amount < 0 ? t.amount : 0), 0)
  const net = totalIn + totalOut

  const monthNames = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
  ]
  const periodLabel = period === "bugun" ? "Bugun" : period === "oy" ? `Bu oy (${monthNames[selMonth-1]} ${selYear})` : `Barchasi (${selYear})`

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="To'lovlar"
        leftSlot={
          <button className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover">
            <Wallet size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />
      <div className="max-w-lg mx-auto px-3">

        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium mb-3">{error}</div>
        )}

        <section className="mb-3 animate-scale-in">
          <div className="card-premium p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-[#2001FF] rounded-xl flex items-center justify-center">
                  <Wallet size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Kassadagi balans</p>
                  <p className="text-lg font-bold text-[#2001FF] mt-px">
                    {(data?.kassa_balance || 0).toLocaleString()} so'm
                  </p>
                  {data?.kassa_name && (
                    <p className="text-[9px] font-medium text-gray-400">{data.kassa_name}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex bg-gray-100 rounded-xl p-0.5 mb-2.5">
              <button
                onClick={() => setPeriod("hammasi")}
                className={`flex-1 h-8 rounded-lg text-[11px] font-bold transition-all ${
                  period === "hammasi" ? "bg-white shadow-sm text-[#2001FF]" : "text-gray-500"
                }`}
              >
                Barchasi
              </button>
              <button
                onClick={() => setPeriod("bugun")}
                className={`flex-1 h-8 rounded-lg text-[11px] font-bold transition-all ${
                  period === "bugun" ? "bg-white shadow-sm text-[#2001FF]" : "text-gray-500"
                }`}
              >
                Bugun
              </button>
              <button
                onClick={() => setPeriod("oy")}
                className={`flex-1 h-8 rounded-lg text-[11px] font-bold transition-all ${
                  period === "oy" ? "bg-white shadow-sm text-[#2001FF]" : "text-gray-500"
                }`}
              >
                Bu oy
              </button>
            </div>

            {period === "hammasi" && (
              <div className="flex items-center gap-1.5 mb-2.5">
                <select
                  value={selYear}
                  onChange={(e) => setSelYear(Number(e.target.value))}
                  className="flex-1 h-9 text-[11px] font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 outline-none focus:border-[#2001FF]"
                >
                  {(yearOptions.includes(selYear) ? yearOptions : [...yearOptions, selYear].sort((a, b) => a - b)).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {period === "oy" && (
              <div className="flex items-center gap-1.5 mb-2.5">
                <select
                  value={selMonth}
                  onChange={(e) => setSelMonth(Number(e.target.value))}
                  className="flex-1 h-9 text-[11px] font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 outline-none focus:border-[#2001FF]"
                >
                  {monthNames.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={selYear}
                  onChange={(e) => setSelYear(Number(e.target.value))}
                  className="flex-1 h-9 text-[11px] font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 outline-none focus:border-[#2001FF]"
                >
                  {(yearOptions.includes(selYear) ? yearOptions : [...yearOptions, selYear].sort((a, b) => a - b)).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 rounded-xl p-2.5">
                <p className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">
                  {periodLabel} kirim
                </p>
                <p className="text-sm font-bold text-green-700 mt-px">+{totalIn.toLocaleString()} so'm</p>
              </div>
              <div className="bg-red-50 rounded-xl p-2.5">
                <p className="text-[9px] font-semibold text-red-600 uppercase tracking-wider">
                  {periodLabel} chiqim
                </p>
                <p className="text-sm font-bold text-red-600 mt-px">{totalOut.toLocaleString()} so'm</p>
              </div>
              <div className={`col-span-2 rounded-xl p-2.5 ${net < 0 ? "bg-red-50" : "bg-[#2001FF]/5"}`}>
                <p className={`text-[9px] font-semibold uppercase tracking-wider ${net < 0 ? "text-red-500" : "text-[#2001FF]"}`}>
                  {periodLabel} qoldiq
                </p>
                <p className={`text-sm font-bold mt-px ${net < 0 ? "text-red-600" : "text-[#2001FF]"}`}>
                  {net < 0 ? "-" : ""}{Math.abs(net).toLocaleString()} so'm
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-gray-900">To'lovlar</h2>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
              <CalendarDays size={11} />
              {periodLabel} · {periodTx.length} ta
            </span>
          </div>
          {loading ? (
            <div className="card-premium p-6 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
            </div>
          ) : periodTx.length === 0 ? (
            <div className="card-premium p-6 text-center">
              <Wallet size={22} className="mx-auto text-gray-300 mb-1.5" />
              <p className="text-xs font-medium text-gray-400">Bu davrda to'lovlar mavjud emas</p>
            </div>
          ) : (
            <div className="card-premium divide-y divide-gray-50 overflow-hidden">
              {periodTx.map((t) => {
                const cfg = typeColors[t.type] || typeColors.wrong
                const Icon = cfg.icon
                const isPositive = t.amount >= 0
                return (
                  <div key={t.id} className="px-3 py-2.5 flex items-center gap-2.5 animate-fade-in">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={15} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-gray-900 truncate">
                        {t.type_display}
                        {t.group ? ` - ${t.group}` : ""}
                      </p>
                      {t.student_name && (
                        <p className="text-[10px] font-medium text-gray-400 truncate">{t.student_name}</p>
                      )}
                      <p className="text-[9px] font-medium text-gray-400">
                        {t.created_at}
                        {t.created_by ? ` · ${t.created_by}` : ""}
                      </p>
                    </div>
                    <span className={`text-[12px] font-bold shrink-0 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {t.amount_str}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
