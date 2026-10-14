import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, Coins as CoinsIcon, TrendingUp, TrendingDown, Wallet, ShoppingBag, BarChart3, History, Users, Settings } from "lucide-react"
import { api } from "../../api"
import type { CoinSummary } from "../../types"
import WaveHeader from "../../components/WaveHeader"
import CoinStudents from "./CoinStudents"
import CoinTransactions from "./CoinTransactions"
import CoinManage from "./CoinManage"
import CoinShop from "./CoinShop"
import CoinReports from "./CoinReports"

interface MeInfo {
  is_admin: boolean
  is_teacher: boolean
  is_super_admin: boolean
  permissions: string[]
}

type Section =
  | { key: "dashboard"; label: string; icon: typeof CoinsIcon }
  | { key: "students"; label: string; icon: typeof Users }
  | { key: "transactions"; label: string; icon: typeof History }
  | { key: "shop"; label: string; icon: typeof ShoppingBag }
  | { key: "settings"; label: string; icon: typeof Settings }
  | { key: "reports"; label: string; icon: typeof BarChart3 }

export default function Coins() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeInfo | null>(null)
  const [section, setSection] = useState("dashboard")
  const [summary, setSummary] = useState<CoinSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    api
      .me()
      .then((d) => {
        setIsAdmin(d.employee.is_teacher ? false : localStorage.getItem("admin_is_admin") === "true")
        setMe({
          is_admin: !d.employee.is_teacher && localStorage.getItem("admin_is_admin") === "true",
          is_teacher: !!d.employee.is_teacher,
          is_super_admin: !!d.employee.is_super_admin,
          permissions: d.employee.permissions || [],
        })
      })
      .catch(() => {})
    api
      .coinSummary()
      .then((s) => setSummary(s))
      .finally(() => setLoading(false))
  }, [])

  const perms = me?.permissions || []
  const has = (c: string) => (me?.is_super_admin ? true : perms.includes(c))
  const adminView = isAdmin || (me?.is_super_admin ?? false)
  const teacherOnly = !!me?.is_teacher && !isAdmin

  const sections: Section[] = [
    { key: "dashboard", label: "Dashboard", icon: CoinsIcon },
    { key: "students", label: "O'quvchilar", icon: Users },
    { key: "transactions", label: "Tarix", icon: History },
  ]
  if (adminView || has("shop.view")) sections.push({ key: "shop", label: "Shop", icon: ShoppingBag })
  if (adminView || has("coin.manage_reasons") || has("coin.settings") || has("coin.manage_teacher")) {
    sections.push({ key: "settings", label: "Sozlamalar", icon: Settings })
  }
  if (adminView || has("coin.reports")) sections.push({ key: "reports", label: "Hisobotlar", icon: BarChart3 })

  const active = sections.find((s) => s.key === section) ?? sections[0]

  const renderSection = () => {
    const props = {
      isAdmin,
      teacherOnly,
      isSuper: !!me?.is_super_admin,
      perms,
      has,
    }
    switch (active.key) {
      case "students":
        return <CoinStudents {...props} />
      case "transactions":
        return <CoinTransactions {...props} />
      case "shop":
        return <CoinShop {...props} />
      case "settings":
        return <CoinManage {...props} />
      case "reports":
        return <CoinReports {...props} />
      default:
        return <Dashboard {...props} summary={summary} loading={loading} />
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Coin tizimi"
        subtitle={teacherOnly ? "Mening o'quvchilarim" : adminView ? "Boshqaruv paneli" : "Umumiy ko'rinish"}
        leftSlot={
          <button
            onClick={() => navigate("/today")}
            className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover"
          >
            <ChevronLeft size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <CoinsIcon size={14} className="text-white" />
          </div>
        }
      />
      <div className="max-w-lg mx-auto px-3">
        {/* Section tablar */}
        <div className="sticky top-0 z-20 -mx-3 px-3 py-2 bg-[#F8F9FC]/95 backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 btn-hover ${
                  active.key === s.key
                    ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/25"
                    : "bg-white text-gray-500 border border-gray-100"
                }`}
              >
                <s.icon size={13} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {renderSection()}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: string
  sub?: string
}) {
  return (
    <div className="card-premium p-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${tone}`}>{icon}</div>
      <p className="text-[10px] font-semibold text-gray-400 mb-0.5">{label}</p>
      <p className="text-[15px] font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-[9px] font-medium text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Dashboard({
  summary,
  loading,
  isAdmin,
  teacherOnly,
}: {
  summary: CoinSummary | null
  loading: boolean
  isAdmin: boolean
  teacherOnly: boolean
}) {
  if (loading) {
    return (
      <div className="card-premium p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
      </div>
    )
  }
  if (!summary) {
    return (
      <div className="card-premium p-6 text-center">
        <p className="text-[12px] font-semibold text-gray-500">Ma'lumot yuklab olinmadi</p>
      </div>
    )
  }
  return (
    <div className="space-y-3 animate-page-enter">
      {teacherOnly && (
        <div className="card-premium p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-900">Kunlik limit</p>
            <p className="text-[10px] font-medium text-gray-400">Bugun berilgan / ruxsat</p>
          </div>
          <p
            className={`text-base font-extrabold ${
              (summary.teacher_daily_used ?? 0) > (summary.teacher_daily_limit ?? 0)
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            {Math.abs(summary.teacher_daily_used ?? 0)} / {summary.teacher_daily_limit ?? "cheksiz"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          icon={<Wallet size={17} className="text-[#2001FF]" />}
          tone="bg-[#2001FF]/10"
          label="Umumiy balans"
          value={`${summary.total_balance.toLocaleString()}`}
        />
        <StatCard
          icon={<TrendingUp size={17} className="text-green-600" />}
          tone="bg-green-50"
          label="Bugun berilgan"
          value={`+${summary.today_given.toLocaleString()}`}
        />
        <StatCard
          icon={<TrendingDown size={17} className="text-red-500" />}
          tone="bg-red-50"
          label="Bugun penalty"
          value={`${summary.today_penalty.toLocaleString()}`}
        />
        <StatCard
          icon={<ShoppingBag size={17} className="text-amber-500" />}
          tone="bg-amber-50"
          label="Bugun shop"
          value={`${summary.today_shop.toLocaleString()}`}
          sub={summary.shop_enabled ? "Shop yoqilgan" : "Shop o'chiq"}
        />
      </div>

      {isAdmin && (
        <div className="card-premium p-4">
          <p className="text-[11px] font-bold text-gray-900 mb-2.5">Bugungi faollik</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-500">Coin olgan o'quvchilar</p>
              <p className="text-[13px] font-bold text-gray-900">{summary.today_students}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-500">Shop xarid qilganlar</p>
              <p className="text-[13px] font-bold text-gray-900">{summary.today_shop_students}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-500">Leaderboard</p>
              <p
                className={`text-[12px] font-bold ${summary.leaderboard_enabled ? "text-green-600" : "text-gray-400"}`}
              >
                {summary.leaderboard_enabled ? "Yoqilgan" : "O'chirilgan"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}