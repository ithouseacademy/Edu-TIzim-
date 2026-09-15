import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, History } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { StudentProfile } from "../types"

function formatMoney(n: number): string {
  return `${n.toLocaleString("ru-RU")} so'm`
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[18px] text-[#6B6B70]">{label}</span>
      <span className={`text-[18px] font-medium text-[#1B1B1F] ${valueClass || ""}`}>{value}</span>
    </div>
  )
}

export default function BalancePage() {
  const navigate = useNavigate()
  const { tr } = useAppSettings()
  const [student, setStudent] = useState<StudentProfile | null>(null)

  useEffect(() => {
    api.profile()
      .then((res) => setStudent(res.student))
      .catch(() => {})
  }, [])

  if (!student) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#E5E5EA] border-t-[#1B1B1F] rounded-full animate-spin" />
      </div>
    )
  }

  const balance = student.balance ?? 0
  const balanceStr = formatMoney(balance)
  const remaining = student.remaining_lessons ?? 0
  const hasDebt = (student.debt ?? 0) > 0
  const debtStr = student.debt_str || "0 so'm"
  const toPayStr = student.to_pay_str || "0 so'm"

  return (
    <div className="min-h-[100dvh] bg-white text-[#1B1B1F] flex flex-col font-sans">
      <header className="h-20 bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/profile")} className="btn-hover" aria-label={tr("Orqaga")}>
            <ArrowLeft size={22} className="text-[#1B1B1F]" />
          </button>
          <span className="text-[20px] font-medium text-[#1B1B1F] tracking-tight">{tr("Balans")}</span>
        </div>
        <button
          onClick={() => navigate("/profile/transactions")}
          className="w-10 h-10 rounded-full bg-[#F2F2F5] flex items-center justify-center btn-hover"
          aria-label={tr("Tranzaksiyalar")}
        >
          <History size={18} className="text-[#6B6B70]" />
        </button>
      </header>

      <div className="flex flex-col flex-1 px-6 min-h-0">
        <div className="pt-16 text-center">
          <p className="text-[16px] text-[#8A8A8E]">{tr("Joriy balans")}</p>
          <p className={`mt-3 text-[46px] font-medium leading-none tracking-tight ${balance < 0 ? "text-[#DC2626]" : "text-[#1B1B1F]"}`}>
            {balanceStr}
          </p>
        </div>

        <div className="flex-1" />

        <div
          className="space-y-5 mb-10"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Row label={tr("Qolgan darslar soni:")} value={`${remaining} ${tr("ta")}`} />
          <Row label={tr("Umumiy qarzdorlik:")} value={debtStr} valueClass={hasDebt ? "text-[#DC2626]" : ""} />
          <Row label={tr("To‘lanishi kerak:")} value={toPayStr} valueClass={(student.to_pay ?? 0) > 0 ? "text-[#DC2626]" : ""} />
        </div>
      </div>
    </div>
  )
}