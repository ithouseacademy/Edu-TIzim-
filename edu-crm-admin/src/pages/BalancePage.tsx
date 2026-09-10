import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Wallet, ChevronLeft, ReceiptText, Banknote, PieChart } from "lucide-react"
import { api, loadEmployee } from "../api"
import type { SalaryData } from "../types"
import WaveHeader from "../components/WaveHeader"

export default function BalancePage() {
  const navigate = useNavigate()
  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  const [salary, setSalary] = useState<SalaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.mySalary()
      .then((d) => setSalary(d.salary))
      .finally(() => setLoading(false))
  }, [])

  const balance = salary ? salary.balance : (emp?.teacher_balance ?? 0)
  const avans = salary ? salary.avans_balance : 0
  const net = balance - avans
  const salaryType = salary?.salary_type_display || emp?.salary_type_display || ""
  const salaryConfigured =
    !!salary &&
    (salary.salary_type === "monthly"
      ? (salary.monthly_salary || 0) > 0
      : (salary.percent || 0) > 0)
  const salaryValue =
    salary && salary.salary_type === "monthly"
      ? `${(salary.monthly_salary || 0).toLocaleString()} so'm`
      : `${salary?.percent || 0}%`

  const isNegative = net < 0
  const absNet = Math.abs(net)

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Balans & Maosh"
        leftSlot={
          <button
            onClick={() => navigate("/profile")}
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

        {loading ? (
          <div className="card-premium p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Asosiy balans kartasi */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2001FF] via-[#3E37FF] to-[#4361FF] p-5 mb-4 text-white shadow-lg shadow-[#2001FF]/25 animate-scale-in">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-14 -right-6 w-32 h-32 rounded-full bg-white/[0.07]" />

              <div className="relative flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-full flex items-center justify-center border border-white/20 shrink-0">
                  <span className="text-base font-bold text-white">{initials || "A"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">
                    {emp?.first_name || ""} {emp?.last_name || ""}
                  </p>
                  <p className="text-[10px] font-medium text-white/70 truncate">
                    {emp?.position?.name || emp?.role?.name || "Xodim"}
                  </p>
                </div>
              </div>

              <div className="relative">
                <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Wallet size={12} /> Foydalanish mumkin
                </p>
                <p className="text-[28px] leading-none font-extrabold tracking-tight">
                  {isNegative ? "-" : ""}{absNet.toLocaleString()}
                  <span className="ml-1.5 text-[15px] font-semibold text-white/75">so'm</span>
                </p>
                <p className="mt-1 text-[10px] font-medium text-white/60">
                  {isNegative ? "Qarzingiz mavjud" : "Joriy balansingiz"}
                </p>
              </div>
            </div>

            {/* Taqsimot */}
            <div className="space-y-2.5 animate-page-enter" style={{ animationDelay: "80ms" }}>
              {/* Avans */}
              <div className="card-premium p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                    <ReceiptText size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-900">Avans</p>
                    <p className="text-[10px] font-medium text-gray-400">Olgan avans miqdori</p>
                  </div>
                </div>
                <p className="text-base font-bold text-amber-600">{avans.toLocaleString()} so'm</p>
              </div>

              {/* Oylik maosh */}
              <div className="card-premium p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                    <Banknote size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-900">Oylik maosh</p>
                    <p className="text-[10px] font-medium text-gray-400">
                      {salaryConfigured ? salaryType : "Belgilanmagan"}
                    </p>
                  </div>
                </div>
                <p className={`text-base font-bold ${salaryConfigured ? "text-green-600" : "text-gray-400"}`}>
                  {salaryConfigured ? salaryValue : "-"}
                </p>
              </div>

              {/* Jami balans */}
              <div className="card-premium p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2001FF]/10 rounded-xl flex items-center justify-center shrink-0">
                      <PieChart size={18} className="text-[#2001FF]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-900">Jami balans</p>
                      <p className="text-[10px] font-medium text-gray-400">Balans - Avans</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between px-1">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-gray-400">Balans</p>
                    <p className="text-[13px] font-bold text-gray-800">{balance.toLocaleString()} so'm</p>
                  </div>
                  <div className="text-[10px] font-medium text-gray-400 pb-0.5">−</div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-gray-400">Avans</p>
                    <p className="text-[13px] font-bold text-amber-600">{avans.toLocaleString()} so'm</p>
                  </div>
                  <div className="text-[10px] font-medium text-gray-400 pb-0.5">=</div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-medium text-gray-400">Natija</p>
                    <p className={`text-[13px] font-extrabold ${isNegative ? "text-red-500" : "text-green-600"}`}>
                      {isNegative ? "-" : ""}{absNet.toLocaleString()} so'm
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
