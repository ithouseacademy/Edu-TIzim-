import { useState, useEffect, useRef } from "react"
import { KeyRound, Send, LogOut, User, Wallet, ChevronRight, Camera, Download, Users, Pencil } from "lucide-react"
import { api } from "../api"
import type { SalaryData, TeacherGroup } from "../types"
import WaveHeader from "../components/WaveHeader"
import DesktopShell from "../components/DesktopShell"

const TELEGRAM_BOT_URL = "https://t.me/ithousekuy_bot"

const TABS = [
  { key: "oylik", label: "Oylik tarixi" },
  { key: "avans", label: "Avans tarixi" },
  { key: "kpi", label: "KPI" },
  { key: "info", label: "Ma'lumotlar" },
  { key: "groups", label: "Guruhlar" },
]

interface ProfileProps {
  onNavigate: (page: string) => void
  onLogout: () => void
}

export default function Profile({ onNavigate, onLogout }: ProfileProps) {
  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()
  const fileRef = useRef<HTMLInputElement>(null)

  const [salary, setSalary] = useState<SalaryData | null>(null)
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [tab, setTab] = useState("oylik")
  const [grpQuery, setGrpQuery] = useState("")
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(emp.photo || null)

  useEffect(() => {
    api.mySalary()
      .then((d) => setSalary(d.salary))
      .catch(() => {})
    api.myGroups()
      .then((d) => setGroups(d.groups || []))
      .catch(() => {})
  }, [])

  const balance = salary ? salary.balance : (emp.teacher_balance ?? 0)
  const net = balance
  const isNegative = net < 0

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("ru-RU") : "0")
  const fmtDT = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const res = await api.uploadPhoto(file)
      setPhotoUrl(res.photo)
      const updatedEmp = { ...emp, photo: res.photo }
      localStorage.setItem("employee", JSON.stringify(updatedEmp))
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setPhotoUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const filteredGroups = groups.filter((g) => {
    const q = grpQuery.trim().toLowerCase()
    if (!q) return true
    return [g.name, g.course || "", g.room || ""].some((v) => v.toLowerCase().includes(q))
  })

  const gStatusCls = (g: TeacherGroup) =>
    g.status === "active" || g.status_display === "Faol"
      ? "bg-green-50 text-green-600"
      : g.status === "frozen"
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-100 text-slate-500"

  const amountCls = (n: number) => (n >= 0 ? "text-green-600" : "text-red-500")
  const sign = (n: number) => (n >= 0 ? "+" : "-")

  const PhotoAvatar = ({ size = "lg", className = "" }: { size?: "sm" | "lg"; className?: string }) => {
    const sz = size === "lg" ? "w-20 h-20" : "w-12 h-12"
    const txtSz = size === "lg" ? "text-2xl" : "text-lg"
    if (photoUrl) {
      return <img src={photoUrl} alt="" className={`${sz} rounded-full object-cover shrink-0 ${className}`} />
    }
    return (
      <div className={`${sz} bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-full flex items-center justify-center shadow-lg shadow-[#2001FF]/20 shrink-0 ${className}`}>
        <span className={`${txtSz} font-bold text-white`}>{initials || "A"}</span>
      </div>
    )
  }

  return (
    <>
    {/* ====== Mobile View ====== */}
    <div className="md:hidden min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
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
          <div className="card-premium p-4">
            <div className="flex items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                <PhotoAvatar size="lg" />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
                {photoUploading && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                  {emp.first_name || ""} {emp.last_name || ""}
                </p>
                <p className="text-[10px] font-medium text-gray-400 mt-px">{emp.phone || ""}</p>
                <p className="text-[10px] font-medium text-gray-400">{emp.position?.name || emp.role?.name || "O'qituvchi"}</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate("salary")}
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
            onClick={() => onNavigate("change-password")}
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
            onClick={onLogout}
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

    {/* ====== Desktop View ====== */}
    <div className="hidden md:block min-h-screen bg-[#f8fafc]">
      <DesktopShell
        activeKey="profile"
        navItems={[
          { key: "dashboard", label: "Dashboard", icon: null, onClick: () => (window.location.hash = "#dashboard") },
          { key: "groups", label: "Mening guruhlarim", icon: null, onClick: () => (window.location.hash = "#my-groups") },
          { key: "salary", label: "Mening oyligim", icon: null, onClick: () => onNavigate("salary") },
          { key: "tasks", label: "Topshiriqlar", icon: null, onClick: () => (window.location.hash = "#tasks") },
          { key: "profile", label: "Profil", icon: null, onClick: () => {} },
        ]}
        onLogout={onLogout}
      >
        <div className="flex gap-6 items-start">
          {/* ===== Inner sidebar ===== */}
          <aside className="w-[260px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="bg-gradient-to-br from-[#1e3a8a] via-[#2563eb] to-[#3b82f6] px-5 pt-8 pb-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full" />
              </div>
              <div className="relative">
                <div className="relative group cursor-pointer inline-block" onClick={() => fileRef.current?.click()}>
                  <PhotoAvatar size="lg" className="mx-auto ring-4 ring-white/20" />
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white" />
                  </div>
                  {photoUploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <p className="text-[15px] font-bold text-white mt-3 truncate">{emp.first_name || ""} {emp.last_name || ""}</p>
                <p className="text-[12px] font-medium text-white/75 mt-1 truncate">{emp.position?.name || emp.role?.name || "O'qituvchi"}</p>
                <p className="text-[12px] font-medium text-white/60 mt-0.5 truncate">{emp.phone || ""}</p>
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <button
                  onClick={() => onNavigate("change-password")}
                  title="Parolni o'zgartirish"
                  className="w-9 h-9 rounded-lg bg-[#eff6ff] text-[#2563eb] flex items-center justify-center hover:bg-[#dbeafe] transition-colors cursor-pointer"
                >
                  <KeyRound size={16} />
                </button>
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Telegram botga o'tish"
                  className="w-9 h-9 rounded-lg bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] transition-colors cursor-pointer"
                >
                  <Send size={16} />
                </a>
                <button
                  onClick={onLogout}
                  title="Chiqish"
                  className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Balans", value: `${salary ? fmt(salary.balance) : "0"} so'm`, color: salary && salary.balance < 0 ? "text-red-500" : "text-[#2563eb]" },
                  { label: "Avans", value: `${salary ? fmt(salary.avans_balance) : "0"} so'm`, color: "text-amber-500" },
                  { label: "Bugungi tushum", value: `${salary ? fmt(salary.today_income) : "0"} so'm`, color: "text-green-600" },
                  { label: "Ish haqi", value: salary && salary.salary != null ? `${fmt(salary.salary)} so'm` : "—", color: "text-slate-800" },
                ].map((r) => (
                  <div key={r.label} className="bg-slate-50/70 border border-gray-100 rounded-xl px-3.5 py-3 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-slate-500">{r.label}</span>
                    <span className={`text-[13px] font-bold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
                {salary && (
                  <div className="rounded-xl px-3.5 py-2.5 bg-[#eff6ff]/60 border border-[#dbeafe] flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-slate-500">Oylik turi</span>
                    <span className="text-[12px] font-bold text-[#2563eb]">{salary.salary_type_display}</span>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* ===== Main ===== */}
          <div className="flex-1 min-w-0">
            {/* Head */}
            <div className="flex items-end justify-between gap-4 mb-5">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-400">O'qituvchi paneli · Profil</p>
                <h2 className="text-[22px] font-bold text-slate-900 leading-tight mt-0.5">O'qituvchi profili</h2>
                <p className="text-[13px] font-medium text-slate-500 mt-1 truncate">
                  {emp.position?.name || emp.role?.name || "O'qituvchi"} · {emp.phone || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2.5 pb-1 shrink-0">
                <button
                  onClick={() => onNavigate("change-password")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                >
                  <KeyRound size={15} className="text-slate-400" />
                  Parol
                </button>
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563eb] text-white text-[13px] font-bold hover:bg-[#1d4ed8] transition-colors cursor-pointer no-underline"
                >
                  <Send size={15} />
                  Telegram
                </a>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-5 pb-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 px-4 py-2 rounded-lg border text-[12.5px] font-semibold transition-colors cursor-pointer ${
                    tab === t.key
                      ? "bg-[#2563eb] text-white border-[#2563eb] shadow-sm"
                      : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === "oylik" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2.5">
                  <span className="w-[3px] h-4 bg-[#2563eb] rounded-full" />
                  <span className="text-[14px] font-semibold text-slate-800">Oylik tarixi</span>
                  <span className="text-[12px] font-semibold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{(salary?.salary_history || []).length}</span>
                </div>
                {(salary?.salary_history || []).length === 0 ? (
                  <div className="p-14 text-center">
                    <Wallet size={26} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-[13px] font-medium text-gray-400">Oylik to'lovlar hali yo'q</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-50/60 text-left">
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Sana</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Tavsif</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To'lov usuli</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-right">Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(salary?.salary_history || []).map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5 text-[12.5px] font-medium text-slate-500 whitespace-nowrap">{fmtDT(h.created_at)}</td>
                            <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-700">{h.description || "Oylik ish haqi"}</td>
                            <td className="px-5 py-3.5"><span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">{h.payment_method}</span></td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-bold text-green-600 whitespace-nowrap">+{fmt(Math.abs(h.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "avans" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2.5">
                  <span className="w-[3px] h-4 bg-[#2563eb] rounded-full" />
                  <span className="text-[14px] font-semibold text-slate-800">Avans tarixi</span>
                  <span className="text-[12px] font-semibold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{(salary?.avans_history || []).length}</span>
                </div>
                {(salary?.avans_history || []).length === 0 ? (
                  <div className="p-14 text-center">
                    <Wallet size={26} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-[13px] font-medium text-gray-400">Avans tarixi bo'sh</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-50/60 text-left">
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Sana</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Tavsif</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To'lov usuli</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-right">Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(salary?.avans_history || []).map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5 text-[12.5px] font-medium text-slate-500 whitespace-nowrap">{fmtDT(h.created_at)}</td>
                            <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-700">{h.description || `${h.transaction_type_display || "Avans"}`}</td>
                            <td className="px-5 py-3.5"><span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">{h.payment_method}</span></td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-bold text-red-500 whitespace-nowrap">-{fmt(Math.abs(h.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "kpi" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { label: "Bugungi tushum", value: salary ? fmt(salary.today_income) : "0", color: "bg-green-500", text: "text-green-600" },
                  { label: "Shu oy ishlab topildi", value: salary ? fmt(salary.month_earned) : "0", color: "bg-[#2563eb]", text: "text-[#2563eb]" },
                  { label: "Shu oy to'landi", value: salary ? fmt(salary.month_paid) : "0", color: "bg-indigo-500", text: "text-indigo-600" },
                  { label: "Jami olingan", value: salary ? fmt(salary.paid_total) : "0", color: "bg-violet-500", text: "text-violet-600" },
                  { label: "Avans qarzi", value: salary ? fmt(salary.avans_balance) : "0", color: "bg-amber-500", text: "text-amber-500" },
                  { label: "Balans", value: salary ? fmt(salary.balance) : "0", color: salary && salary.balance < 0 ? "bg-red-500" : "bg-cyan-500", text: salary && salary.balance < 0 ? "text-red-500" : "text-cyan-600" },
                  { label: "Kutilayotgan", value: salary ? fmt(salary.pending_amount) : "0", color: "bg-pink-500", text: "text-pink-500" },
                  { label: "Foiz", value: salary ? `${fmt(salary.percent)}%` : "—", color: "bg-slate-500", text: "text-slate-700" },
                ].map((c) => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-10 rounded-full ${c.color} shrink-0`} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-slate-400 truncate">{c.label}</p>
                        <p className={`text-[19px] font-bold mt-0.5 ${c.text}`}>{c.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "info" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2.5">
                  <span className="w-[3px] h-4 bg-[#2563eb] rounded-full" />
                  <span className="text-[14px] font-semibold text-slate-800">Umumiy ma'lumot</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: "Telefon", value: emp.phone || "—" },
                    { label: "Lavozim", value: emp.position?.name || emp.role?.name || "O'qituvchi" },
                    { label: "Rol", value: emp.role?.name || "—" },
                    { label: "Oylik turi", value: salary?.salary_type_display || "—" },
                    { label: "Foiz", value: salary ? `${fmt(salary.percent)}%` : "—" },
                    { label: "Balans", value: salary ? `${fmt(salary.balance)} so'm` : "—" },
                    { label: "Avans", value: salary ? `${fmt(salary.avans_balance)} so'm` : "—" },
                  ].map((r) => (
                    <div key={r.label} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <span className="text-[13px] font-medium text-slate-500">{r.label}</span>
                      <span className="text-[13px] font-semibold text-slate-800 text-right">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "groups" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0"><Users size={15} /></span>
                    <span className="text-[14px] font-semibold text-slate-800">Guruhlarim</span>
                    <span className="text-[12px] font-semibold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{filteredGroups.length}/{groups.length}</span>
                  </div>
                  <div className="relative w-[220px] shrink-0">
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={grpQuery}
                      onChange={(e) => setGrpQuery(e.target.value)}
                      placeholder="Guruh qidirish..."
                      className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-[13px] bg-[#f8fafc] outline-none focus:border-[#2563eb] focus:bg-white focus:ring-[3px] focus:ring-[#2563eb]/10"
                    />
                  </div>
                </div>
                {filteredGroups.length === 0 ? (
                  <div className="p-14 text-center">
                    <Users size={26} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-[13px] font-medium text-gray-400">{groups.length === 0 ? "Guruhlar yo'q" : "Hech narsa topilmadi"}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-50/60 text-left">
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Guruh</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Kurs</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Xona</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Kun / Vaqt</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Holat</th>
                          <th className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-right">O'quvchi</th>
                          <th className="px-5 py-3 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredGroups.map((g) => (
                          <tr
                            key={g.id}
                            onClick={() => (window.location.hash = `#group-detail/${g.id}`)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          >
                            <td className="px-5 py-3.5 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-[12px] font-bold shrink-0">
                                {(g.name || "G")[0]}
                              </div>
                              <span className="text-[13px] font-semibold text-slate-700 truncate max-w-[180px]">{g.name}</span>
                            </td>
                            <td className="px-5 py-3.5 text-[12.5px] font-medium text-slate-500">{g.course || "—"}</td>
                            <td className="px-5 py-3.5 text-[12.5px] font-medium text-slate-500">{g.room || "—"}</td>
                            <td className="px-5 py-3.5 text-[12.5px] font-medium text-slate-500 max-w-[200px]">
                              <span className="block truncate">
                                {(g.lesson_times || []).map((lt) => `${lt.days} · ${lt.start_time}-${lt.end_time}`).join(", ") || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${gStatusCls(g)}`}>
                                {g.status_display || g.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-bold text-slate-700">{g.student_count}</td>
                            <td className="px-3 py-3.5 text-slate-300 font-bold">›</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DesktopShell>
    </div>
    </>
  )
}
