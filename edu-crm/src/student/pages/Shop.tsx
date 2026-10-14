import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import ShopTab from "../components/ShopTab"
import { useAppSettings } from "../AppSettings"
import { api } from "../api"
import type { CoinSummary } from "../types"

export default function ShopPage() {
  const navigate = useNavigate()
  const { tr } = useAppSettings()
  const [summary, setSummary] = useState<CoinSummary | null>(null)

  const loadSummary = () => {
    api
      .coinSummary()
      .then((d) => setSummary(d.summary))
      .catch(() => {})
  }

  useEffect(() => {
    loadSummary()
  }, [])

  return (
    <div className="min-h-[100dvh] bg-white text-[#1B1B1F] flex flex-col font-sans pb-24">
      <header className="h-20 bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/home")} className="btn-hover" aria-label={tr("Orqaga")}>
            <ArrowLeft size={22} className="text-[#1B1B1F]" />
          </button>
          <span className="text-[20px] font-medium text-[#1B1B1F] tracking-tight">Do'kon</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#F2F2F5] flex items-center justify-center">
          <ShoppingBag size={18} className="text-[#F59E0B]" />
        </div>
      </header>

      <div className="px-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#2001FF] to-[#3E37FF] text-white p-6 shadow-lg shadow-[#2001FF]/20">
          <p className="text-[13px] text-white/70">{tr("Joriy balans")}</p>
          <p className="mt-2 text-[38px] font-semibold leading-none tracking-tight">
            {(summary?.balance ?? 0).toLocaleString("ru-RU")}
          </p>
          <p className="mt-3 text-[12px] text-white/60">{tr("Do'kon xaridlari uchun")}</p>
        </div>

        <div className="py-4">
          <ShopTab tr={tr} onBalanceChange={loadSummary} />
        </div>
      </div>
    </div>
  )
}