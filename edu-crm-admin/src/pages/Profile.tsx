import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRound, Send, LogOut, User, Wallet, ChevronRight } from "lucide-react"
import { api, loadEmployee, clearSession } from "../api"
import type { SalaryData } from "../types"
import WaveHeader from "../components/WaveHeader"

const TELEGRAM_BOT_URL = "https://t.me/ithousekuy_bot"

export default function Profile() {
  const navigate = useNavigate()
  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  const [salary, setSalary] = useState<SalaryData | null>(null)

  useEffect(() => {
    api.mySalary().then((d) => setSalary(d.salary)).catch(() => {})
  }, [])

  const balance = salary ? salary.balance : (emp?.teacher_balance ?? 0)
  const avans = salary ? salary.avans_balance : 0
  const net = balance - avans
  const isNegative = net < 0

  const handleLogout = async () => {
    try { await api.logout() } catch {}
    clearSession()
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Profil"
        leftSlot={
          <button className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover">
            <User size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />
      <div className="max-w-lg mx-auto px-3">

        <section className="mb-3 animate-scale-in">
          <div className="card-premium p-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-full flex items-center justify-center shadow-md shadow-[#2001FF]/15 shrink-0">
                <span className="text-lg font-bold text-white">{initials || "A"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                  {emp?.first_name || ""} {emp?.last_name || ""}
                </p>
                <p className="text-[10px] font-medium text-gray-400 mt-px">{emp?.phone || ""}</p>
                <p className="text-[10px] font-medium text-gray-400">{emp?.position?.name || emp?.role?.name || "Xodim"}</p>
              </div>
            </div>

            <button
              onClick={() => navigate("/profile/balance")}
              className="mt-3 w-full bg-[#2001FF]/5 rounded-xl p-3 btn-hover text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Wallet size={14} className="text-[#2001FF]" />
                <p className="text-[9px] font-semibold text-[#2001FF] uppercase tracking-wider">Balans</p>
              </div>
              <div className="flex items-center gap-1">
                <p className={`text-[13px] font-extrabold ${isNegative ? "text-red-500" : "text-[#2001FF]"}`}>
                  {isNegative ? "-" : ""}{Math.abs(net).toLocaleString()}
                </p>
                <span className="text-[9px] font-semibold text-[#2001FF]/50">so'm</span>
                <ChevronRight size={13} className="text-[#2001FF]/40 mt-px" />
              </div>
            </button>
          </div>
        </section>

        <div className="space-y-2 animate-page-enter" style={{ animationDelay: "80ms" }}>
          <button
            onClick={() => navigate("/change-password")}
            className="w-full flex items-center gap-2.5 card-premium-sm px-3 py-3 text-left btn-hover"
          >
            <div className="w-8 h-8 bg-[#2001FF]/10 rounded-lg flex items-center justify-center shrink-0">
              <KeyRound size={15} className="text-[#2001FF]" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-gray-900">Parolni o'zgartirish</p>
              <p className="text-[10px] font-medium text-gray-400">Yangi parol o'rnatish</p>
            </div>
            <span className="text-gray-300 font-bold text-sm">›</span>
          </button>

          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 card-premium-sm px-3 py-3 text-left btn-hover"
          >
            <div className="w-8 h-8 bg-[#2001FF] rounded-lg flex items-center justify-center shrink-0">
              <Send size={15} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-gray-900">Telegram botga o'tish</p>
              <p className="text-[10px] font-medium text-gray-400">@ithousekuy_bot</p>
            </div>
            <span className="text-gray-300 font-bold text-sm">›</span>
          </a>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 card-premium-sm px-3 py-3 text-left btn-hover"
          >
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <LogOut size={15} className="text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-red-500">Chiqish</p>
            </div>
            <span className="text-gray-300 font-bold text-sm">›</span>
          </button>
        </div>
      </div>
    </div>
  )
}
