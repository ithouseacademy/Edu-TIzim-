import { useEffect, useState } from "react"
import { History, Loader2, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "../../api"
import type { CoinTxItem } from "../../types"
import type { SectionProps } from "./props"

const PERIODS = [
  { key: "", label: "Hammasi" },
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "week", label: "Hafta" },
  { key: "month", label: "Oy" },
]

const TYPES = [
  { key: "", label: "Barcha turlar" },
  { key: "BONUS", label: "Bonus" },
  { key: "PENALTY", label: "Penalty" },
  { key: "ATTENDANCE", label: "Davomat" },
  { key: "SHOP", label: "Shop" },
  { key: "ADJUSTMENT", label: "Sozlash" },
]

const SOURCES = [
  { key: "", label: "Barcha manba" },
  { key: "teacher", label: "O'qituvchi" },
  { key: "administrator", label: "Administrator" },
  { key: "system", label: "Tizim" },
]

export default function CoinTransactions(_props: SectionProps) {
  const [period, setPeriod] = useState("")
  const [type, setType] = useState("")
  const [source, setSource] = useState("")
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<CoinTxItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)

  const limit = 80

  const load = (off: number) => {
    setLoading(true)
    api
      .coinTransactions({
        period,
        type,
        source,
        search,
        limit,
        offset: off,
      })
      .then((d) => {
        setItems(d.transactions)
        setTotal(d.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(0)
    setOffset(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, type, source])

  const applySearch = () => {
    load(0)
    setOffset(0)
  }

  const pages = Math.ceil(total / limit)
  const page = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-3 animate-page-enter">
      {/* Filtr tugmasi */}
      <button
        onClick={() => setShowFilter(!showFilter)}
        className="w-full card-premium p-3 flex items-center justify-between btn-hover"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold text-gray-700">
          <Filter size={14} className="text-[#2001FF]" />
          Filtrlar
        </span>
        <span className="text-[10px] font-semibold text-gray-400">
          {total} ta tranzaksiya
        </span>
      </button>

      {showFilter && (
        <div className="card-premium p-3 space-y-2.5 animate-page-enter">
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors btn-hover ${
                  period === p.key ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors btn-hover ${
                  type === t.key ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors btn-hover ${
                  source === s.key ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="O'quvchi qidirish..."
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-100 text-[11px] outline-none"
            />
            <button onClick={applySearch} className="px-3 py-2 rounded-lg bg-[#2001FF] text-white text-[11px] font-semibold btn-hover">
              Qidirish
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <History size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-[12px] font-semibold text-gray-500">Tranzaksiyalar yo'q</p>
        </div>
      ) : (
        <div className="card-premium divide-y divide-gray-50">
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-gray-900 truncate">
                  {t.student_name || t.created_by || "—"}
                </p>
                <p className="text-[9px] text-gray-400 truncate">
                  {t.reason_name || t.transaction_type_display}
                  {t.group_name ? ` · ${t.group_name}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-[12px] font-extrabold ${
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
                <p className="text-[9px] text-gray-400">
                  {t.date} {t.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button
            disabled={page <= 1}
            onClick={() => {
              const o = offset - limit
              setOffset(o)
              load(o)
            }}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gray-100 disabled:opacity-30 btn-hover"
          >
            <ChevronLeft size={14} className="text-gray-600" />
          </button>
          <span className="text-[11px] font-bold text-gray-600">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => {
              const o = offset + limit
              setOffset(o)
              load(o)
            }}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gray-100 disabled:opacity-30 btn-hover"
          >
            <ChevronRight size={14} className="text-gray-600" />
          </button>
        </div>
      )}
    </div>
  )
}