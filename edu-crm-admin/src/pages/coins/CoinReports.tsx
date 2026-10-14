import { useEffect, useState } from "react"
import { BarChart3, Loader2, TrendingUp, TrendingDown, ShoppingBag, Wallet, ChevronLeft, ChevronRight, Trophy } from "lucide-react"
import { api } from "../../api"
import type { LeadeboardItem, MonthlyReport, ReportStudentRow } from "../../types"
import type { SectionProps } from "./props"

export default function CoinReports({ has, isAdmin, isSuper }: SectionProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [rows, setRows] = useState<ReportStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showStudents, setShowStudents] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeadeboardItem[]>([])
  const [leadPeriod, setLeadPeriod] = useState("all")

  const canReports = isAdmin || isSuper || has("coin.reports")

  const load = () => {
    setLoading(true)
    Promise.all([api.coinReports(year, month), api.coinReportStudents(year, month)])
      .then(([r, d]) => {
        setReport(r)
        setRows(d.rows)
      })
      .finally(() => setLoading(false))
    api.coinLeaderboard(leadPeriod, 20).then((d) => setLeaderboard(d.leaderboard)).catch(() => {})
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, leadPeriod])

  if (!canReports) {
    return (
      <div className="card-premium p-8 text-center">
        <p className="text-[12px] font-semibold text-gray-500">Hisobotlarni ko'rish uchun ruxsat yo'q</p>
      </div>
    )
  }

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString("uz-UZ", { month: "long" })

  return (
    <div className="space-y-3 animate-page-enter">
      {/* Davr tanlash */}
      <div className="card-premium p-3.5 flex items-center justify-between">
        <button onClick={prevMonth} className="w-8 h-8 bg-[#F4F5FA] rounded-full flex items-center justify-center btn-hover">
          <ChevronLeft size={14} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-[13px] font-extrabold text-gray-900 capitalize">{monthName}</p>
          <p className="text-[10px] font-medium text-gray-400">{year}-yil</p>
        </div>
        <button onClick={nextMonth} className="w-8 h-8 bg-[#F4F5FA] rounded-full flex items-center justify-center btn-hover">
          <ChevronRight size={14} className="text-gray-600" />
        </button>
      </div>

      {loading && !report ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : report ? (
        <>
          {/* Yig'indi */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-green-50 p-3.5">
              <p className="text-[9px] font-semibold text-green-600 flex items-center gap-1">
                <TrendingUp size={11} /> Bonus
              </p>
              <p className="text-[16px] font-extrabold text-green-700 mt-1">+{report.bonus}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3.5">
              <p className="text-[9px] font-semibold text-red-500 flex items-center gap-1">
                <TrendingDown size={11} /> Penalty
              </p>
              <p className="text-[16px] font-extrabold text-red-500 mt-1">{report.penalty}</p>
            </div>
            <div className="rounded-2xl bg-[#2001FF]/10 p-3.5">
              <p className="text-[9px] font-semibold text-[#2001FF] flex items-center gap-1">
                <Wallet size={11} /> Davomat
              </p>
              <p className="text-[16px] font-extrabold text-[#2001FF] mt-1">
                {report.attendance >= 0 ? "+" : ""}
                {report.attendance}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3.5">
              <p className="text-[9px] font-semibold text-amber-500 flex items-center gap-1">
                <ShoppingBag size={11} /> Shop
              </p>
              <p className="text-[16px] font-extrabold text-amber-600 mt-1">{report.shop}</p>
            </div>
          </div>

          <div className="card-premium p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-gray-900">Umumiy natija</p>
              <p className="text-[9px] text-gray-400">
                {report.active_students}/{report.total_students} o'quvchi faol
              </p>
            </div>
            <p
              className={`text-[18px] font-extrabold ${report.net >= 0 ? "text-green-600" : "text-red-500"}`}
            >
              {report.net >= 0 ? "+" : ""}
              {report.net}
            </p>
          </div>

          <button
            onClick={() => setShowStudents(!showStudents)}
            className="w-full card-premium p-3 flex items-center justify-between btn-hover"
          >
            <span className="flex items-center gap-2 text-[12px] font-bold text-gray-800">
              <BarChart3 size={14} className="text-[#2001FF]" /> O'quvchilar bo'yicha
            </span>
            <span className={`text-[11px] font-bold ${showStudents ? "text-[#2001FF]" : "text-gray-400"}`}>
              {rows.length} ta
            </span>
          </button>

          {showStudents && (
            <div className="card-premium divide-y divide-gray-50">
              {rows.slice(0, 40).map((r) => (
                <div key={r.student_id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-gray-900 truncate">{r.student_name}</p>
                    <p className="text-[9px] text-gray-400">
                      B{r.bonus} · P{r.penalty} · D{r.attendance} · S{r.shop}
                    </p>
                  </div>
                  <p
                    className={`text-[12px] font-extrabold shrink-0 ${
                      r.month_delta >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {r.month_delta >= 0 ? "+" : ""}
                    {r.month_delta}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Leaderboard */}
          <div className="card-premium p-3">
            <p className="text-[12px] font-bold text-gray-900 mb-2 flex items-center gap-1.5">
              <Trophy size={13} className="text-amber-500" /> Leaderboard
            </p>
            <div className="flex gap-1.5 mb-2.5">
              <button
                onClick={() => setLeadPeriod("all")}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold btn-hover ${
                  leadPeriod === "all" ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
                }`}
              >
                Umumiy
              </button>
              <button
                onClick={() => setLeadPeriod("monthly")}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold btn-hover ${
                  leadPeriod === "monthly" ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
                }`}
              >
                Shu oy
              </button>
            </div>
            <div className="space-y-1">
              {leaderboard.map((l) => (
                <div key={l.student_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                        l.rank === 1
                          ? "bg-amber-100 text-amber-600"
                          : l.rank === 2
                            ? "bg-gray-100 text-gray-500"
                            : l.rank === 3
                              ? "bg-orange-100 text-orange-500"
                              : "bg-[#F4F5FA] text-gray-400"
                      }`}
                    >
                      {l.rank}
                    </span>
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{l.student_name}</p>
                  </div>
                  <p className="text-[12px] font-extrabold text-[#2001FF] shrink-0">{l.score}</p>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-[10px] text-gray-400 text-center py-2">Ma'lumot yo'q</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}