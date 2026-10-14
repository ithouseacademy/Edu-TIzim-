import { useEffect, useState } from "react"
import { Coins, Search, Loader2, TrendingUp, TrendingDown, Gift, X, Trophy, ArrowLeft } from "lucide-react"
import { api } from "../api"
import type { CoinReasonItem, CoinStudentDetail, CoinStudentRow, CoinSummary, CoinTxItem, LeadeboardItem } from "../types"
import WaveHeader from "../components/WaveHeader"
import DesktopShell from "../components/DesktopShell"

type Tab = "students" | "history" | "rating"
type GiveMode = "bonus" | "penalty"

const desktopNav = [
  { key: "dashboard", label: "Dashboard", icon: null, onClick: () => (window.location.hash = "#dashboard") },
  { key: "groups", label: "Mening guruhlarim", icon: null, onClick: () => (window.location.hash = "#my-groups") },
  { key: "salary", label: "Mening oyligim", icon: null, onClick: () => (window.location.hash = "#salary") },
  { key: "tasks", label: "Topshiriqlar", icon: null, onClick: () => (window.location.hash = "#tasks") },
  { key: "coin", label: "Coin tizimi", icon: null, onClick: () => (window.location.hash = "#coin") },
  { key: "profile", label: "Profil", icon: null, onClick: () => (window.location.hash = "#profile") },
]

export default function TeacherCoin({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="md:hidden">
        <div className="min-h-screen bg-[#F8F9FC] max-w-[480px] mx-auto flex flex-col">
          <WaveHeader
            title="Coin tizimi"
            subtitle="O'quvchilarga coin bering"
            leftSlot={
              <button
                onClick={onBack}
                className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover"
              >
                <ArrowLeft size={14} className="text-white" />
              </button>
            }
            rightSlot={
              <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
                <Coins size={14} className="text-white" />
              </div>
            }
          />
          <CoinContent />
        </div>
      </div>

      <div className="hidden md:block">
        <DesktopShell
          activeKey="coin"
          navItems={desktopNav}
          onLogout={() => {
            localStorage.clear()
            window.location.href = "/"
          }}
        >
          <div className="max-w-2xl">
            <CoinContent desktop />
          </div>
        </DesktopShell>
      </div>
    </>
  )
}

