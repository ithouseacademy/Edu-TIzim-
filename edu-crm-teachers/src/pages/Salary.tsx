import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "../api"
import type { SalaryData } from "../types"
import WaveHeader from "../components/WaveHeader"
import DesktopShell from "../components/DesktopShell"

const fmt = (n: number) => (n || 0).toLocaleString("ru-RU") + " so'm"

const MONTH_NAMES = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
const p2d = (n: number) => String(n).padStart(2, "0")

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BanknoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3zM12 14a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function MonthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function PickerCol({ items, selectedValue, onChange }: { items: { value: string | number; label: string }[]; selectedValue: string | number; onChange: (value: string | number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const ticking = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = items.findIndex(i => i.value === selectedValue)
    if (idx >= 0) {
      el.scrollTop = idx * 38 + 80 - el.clientHeight / 2 + 18
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const elCenter = el.getBoundingClientRect().top + el.clientHeight / 2
      let closest = 0, minDist = Infinity
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement
        const rect = child.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - elCenter)
        if (dist < minDist) { minDist = dist; closest = i }
      }
      const newVal = items[closest]?.value
      if (newVal !== undefined && newVal !== selectedValue) {
        onChange(newVal)
      }
      ticking.current = false
    })
  }, [items, selectedValue, onChange])

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto snap-y snap-mandatory py-16"
      style={{ scrollbarWidth: "none" }}
    >
      {items.map((item) => (
        <div
          key={String(item.value)}
          className={`h-[38px] flex items-center justify-center text-[17px] snap-center cursor-default ${item.value === selectedValue ? "text-gray-900 font-semibold text-[19px]" : "text-gray-400"}`}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}

export default function Salary({ onBack, onViewAllGroups, onViewTasks }: { onBack: () => void; onViewAllGroups?: () => void; onViewTasks?: () => void }) {
  const [data, setData] = useState<SalaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const curYear = new Date().getFullYear()
  const curMonth = new Date().getMonth() + 1
  const [selYear, setSelYear] = useState(curYear)
  const [selMonth, setSelMonth] = useState(curMonth)
  const [listTab, setListTab] = useState<"oylik" | "avans">("oylik")
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(curYear)
  const [pickerMonth, setPickerMonth] = useState(curMonth)

  useEffect(() => {
    api.mySalary()
      .then((res) => setData(res.salary))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-center text-gray-500">Yuklanmoqda...</div>
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>
  if (!data) return null

  const s = data

  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()

  const salaryHistory = s.salary_history || []
  const avansHistory = s.avans_history || []
  const monthlySummary = s.monthly_summary || []

  const years = Array.from(new Set([curYear, ...monthlySummary.map((m) => m.year)])).sort((a, b) => b - a)

  const isCur = selYear === curYear && selMonth === curMonth
  const mItem = monthlySummary.find((x) => x.year === selYear && x.month === selMonth)
  const statEarned = isCur ? s.month_earned : (mItem?.income ?? 0)
  const statReceived = isCur ? s.month_paid : (mItem?.received ?? 0)

  const mKey = `${p2d(selMonth)}.${selYear}`
  const monthSalary = salaryHistory.filter((t) => t.created_at.slice(3, 10) === mKey)
  const monthAvans = avansHistory.filter((t) => t.created_at.slice(3, 10) === mKey)

  const capMonth = MONTH_NAMES[selMonth - 1][0].toUpperCase() + MONTH_NAMES[selMonth - 1].slice(1)

  const yearItems = [...years].sort((a, b) => a - b).map((y) => ({ value: y, label: String(y) }))
  const monthItems = MONTH_NAMES.map((n, i) => ({ value: i + 1, label: n[0].toUpperCase() + n.slice(1) }))

  function openPicker() {
    setPickerYear(selYear)
    setPickerMonth(selMonth)
    setShowPicker(true)
  }

  function applyPicker() {
    setSelYear(pickerYear)
    setSelMonth(pickerMonth)
    setShowPicker(false)
  }

  return (
    <>
      <div className="md:hidden min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Mening oyligim"
        subtitle={s.salary_type === "percent" ? `Foiz asosida — ${s.percent}%` : "Oylik maosh asosida"}
        leftSlot={
          <button onClick={onBack} className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />

      <div className="max-w-lg mx-auto px-3">
        <div className="card-premium p-3 mt-3 mb-3 animate-page-enter">
          <div className="flex items-center gap-2.5">
            <button onClick={openPicker} className="flex-1 flex items-center justify-between gap-2 px-3.5 py-3 bg-[#F7F8FA] border border-gray-100 rounded-xl btn-hover active:scale-[0.98] cursor-pointer">
              <div className="text-left">
                <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Yil</span>
                <span className="block text-[15px] font-bold text-gray-900 mt-0.5">{selYear}</span>
              </div>
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={openPicker} className="flex-[1.5] flex items-center justify-between gap-2 px-3.5 py-3 bg-[#F7F8FA] border border-gray-100 rounded-xl btn-hover active:scale-[0.98] cursor-pointer">
              <div className="text-left">
                <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Oy</span>
                <span className="block text-[15px] font-bold text-gray-900 mt-0.5">{capMonth}</span>
              </div>
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="bg-[#2001FF] rounded-[14px] p-4 shadow-md shadow-[#2001FF]/20 animate-scale-in">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center mb-2.5">
              <WalletIcon className="w-4 h-4 text-white" />
            </div>
            <div className="text-[17px] font-bold leading-tight text-white">{fmt(s.balance)}</div>
            <div className="text-[10px] text-white/70 mt-0.5">Oylik (mavjud)</div>
          </div>
          <div className="bg-amber-50 rounded-[14px] p-4 border border-amber-200/70 animate-scale-in" style={{ animationDelay: "60ms" }}>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
              <BanknoteIcon className="w-4 h-4" />
            </div>
            <div className="text-[17px] font-bold leading-tight text-amber-800">{fmt(s.avans_balance || 0)}</div>
            <div className="text-[10px] text-amber-700 mt-0.5">Avans balansi</div>
          </div>
          <div className="card-premium p-4 animate-scale-in" style={{ animationDelay: "120ms" }}>
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-2.5">
              <CheckCircleIcon className="w-4 h-4" />
            </div>
            <div className="text-[17px] font-bold leading-tight text-gray-900">{fmt(statEarned)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{capMonth} oyi ishlangan</div>
          </div>
          <div className="card-premium p-4 animate-scale-in" style={{ animationDelay: "180ms" }}>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
              <HistoryIcon className="w-4 h-4" />
            </div>
            <div className="text-[17px] font-bold leading-tight text-gray-900">{fmt(statReceived)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{capMonth} oyi olingan</div>
          </div>
        </div>

        <div className="flex bg-white rounded-2xl p-1 shadow-premium-sm mb-4 animate-page-enter">
          <button
            onClick={() => setListTab("oylik")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.97] ${
              listTab === "oylik" ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/25" : "text-gray-500"
            }`}
          >
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Oylik
          </button>
          <button
            onClick={() => setListTab("avans")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.97] ${
              listTab === "avans" ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/25" : "text-gray-500"
            }`}
          >
            <BanknoteIcon className="w-3.5 h-3.5" />
            Avans
          </button>
        </div>

        {listTab === "oylik" ? (
          <div className="card-premium overflow-hidden animate-page-enter">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                Oylik olingan tarix
              </h3>
              <span className="text-xs text-gray-400">{capMonth} {selYear} · {monthSalary.length} ta</span>
            </div>
            {monthSalary.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {monthSalary.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-gray-900 truncate">{t.description || "Oylik berildi"}</div>
                      <div className="text-[11px] text-gray-400">
                        {t.created_at}
                        {t.payment_method ? ` · ${t.payment_method}` : ""}
                      </div>
                    </div>
                    <div className="text-[13px] font-bold text-green-600 whitespace-nowrap">+{fmt(t.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-gray-400">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-3">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
                <p className="text-[13px]">Bu oyda oylik olingan yo'q</p>
              </div>
            )}
          </div>
        ) : (
          <div className="card-premium overflow-hidden animate-page-enter">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BanknoteIcon className="w-4 h-4 text-amber-600" />
                Avans tarixi
              </h3>
              <span className="text-xs text-gray-400">{capMonth} {selYear} · {monthAvans.length} ta</span>
            </div>
            {monthAvans.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {monthAvans.map((t) => {
                  const isClose = t.transaction_type === "advance_close"
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isClose ? "bg-gray-50 text-gray-500" : "bg-amber-50 text-amber-600"
                      }`}>
                        <BanknoteIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-gray-900 truncate">{t.transaction_type_display}</div>
                        <div className="text-[11px] text-gray-400">{t.created_at}</div>
                        {t.description && <div className="text-[11px] text-gray-500 truncate mt-0.5">{t.description}</div>}
                      </div>
                      <div className={`text-[13px] font-bold whitespace-nowrap ${
                        isClose ? "text-gray-500" : "text-amber-600"
                      }`}>{isClose ? "" : "+"}{fmt(t.amount)}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-gray-400">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-3">
                  <BanknoteIcon className="w-5 h-5" />
                </div>
                <p className="text-[13px]">Bu oyda avans olingan yo'q</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showPicker && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={() => setShowPicker(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-[440px] bg-white rounded-2xl z-[110] shadow-2xl pb-5">
            <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-200">
              <button onClick={() => setShowPicker(false)} className="bg-none border-none text-sm text-gray-400 font-medium cursor-pointer">
                Bekor qilish
              </button>
              <span className="font-semibold text-base text-[#1a1a2e]">Oyni tanlang</span>
              <button onClick={applyPicker} className="bg-[#2001ff] border-none text-white text-sm font-semibold px-4 py-1.5 rounded-full cursor-pointer">
                Tanlash
              </button>
            </div>

            <div className="relative flex h-[220px] overflow-hidden px-2">
              <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-[38px] bg-indigo-50/50 rounded-xl pointer-events-none border border-indigo-100" />
              <div className="flex w-full gap-1">
                <PickerCol items={yearItems} selectedValue={pickerYear} onChange={(v) => setPickerYear(Number(v))} />
                <PickerCol items={monthItems} selectedValue={pickerMonth} onChange={(v) => setPickerMonth(Number(v))} />
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      <SalaryDesktop
        s={s}
        salaryHistory={salaryHistory}
        avansHistory={avansHistory}
        monthlySummary={monthlySummary}
        onBack={onBack}
        onViewAllGroups={onViewAllGroups}
        onViewTasks={onViewTasks}
      />
    </>
  )
}

function SalaryDesktop({ s, salaryHistory, avansHistory, monthlySummary, onBack, onViewAllGroups, onViewTasks }: {
  s: SalaryData
  salaryHistory: NonNullable<SalaryData["salary_history"]>
  avansHistory: NonNullable<SalaryData["avans_history"]>
  monthlySummary: NonNullable<SalaryData["monthly_summary"]>
  onBack: () => void
  onViewAllGroups?: () => void
  onViewTasks?: () => void
}) {
  const curYear = new Date().getFullYear()
  const curMonth = new Date().getMonth() + 1
  const [selYear, setSelYear] = useState(curYear)
  const [selMonth, setSelMonth] = useState(curMonth)
  const [listTab, setListTab] = useState<"oylik" | "avans">("oylik")

  const years = Array.from(new Set([curYear, ...monthlySummary.map((m) => m.year)])).sort((a, b) => b - a)

  const isCur = selYear === curYear && selMonth === curMonth
  const mItem = monthlySummary.find((x) => x.year === selYear && x.month === selMonth)
  const statEarned = isCur ? s.month_earned : (mItem?.income ?? 0)
  const statReceived = isCur ? s.month_paid : (mItem?.received ?? 0)

  const mKey = `${p2d(selMonth)}.${selYear}`
  const monthSalary = salaryHistory.filter((t) => t.created_at.slice(3, 10) === mKey)
  const monthAvans = avansHistory.filter((t) => t.created_at.slice(3, 10) === mKey)

  const selCap = MONTH_NAMES[selMonth - 1][0].toUpperCase() + MONTH_NAMES[selMonth - 1].slice(1)

  const th = "text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-gray-100 bg-slate-50"
  const td = "px-4 py-3 text-[13px]"

  return (
    <DesktopShell
      activeKey="salary"
      navItems={[
        { key: "dashboard", label: "Dashboard", icon: null, onClick: onBack },
        { key: "groups", label: "Mening guruhlarim", icon: null, onClick: onViewAllGroups || (() => (window.location.hash = "#my-groups")) },
        { key: "salary", label: "Mening oyligim", icon: null, onClick: () => {} },
        { key: "tasks", label: "Topshiriqlar", icon: null, onClick: onViewTasks || (() => (window.location.hash = "#tasks")) },
        { key: "profile", label: "Profil", icon: null, onClick: () => (window.location.hash = "#profile") },
      ]}
    >
          <main className="flex-1 pt-1 min-w-0">
            <div className="mb-6">
              <div className="text-[13px] font-medium text-slate-400 mb-1">
                O'qituvchi paneli
                <span className="mx-2 text-slate-300">/</span>
                <span className="text-slate-600">Mening oyligim</span>
              </div>
              <h1 className="text-[22px] font-bold text-slate-900 leading-tight">Mening oyligim</h1>
              <p className="text-sm text-slate-500 mt-1">
                {s.salary_type === "percent" ? `Foiz asosida — ${s.percent}%` : "Oylik maosh asosida"}
              </p>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <div className="rounded-2xl p-5 shadow-md shadow-[#2001FF]/20 bg-gradient-to-br from-[#3E37FF] via-[#2001FF] to-[#1B00E0] text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <WalletIcon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Mavjud</span>
                </div>
                <div className="text-[21px] font-bold leading-tight truncate">{fmt(s.balance)}</div>
                <div className="text-[11px] text-white/70 mt-1">Oylik balans</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <BanknoteIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Avans</span>
                </div>
                <div className="text-[21px] font-bold leading-tight text-gray-900 truncate">{fmt(s.avans_balance || 0)}</div>
                <div className="text-[11px] text-gray-400 mt-1">Avans balansi</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Ishlangan</span>
                </div>
                <div className="text-[21px] font-bold leading-tight text-gray-900 truncate">{fmt(statEarned)}</div>
                <div className="text-[11px] text-gray-400 mt-1">{selCap} oyi</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <HistoryIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Olingan</span>
                </div>
                <div className="text-[21px] font-bold leading-tight text-gray-900 truncate">{fmt(statReceived)}</div>
                <div className="text-[11px] text-gray-400 mt-1">{selCap} oyi</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm px-4 py-3.5 flex items-end gap-3 flex-wrap mb-6">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Yil</span>
                <select
                  value={selYear}
                  onChange={(e) => setSelYear(+e.target.value)}
                  className="mt-1.5 h-10 px-3 pr-9 text-[13.5px] font-semibold bg-[#f8fafc] border border-gray-200 rounded-lg outline-none text-gray-900 focus:border-[#2563eb] cursor-pointer"
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Oy</span>
                <select
                  value={selMonth}
                  onChange={(e) => setSelMonth(+e.target.value)}
                  className="mt-1.5 h-10 px-3 pr-9 text-[13.5px] font-semibold bg-[#f8fafc] border border-gray-200 rounded-lg outline-none text-gray-900 focus:border-[#2563eb] cursor-pointer"
                >
                  {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n[0].toUpperCase()}{n.slice(1)}</option>)}
                </select>
              </label>
              <div className="flex bg-gray-100 rounded-lg p-1 ml-auto">
                <button
                  onClick={() => setListTab("oylik")}
                  className={`px-5 py-2 rounded-md text-[13px] font-semibold border-none cursor-pointer transition-all ${
                    listTab === "oylik" ? "bg-white text-[#2563eb] shadow-sm" : "text-gray-500"
                  }`}
                >
                  Oyliklar
                </button>
                <button
                  onClick={() => setListTab("avans")}
                  className={`px-5 py-2 rounded-md text-[13px] font-semibold border-none cursor-pointer transition-all ${
                    listTab === "avans" ? "bg-white text-[#2563eb] shadow-sm" : "text-gray-500"
                  }`}
                >
                  Avanslar
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-[15px]">
                  {listTab === "oylik" ? (
                    <><span className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><CheckCircleIcon className="w-4 h-4" /></span> Oylik olingan tarix</>
                  ) : (
                    <><span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><BanknoteIcon className="w-4 h-4" /></span> Avans tarixi</>
                  )}
                </h2>
                <span className="text-xs font-medium bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                  {selCap} {selYear} · {(listTab === "oylik" ? monthSalary : monthAvans).length} ta
                </span>
              </div>
              {listTab === "oylik" ? (
                monthSalary.length > 0 ? (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-transparent">
                        <th className={th}>Sana</th>
                        <th className={th}>Izoh</th>
                        <th className={th}>To'lov usuli</th>
                        <th className={`${th} text-right`}>Summa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthSalary.map((t) => (
                        <tr key={t.id} className="hover:bg-indigo-50/40">
                          <td className={`${td} text-gray-500 whitespace-nowrap`}>{t.created_at}</td>
                          <td className={`${td} font-medium text-gray-900 max-w-[360px] truncate`}>{t.description || "Oylik berildi"}</td>
                          <td className={`${td} text-gray-500`}>
                            {t.payment_method ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600">{t.payment_method}</span>
                            ) : "—"}
                          </td>
                          <td className={`${td} text-right font-bold text-green-600 whitespace-nowrap`}>+{fmt(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-gray-400">
                    <CheckCircleIcon className="w-9 h-9 mx-auto mb-3 text-gray-300" />
                    <p className="text-[13px]">Bu oyda oylik olingan yo'q</p>
                  </div>
                )
              ) : (
                monthAvans.length > 0 ? (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-transparent">
                        <th className={th}>Tur</th>
                        <th className={th}>Sana</th>
                        <th className={th}>Izoh</th>
                        <th className={`${th} text-right`}>Summa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthAvans.map((t) => {
                        const isClose = t.transaction_type === "advance_close"
                        return (
                          <tr key={t.id} className="hover:bg-indigo-50/40">
                            <td className={td}>
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium ${isClose ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-700"}`}>
                                {t.transaction_type_display}
                              </span>
                            </td>
                            <td className={`${td} text-gray-500 whitespace-nowrap`}>{t.created_at}</td>
                            <td className={`${td} text-gray-600 max-w-[360px] truncate`}>{t.description || "—"}</td>
                            <td className={`${td} text-right font-bold whitespace-nowrap ${isClose ? "text-gray-500" : "text-amber-600"}`}>{isClose ? "" : "+"}{fmt(t.amount)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-gray-400">
                    <BanknoteIcon className="w-9 h-9 mx-auto mb-3 text-gray-300" />
                    <p className="text-[13px]">Bu oyda avans olingan yo'q</p>
                  </div>
                )
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-[15px]">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><MonthIcon className="w-4 h-4" /></span>
                  Oylar bo'yicha jadval
                </h2>
                <span className="text-xs font-medium bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{monthlySummary.length} oy</span>
              </div>
              {monthlySummary.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-transparent">
                      <th className={th}>Yil</th>
                      <th className={th}>Oy</th>
                      <th className={`${th} text-right`}>Ishlangan</th>
                      <th className={`${th} text-right`}>Olingan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthlySummary.map((m) => (
                      <tr key={`${m.year}-${m.month}`} className="hover:bg-indigo-50/40">
                        <td className={`${td} text-gray-500`}>{m.year}</td>
                        <td className={`${td} font-medium text-gray-900 capitalize`}>{m.month_display.split(" ")[0]}</td>
                        <td className={`${td} text-right text-gray-600`}>{fmt(m.income)}</td>
                        <td className={`${td} text-right font-bold text-[#2001ff]`}>{fmt(m.received)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-400">
                  <MonthIcon className="w-9 h-9 mx-auto mb-3 text-gray-300" />
                  <p className="text-[13px]">Ma'lumot yo'q</p>
                </div>
              )}
            </div>
          </main>
    </DesktopShell>
  )
}