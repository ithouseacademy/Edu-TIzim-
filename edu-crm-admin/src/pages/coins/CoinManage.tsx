import { useEffect, useState } from "react"
import { Plus, Loader2, Save, Settings, Tag, UserCog, TrendingUp, TrendingDown, Eye } from "lucide-react"
import { api } from "../../api"
import type { CoinReasonItem, CoinSettings, CoinTeacherLimit } from "../../types"
import type { SectionProps } from "./props"

type Tab = "reasons" | "settings" | "teachers"

export default function CoinManage({ isSuper, has }: SectionProps) {
  const [tab, setTab] = useState<Tab>("reasons")
  const canManageReasons = isSuper || has("coin.manage_reasons")
  const canSettings = isSuper || has("coin.settings")
  const canTeachers = isSuper || has("coin.manage_teacher")

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "reasons", label: "Sabablar", show: canManageReasons },
    { key: "settings", label: "Sozlamalar", show: canSettings },
    { key: "teachers", label: "O'qituvchilar", show: canTeachers },
  ]
  const visible = tabs.filter((t) => t.show)
  const activeVisible = visible.some((t) => t.key === tab) ? tab : visible[0]?.key ?? "reasons"

  return (
    <div className="space-y-3 animate-page-enter">
      <div className="flex gap-1.5">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-full text-[11px] font-semibold transition-colors btn-hover ${
              activeVisible === t.key ? "bg-[#2001FF] text-white" : "bg-white text-gray-500 border border-gray-100"
            }`}
          >
            {t.label === "Sabablar" ? "Sabablar" : t.label === "Sozlamalar" ? "Sozlamalar" : "O'qituvchilar"}
          </button>
        ))}
      </div>
      {activeVisible === "reasons" && canManageReasons && <ReasonsSection />}
      {activeVisible === "settings" && canSettings && <SettingsSection isSuper={isSuper} />}
      {activeVisible === "teachers" && canTeachers && <TeachersSection />}
    </div>
  )
}

function ReasonsSection() {
  const [reasons, setReasons] = useState<CoinReasonItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [rtype, setRtype] = useState("BONUS")
  const [amount, setAmount] = useState("5")
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api
      .coinReasons(showAll)
      .then((d) => setReasons(d.reasons))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll])

  const add = async () => {
    setSaving(true)
    try {
      await api.createCoinReason({ name, reason_type: rtype, amount: Number(amount) || 0 })
      setName("")
      setShowForm(false)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (id: number, active: boolean) => {
    try {
      await api.toggleCoinReason(id, active)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik")
    }
  }

  return (
    <div className="space-y-3">
      <div className="card-premium p-3 flex items-center justify-between">
        <p className="text-[12px] font-bold text-gray-900">
          <Tag size={13} className="inline mr-1.5 text-[#2001FF]" />
          Coin sabablari
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-semibold btn-hover ${
              showAll ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
            }`}
          >
            <Eye size={11} /> Barchasi
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 text-white text-[10px] font-semibold btn-hover"
          >
            <Plus size={11} /> Yangi
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card-premium p-3.5 space-y-2.5 animate-page-enter">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRtype("BONUS")}
              className={`py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 btn-hover ${
                rtype === "BONUS" ? "bg-green-600 text-white" : "bg-green-50 text-green-600"
              }`}
            >
              <TrendingUp size={13} /> Bonus
            </button>
            <button
              onClick={() => setRtype("PENALTY")}
              className={`py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 btn-hover ${
                rtype === "PENALTY" ? "bg-red-500 text-white" : "bg-red-50 text-red-500"
              }`}
            >
              <TrendingDown size={13} /> Penalty
            </button>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sabab nomi (masalan: Aktivlik uchun)"
            className="w-full px-3 py-2.5 rounded-lg bg-[#F4F5FA] text-[12px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30"
          />
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              type="number"
              min="1"
              placeholder="Coin miqdori"
              className="flex-1 px-3 py-2.5 rounded-lg bg-[#F4F5FA] text-[12px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30"
            />
            <button
              onClick={add}
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#2001FF] text-white text-[12px] font-bold btn-hover disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : "Qo'shish"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {reasons.map((r) => (
            <div key={r.id} className="card-premium p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-gray-900 truncate">{r.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      r.reason_type === "BONUS" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                    }`}
                  >
                    {r.reason_type}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold ${
                      r.reason_type === "BONUS" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {r.amount >= 0 ? "+" : ""}
                    {r.amount}
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggle(r.id, !r.is_active)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  r.is_active ? "bg-[#2001FF]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    r.is_active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsSection({ isSuper }: { isSuper: boolean }) {
  const [s, setS] = useState<CoinSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    api.coinSettings().then((d) => setS(d.settings)).catch(() => {})
  }, [])

  const num = (v: string) => {
    const n = Number(v) || 0
    return n
  }

  const save = async () => {
    if (!s) return
    setSaving(true)
    setMsg("")
    try {
      const d = await api.updateCoinSettings(s)
      setS(d.settings)
      setMsg("✅ Saqlandi")
      setTimeout(() => setMsg(""), 2500)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Xatolik")
    } finally {
      setSaving(false)
    }
  }

  if (!s) {
    return (
      <div className="card-premium p-8 flex items-center justify-center">
        <Loader2 size={20} className="text-[#2001FF] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="card-premium p-3.5">
        <p className="text-[12px] font-bold text-gray-900 mb-3">
          <Settings size={13} className="inline mr-1.5 text-[#2001FF]" />
          Davomat coin miqdori
        </p>
        {[
          { key: "attendance_present_amount" as const, label: "Keldi", cls: "text-green-600", enabled: "attendance_present_enabled" as const },
          { key: "attendance_absent_amount" as const, label: "Kelmadi", cls: "text-red-500", enabled: "attendance_absent_enabled" as const },
          { key: "attendance_excused_amount" as const, label: "Sababli", cls: "text-amber-500", enabled: "attendance_excused_enabled" as const },
        ].map((row) => (
          <div key={row.key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <div>
              <p className={`text-[12px] font-bold ${row.cls}`}>{row.label}</p>
              <p className="text-[9px] text-gray-400">{row.enabled === "attendance_excused_enabled" ? "Default: 0" : "Auto"}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="number"
                value={s[row.key]}
                onChange={(e) => setS({ ...s, [row.key]: num(e.target.value) })}
                className="w-16 px-2 py-1.5 rounded-lg bg-[#F4F5FA] text-[12px] font-bold text-center outline-none focus:ring-2 ring-[#2001FF]/30"
              />
              <button
                onClick={() => setS({ ...s, [row.enabled]: !s[row.enabled] })}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  s[row.enabled] ? "bg-[#2001FF]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    s[row.enabled] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card-premium p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-gray-900">O'qituvchi kunlik limiti</p>
            <p className="text-[9px] text-gray-400">Barcha o'qituvchilar uchun umumiy</p>
          </div>
          <input
            type="number"
            value={s.teacher_daily_limit ?? ""}
            onChange={(e) => setS({ ...s, teacher_daily_limit: e.target.value === "" ? null : num(e.target.value) })}
            className="w-20 px-2 py-1.5 rounded-lg bg-[#F4F5FA] text-[12px] font-bold text-center outline-none focus:ring-2 ring-[#2001FF]/30"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-gray-900">Leaderboard</p>
            <p className="text-[9px] text-gray-400">O'quvchilar reytingi</p>
          </div>
          <button
            onClick={() => setS({ ...s, leaderboard_enabled: !s.leaderboard_enabled })}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
              s.leaderboard_enabled ? "bg-[#2001FF]" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                s.leaderboard_enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-gray-900">Shop</p>
            <p className="text-[9px] text-gray-400">O'quvchilar do'kondan xarid qila oladi</p>
          </div>
          <button
            onClick={() => setS({ ...s, shop_enabled: !s.shop_enabled })}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
              s.shop_enabled ? "bg-[#2001FF]" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                s.shop_enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {msg && <p className="text-center text-[11px] font-bold text-green-600">{msg}</p>}
      <button
        onClick={save}
        disabled={saving || !isSuper}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#2001FF] text-white text-[13px] font-bold btn-hover disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Saqlash
      </button>
      {!isSuper && (
        <p className="text-center text-[10px] font-medium text-gray-400">
          Sozlamalarni faqat Super Admin saqlay oladi
        </p>
      )}
    </div>
  )
}

function TeachersSection() {
  const [limits, setLimits] = useState<CoinTeacherLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    api.teacherLimits().then((d) => setLimits(d.limits)).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (l: CoinTeacherLimit) => {
    setSavingId(l.employee_id)
    try {
      const raw = (editing[l.employee_id] ?? "").trim()
      await api.setTeacherLimit(l.employee_id, {
        daily_limit: raw === "" || raw === "null" ? null : Number(raw) || null,
        is_enabled: l.is_enabled,
      })
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik")
    } finally {
      setSavingId(null)
    }
  }

  const toggle = async (l: CoinTeacherLimit) => {
    await api.setTeacherLimit(l.employee_id, { daily_limit: l.daily_limit, is_enabled: !l.is_enabled })
    load()
  }

  return (
    <div className="space-y-2">
      <div className="card-premium p-3">
        <p className="text-[12px] font-bold text-gray-900">
          <UserCog size={13} className="inline mr-1.5 text-[#2001FF]" />
          O'qituvchi limitlari
        </p>
        <p className="text-[9px] text-gray-400 mt-0.5">Bo'sh = umumiy limit ishlatiladi</p>
      </div>
      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : (
        limits.map((l) => (
          <div key={l.employee_id} className="card-premium p-3.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-gray-900 truncate">{l.teacher_name}</p>
              <p className="text-[9px] text-gray-400">
                {l.is_enabled ? `Limit: ${l.daily_limit ?? "umumiy"}` : "Limit o'chirilgan (cheksiz)"}
              </p>
            </div>
            <input
              type="number"
              value={editing[l.employee_id] ?? (l.daily_limit ?? "")}
              onChange={(e) => setEditing({ ...editing, [l.employee_id]: e.target.value })}
              placeholder="Coin"
              className="w-16 px-2 py-1.5 rounded-lg bg-[#F4F5FA] text-[12px] font-bold text-center outline-none focus:ring-2 ring-[#2001FF]/30"
            />
            <button
              onClick={() => save(l)}
              disabled={savingId === l.employee_id}
              className="px-3 py-1.5 rounded-xl bg-[#2001FF] text-white text-[10px] font-bold btn-hover disabled:opacity-50"
            >
              {savingId === l.employee_id ? <Loader2 size={12} className="animate-spin" /> : "Saqlash"}
            </button>
            <button
              onClick={() => toggle(l)}
              className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 ${
                l.is_enabled ? "bg-[#2001FF]" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                  l.is_enabled ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))
      )}
    </div>
  )
}