function CoinContent({ desktop = false }: { desktop?: boolean }) {
  const [tab, setTab] = useState<Tab>("students")
  const [summary, setSummary] = useState<CoinSummary | null>(null)
  const [reasons, setReasons] = useState<CoinReasonItem[]>([])

  useEffect(() => {
    api.coinSummary().then(setSummary).catch(() => {})
    api.coinReasons().then((d) => setReasons(d.reasons)).catch(() => {})
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: "students", label: "O'quvchilar" },
    { key: "history", label: "Mening tarixim" },
    { key: "rating", label: "Reyting" },
  ]

  return (
    <div className={`px-3 ${desktop ? "pt-0" : "pt-3"} pb-24 md:pb-6 space-y-3`}>
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="card-premium p-3.5">
            <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Umumiy balans</p>
            <p className="text-[16px] font-extrabold text-gray-900">{summary.total_balance.toLocaleString()}</p>
          </div>
          <div className="card-premium p-3.5">
            <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Bugun berilgan</p>
            <p className="text-[16px] font-extrabold text-green-600">+{summary.today_given.toLocaleString()}</p>
          </div>
          <div className="card-premium p-3.5">
            <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Bugun penalty</p>
            <p className="text-[16px] font-extrabold text-red-500">{summary.today_penalty.toLocaleString()}</p>
          </div>
          <div className="card-premium p-3.5">
            <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Kunlik limit</p>
            <p
              className={`text-[16px] font-extrabold ${
                (summary.teacher_daily_used ?? 0) > (summary.teacher_daily_limit ?? 0)
                  ? "text-red-500"
                  : "text-[#2001FF]"
              }`}
            >
              {Math.abs(summary.teacher_daily_used ?? 0)}
              <span className="text-[11px] text-gray-400 font-semibold"> / {summary.teacher_daily_limit ?? "∞"}</span>
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-full text-[11px] font-semibold transition-colors btn-hover ${
              tab === t.key ? "bg-[#2001FF] text-white" : "bg-white text-gray-500 border border-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "students" && <StudentsTab reasons={reasons} />}
      {tab === "history" && <HistoryTab />}
      {tab === "rating" && <RatingTab />}
    </div>
  )
}

function StudentsTab({ reasons }: { reasons: CoinReasonItem[] }) {
  const [query, setQuery] = useState("")
  const [students, setStudents] = useState<CoinStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CoinStudentDetail | null>(null)
  const [giveMode, setGiveMode] = useState<GiveMode | null>(null)

  const load = (q = query) => {
    setLoading(true)
    api
      .coinStudents(q)
      .then((d) => setStudents(d.students))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => load(query), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const openDetail = (id: number) => {
    setGiveMode(null)
    api.coinStudentDetail(id).then(setSelected).catch(() => {})
  }

  const reasonsFor = (mode: GiveMode) =>
    reasons.filter((r) => r.is_active && r.reason_type === (mode === "bonus" ? "BONUS" : "PENALTY"))

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="O'quvchi qidirish..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray-100 text-[12px] outline-none focus:border-[#2001FF]"
        />
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <p className="text-[12px] font-semibold text-gray-500">O'quvchilar topilmadi</p>
        </div>
      ) : (
        <div className="card-premium divide-y divide-gray-50">
          {students.map((s) => (
            <button
              key={s.student_id}
              onClick={() => openDetail(s.student_id)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left bg-transparent border-none cursor-pointer btn-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-gray-900 truncate">{s.student_name}</p>
                <p className="text-[9px] text-gray-400 truncate">{s.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[13px] font-extrabold ${s.balance >= 0 ? "text-[#2001FF]" : "text-red-500"}`}>
                  {s.balance}
                </p>
                <p className="text-[9px] text-gray-400">balans</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-4 max-h-[88vh] overflow-y-auto no-scrollbar animate-page-enter">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[14px] font-extrabold text-gray-900">{selected.student.student_name}</p>
                <p className="text-[10px] text-gray-400">{selected.student.phone}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center btn-hover"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-xl bg-[#2001FF]/10 p-2.5 text-center">
                <p className="text-[9px] font-semibold text-[#2001FF]">Balans</p>
                <p className="text-[14px] font-extrabold text-[#2001FF]">{selected.summary.balance}</p>
              </div>
              <div className="rounded-xl bg-green-50 p-2.5 text-center">
                <p className="text-[9px] font-semibold text-green-600">Bonus</p>
                <p className="text-[14px] font-extrabold text-green-700">{selected.summary.bonus}</p>
              </div>
              <div className="rounded-xl bg-red-50 p-2.5 text-center">
                <p className="text-[9px] font-semibold text-red-500">Penalty</p>
                <p className="text-[14px] font-extrabold text-red-500">{selected.summary.penalty}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setGiveMode(giveMode === "bonus" ? null : "bonus")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold btn-hover ${
                  giveMode === "bonus" ? "bg-green-600 text-white" : "bg-green-50 text-green-600"
                }`}
              >
                <TrendingUp size={13} /> Bonus
              </button>
              <button
                onClick={() => setGiveMode(giveMode === "penalty" ? null : "penalty")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold btn-hover ${
                  giveMode === "penalty" ? "bg-red-500 text-white" : "bg-red-50 text-red-500"
                }`}
              >
                <TrendingDown size={13} /> Penalty
              </button>
            </div>

            {giveMode && (
              <GivePanel
                studentId={selected.student.student_id}
                mode={giveMode}
                reasons={reasonsFor(giveMode)}
                onDone={() => openDetail(selected.student.student_id)}
                onCancel={() => setGiveMode(null)}
              />
            )}

            <p className="text-[11px] font-bold text-gray-500 my-2">So'nggi amallar</p>
            <div className="divide-y divide-gray-50">
              {selected.transactions.length === 0 && (
                <p className="text-[10px] text-gray-400 text-center py-3">Hozircha amallar yo'q</p>
              )}
              {selected.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">
                      {t.reason_name || t.transaction_type_display}
                    </p>
                    <p className="text-[9px] text-gray-400">
                      {t.date} {t.time}
                      {t.created_by ? ` · ${t.created_by}` : ""}
                    </p>
                  </div>
                  <p className={`text-[12px] font-extrabold shrink-0 ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {t.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GivePanel({
  studentId,
  mode,
  reasons,
  onDone,
  onCancel,
}: {
  studentId: number
  mode: GiveMode
  reasons: CoinReasonItem[]
  onDone: () => void
  onCancel: () => void
}) {
  const [reasonId, setReasonId] = useState<number | null>(null)
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    if (!reasonId) {
      setError("Sabab tanlang")
      return
    }
    setSaving(true)
    setError("")
    try {
      await api.coinGive({ student_id: studentId, reason_id: reasonId, description })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-[#F4F5FA] p-3 mb-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {reasons.length === 0 && (
          <p className="text-[10px] text-gray-400 py-1">
            {mode === "bonus" ? "Bonus" : "Penalty"} sabablari mavjud emas
          </p>
        )}
        {reasons.map((r) => (
          <button
            key={r.id}
            onClick={() => setReasonId(r.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold btn-hover ${
              reasonId === r.id
                ? mode === "bonus"
                  ? "bg-green-600 text-white"
                  : "bg-red-500 text-white"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            {r.name}
            <span className="font-extrabold">
              {r.amount >= 0 ? "+" : ""}
              {r.amount}
            </span>
          </button>
        ))}
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Izoh (ixtiyoriy)"
        className="w-full px-3 py-2 rounded-xl bg-white text-[11px] outline-none border border-gray-100"
      />
      {error && <p className="text-[10px] font-semibold text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white text-gray-500 text-[11px] font-bold btn-hover border border-gray-200">
          Bekor
        </button>
        <button
          onClick={submit}
          disabled={saving || !reasonId}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#2001FF] text-white text-[11px] font-bold btn-hover disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
          Berish
        </button>
      </div>
    </div>
  )
}

function HistoryTab() {
  const [items, setItems] = useState<CoinTxItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .coinMyTransactions()
      .then((d) => setItems(d.transactions))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="card-premium p-8 flex items-center justify-center">
        <Loader2 size={20} className="text-[#2001FF] animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="card-premium p-8 text-center">
        <p className="text-[12px] font-semibold text-gray-500">Tarix bo'sh</p>
      </div>
    )
  }

  return (
    <div className="card-premium divide-y divide-gray-50">
      {items.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-gray-900 truncate">{t.student_name}</p>
            <p className="text-[9px] text-gray-400 truncate">
              {t.reason_name || t.transaction_type_display}
              {t.description ? ` · ${t.description}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-[12px] font-extrabold ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
              {t.amount >= 0 ? "+" : ""}
              {t.amount}
            </p>
            <p className="text-[9px] text-gray-400">
              {t.date} {t.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function RatingTab() {
  const [items, setItems] = useState<LeadeboardItem[]>([])
  const [period, setPeriod] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .coinLeaderboard(period, 30)
      .then((d) => setItems(d.leaderboard))
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5">
        <button
          onClick={() => setPeriod("all")}
          className={`px-3 py-1.5 rounded-full text-[10px] font-semibold btn-hover ${
            period === "all" ? "bg-[#2001FF] text-white" : "bg-white text-gray-500 border border-gray-100"
          }`}
        >
          Umumiy
        </button>
        <button
          onClick={() => setPeriod("monthly")}
          className={`px-3 py-1.5 rounded-full text-[10px] font-semibold btn-hover ${
            period === "monthly" ? "bg-[#2001FF] text-white" : "bg-white text-gray-500 border border-gray-100"
          }`}
        >
          Shu oy
        </button>
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : (
        <div className="card-premium p-3">
          {items.map((l) => (
            <div key={l.student_id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
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
          {items.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center py-3">
              <Trophy size={18} className="mx-auto text-gray-300 mb-1" />
              Ma'lumot yo'q
            </p>
          )}
        </div>
      )}
    </div>
  )
}