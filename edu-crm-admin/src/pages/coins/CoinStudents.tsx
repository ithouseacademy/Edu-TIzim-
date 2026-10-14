import { useEffect, useState } from "react"
import { Search, Users, X, Gift, TrendingUp, TrendingDown, ChevronRight, Loader2 } from "lucide-react"
import { api } from "../../api"
import type { CoinReasonItem, CoinStudentDetail, CoinStudentRow } from "../../types"
import type { SectionProps } from "./props"

type GiveMode = "bonus" | "penalty"

export default function CoinStudents({ isAdmin, isSuper, has }: SectionProps) {
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<CoinStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CoinStudentDetail | null>(null)
  const [reasons, setReasons] = useState<CoinReasonItem[]>([])
  const [giveMode, setGiveMode] = useState<GiveMode | null>(null)
  const [tab, setTab] = useState<"all" | "bonus" | "penalty">("all")

  const penaltyAllowed = isSuper || isAdmin || has("coin.remove")
  const bonusAllowed = isSuper || isAdmin || has("coin.add")
  const canGive = bonusAllowed || penaltyAllowed

  useEffect(() => {
    api
      .coinStudents()
      .then((d) => setRows(d.students))
      .finally(() => setLoading(false))
    api.coinReasons().then((d) => setReasons(d.reasons)).catch(() => {})
  }, [])

  const onSearch = () => {
    setLoading(true)
    api
      .coinStudents(search)
      .then((d) => setRows(d.students))
      .finally(() => setLoading(false))
  }

  const openDetail = (id: number) => {
    setSelected(null)
    setGiveMode(null)
    api.coinStudentDetail(id).then((d) => setSelected(d)).catch(() => {})
  }

  const visible = tab === "all" ? rows : rows.filter((r) => (tab === "bonus" ? r.balance >= 0 : r.balance < 0))

  return (
    <div className="space-y-3 animate-page-enter">
      {/* Qidiruv */}
      <div className="card-premium p-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Ism, familiya yoki telefon..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[12px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30"
            />
          </div>
          <button
            onClick={onSearch}
            className="px-4 py-2.5 rounded-xl bg-[#2001FF] text-white text-[12px] font-semibold btn-hover"
          >
            Qidirish
          </button>
        </div>
      </div>

      {/* Bonus/Penalty filtri */}
      <div className="flex gap-1.5">
        {(["all", "bonus", "penalty"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-full text-[11px] font-semibold transition-colors duration-200 btn-hover ${
              tab === t ? "bg-[#2001FF] text-white" : "bg-white text-gray-500 border border-gray-100"
            }`}
          >
            {t === "all" ? "Hammasi" : t === "bonus" ? "Ijobiy" : "Manfiy"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <Users size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-[12px] font-semibold text-gray-500">O'quvchilar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.slice(0, 60).map((row) => (
            <button
              key={row.student_id}
              onClick={() => openDetail(row.student_id)}
              className="w-full card-premium p-3.5 flex items-center justify-between gap-2 text-left btn-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-gray-900 truncate">{row.student_name}</p>
                <p className="text-[10px] font-medium text-gray-400">{row.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-[14px] font-extrabold ${row.balance >= 0 ? "text-green-600" : "text-red-500"}`}
                >
                  {row.balance >= 0 ? "+" : ""}
                  {row.balance}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] font-semibold text-green-500">B{row.bonus}</span>
                  <span className="text-[9px] font-semibold text-red-400">P{row.penalty}</span>
                  <span className="text-[9px] font-semibold text-[#2001FF]">D{row.attendance}</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* O'quvchi detal oynasi */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5 animate-page-enter">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-extrabold text-gray-900">{selected.student.student_name}</h3>
                <p className="text-[10px] font-medium text-gray-400">{selected.student.phone}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center btn-hover"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-2xl bg-gradient-to-br from-[#2001FF] to-[#4361FF] p-3.5 text-white">
                <p className="text-[9px] font-semibold text-white/70">Balans</p>
                <p className="text-[20px] font-extrabold leading-none mt-1">
                  {selected.summary.balance >= 0 ? "+" : ""}
                  {selected.summary.balance}
                </p>
                <p className="text-[9px] font-medium text-white/60 mt-1">
                  Davomat {selected.summary.attendance} · Shop {selected.summary.shop}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-100 p-3.5">
                <p className="text-[9px] font-semibold text-gray-400">Bu oy</p>
                <div className="mt-1 space-y-0.5">
                  <p className="text-[11px] font-bold text-green-600">+{selected.summary.month_earned}</p>
                  <p className="text-[11px] font-bold text-amber-500">{selected.summary.month_spent}</p>
                </div>
              </div>
            </div>

            {canGive && (
              <GiveDialog
                studentId={selected.student.student_id}
                studentName={selected.student.student_name}
                reasons={reasons}
                bonusAllowed={bonusAllowed}
                penaltyAllowed={penaltyAllowed}
                mode={giveMode}
                setMode={setGiveMode}
                onDone={() => openDetail(selected.student.student_id)}
              />
            )}

            <p className="text-[11px] font-bold text-gray-500 mb-2">So'nggi amallar</p>
            {selected.transactions.length === 0 ? (
              <p className="text-[11px] font-medium text-gray-400 text-center py-4">Hozircha amallar yo'q</p>
            ) : (
              <div className="space-y-1.5">
                {selected.transactions.slice(0, 15).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 truncate">
                        {t.reason_name || t.transaction_type_display}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {t.date} {t.time} · {t.created_by || "System"}
                      </p>
                    </div>
                    <p
                      className={`text-[12px] font-extrabold shrink-0 ml-2 ${
                        t.transaction_type === "REVERSAL"
                          ? "text-amber-500"
                          : t.amount >= 0
                            ? "text-green-600"
                            : "text-red-500"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GiveDialog({
  studentId,
  studentName,
  reasons,
  bonusAllowed,
  penaltyAllowed,
  mode,
  setMode,
  onDone,
}: {
  studentId: number
  studentName: string
  reasons: CoinReasonItem[]
  bonusAllowed: boolean
  penaltyAllowed: boolean
  mode: GiveMode | null
  setMode: (m: GiveMode | null) => void
  onDone: () => void
}) {
  const [query, setQuery] = useState("")
  const [reasonId, setReasonId] = useState<number | null>(null)
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setReasonId(null)
    setQuery("")
    setDescription("")
    setError("")
  }, [mode])

  const list = mode
    ? reasons.filter((r) => r.is_active && r.reason_type === (mode === "bonus" ? "BONUS" : "PENALTY"))
    : []
  const filtered = list.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))

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
    <div className="rounded-2xl bg-[#F4F5FA] p-3.5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-extrabold text-gray-900">Coin berish — {studentName}</p>
        {mode && (
          <button
            onClick={() => setMode(null)}
            className="w-6 h-6 bg-white rounded-full flex items-center justify-center btn-hover"
          >
            <X size={12} className="text-gray-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          disabled={!bonusAllowed}
          onClick={() => setMode(mode === "bonus" ? null : "bonus")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold btn-hover disabled:opacity-40 ${
            mode === "bonus" ? "bg-green-600 text-white shadow-md shadow-green-600/20" : "bg-green-50 text-green-600"
          }`}
        >
          <TrendingUp size={13} /> Bonus
        </button>
        <button
          disabled={!penaltyAllowed}
          onClick={() => setMode(mode === "penalty" ? null : "penalty")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold btn-hover disabled:opacity-40 ${
            mode === "penalty" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-red-50 text-red-500"
          }`}
        >
          <TrendingDown size={13} /> Penalty
        </button>
      </div>

      {!mode && <p className="text-[10px] font-medium text-gray-400 text-center py-1">Bonus yoki Penalty tanlang</p>}

      {mode && (
        <>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sabab qidirish..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-white text-[11px] outline-none focus:ring-2 ring-[#2001FF]/30"
            />
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1.5 mb-3 no-scrollbar">
            {filtered.length === 0 && (
              <p className="text-[10px] text-gray-400 text-center py-2">
                {list.length === 0 ? `${mode === "bonus" ? "Bonus" : "Penalty"} sabablari yo'q` : "Mos sabab topilmadi"}
              </p>
            )}
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setReasonId(r.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all btn-hover ${
                  reasonId === r.id
                    ? mode === "bonus"
                      ? "bg-green-600 text-white"
                      : "bg-red-500 text-white"
                    : "bg-white border border-gray-100"
                }`}
              >
                <span className="truncate text-[11px] font-semibold">{r.name}</span>
                <span
                  className={`text-[12px] font-extrabold shrink-0 ${
                    mode === "bonus" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {mode === "bonus" ? "+" : ""}
                  {r.amount}
                </span>
              </button>
            ))}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Izoh (ixtiyoriy)"
            className="w-full px-3 py-2 rounded-lg bg-white text-[11px] outline-none focus:ring-2 ring-[#2001FF]/30 mb-2"
          />
          {error && <p className="text-[10px] font-semibold text-red-500 mb-2">{error}</p>}
          <button
            onClick={submit}
            disabled={saving || !reasonId}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#2001FF] text-white text-[12px] font-bold btn-hover disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
            Coin berish
          </button>
        </>
      )}
    </div>
  )
}