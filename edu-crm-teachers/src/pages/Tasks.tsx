import { useEffect, useState, useCallback } from "react"
import { api } from "../api"
import type { TasksData } from "../types"
import Reminders from "./Reminders"
import WaveHeader from "../components/WaveHeader"
import DesktopShell from "../components/DesktopShell"

type Section = "tasks" | "reminders"

const STATUS_STYLES: Record<string, string> = {
  yangi: "bg-green-50 text-green-700 border-green-200",
  jarayonda: "bg-blue-50 text-blue-700 border-blue-200",
  bajarildi: "bg-purple-50 text-purple-700 border-purple-200",
  bajarilmadi: "bg-orange-50 text-orange-700 border-orange-200",
  bekor_qilindi: "bg-red-50 text-red-600 border-red-200",
}

const TABS = [
  { value: "", label: "Barchasi", key: "all" as const },
  { value: "yangi", label: "Yangi", key: "yangi" as const },
  { value: "jarayonda", label: "Jarayonda", key: "jarayonda" as const },
  { value: "bajarildi", label: "Bajarildi", key: "bajarildi" as const },
  { value: "bajarilmadi", label: "Bajarilmadi", key: "bajarilmadi" as const },
]

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("ru-RU")
}

export default function Tasks({ onBack, onNotify, notifCount }: { onBack: () => void; onNotify?: () => void; notifCount?: number }) {
  const [section, setSection] = useState<Section>("tasks")
  const [data, setData] = useState<TasksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState("")
  const [updating, setUpdating] = useState<number | null>(null)
  const [unreadRem, setUnreadRem] = useState(0)

  const load = useCallback((status: string) => {
    setLoading(true)
    setError("")
    api.myTasks(status)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(tab)
  }, [load, tab])

  useEffect(() => {
    api.notifications().then((d) => {
      setUnreadRem(d.unread_reminders)
      onNotify?.()
    }).catch(() => {})
  }, [])

  const changeStatus = async (taskId: number, status: string) => {
    setUpdating(taskId)
    try {
      await api.updateTaskStatus(taskId, status)
      load(tab === "" ? "" : tab)
      onNotify?.()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  const handleUnreadChange = useCallback((n: number) => {
    setUnreadRem(n)
    onNotify?.()
  }, [onNotify])

  const counts = data?.counts
  const canAct = (status: string) => status !== "bajarildi" && status !== "bekor_qilindi"

  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()

  return (
    <>
    {/* ====== Mobile View ====== */}
    <div className="md:hidden min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Topshiriqlar"
        subtitle="Sizga biriktirilgan topshiriqlar va eslatmalar"
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
        <div className="flex gap-2 mt-3 mb-4">
          <button
            onClick={() => setSection("tasks")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition border-none cursor-pointer ${
              section === "tasks" ? "bg-[#2001FF] text-white shadow-sm shadow-[#2001FF]/15" : "card-premium text-gray-600"
            }`}
          >
            <span role="img" aria-label="clipboard">📋</span> Topshiriqlar
          </button>
          <button
            onClick={() => setSection("reminders")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition border-none cursor-pointer ${
              section === "reminders" ? "bg-[#2001FF] text-white shadow-sm shadow-[#2001FF]/15" : "card-premium text-gray-600"
            }`}
          >
            <span role="img" aria-label="bell">🔔</span> Eslatmalar
            {unreadRem > 0 && (
              <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                {unreadRem}
              </span>
            )}
          </button>
        </div>

        {section === "reminders" ? (
          <Reminders onUnreadChange={handleUnreadChange} />
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mb-4">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-semibold transition border-none cursor-pointer ${
                    tab === t.value ? "bg-[#2001FF] text-white shadow-sm shadow-[#2001FF]/15" : "card-premium text-gray-600"
                  }`}
                >
                  {t.label} <span className={`${tab === t.value ? "text-white/80" : "text-gray-400"} text-[10px]`}>{counts?.[t.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="p-10 text-center text-gray-500">Yuklanmoqda...</div>
            ) : error ? (
              <div className="p-10 text-center text-red-500">{error}</div>
            ) : data && data.tasks.length === 0 ? (
              <div className="card-premium p-10 text-center text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p>Hozircha topshiriqlar mavjud emas</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data?.tasks.map((t, idx) => (
                  <div key={t.id} className="card-premium p-4 animate-page-enter" style={{ animationDelay: `${idx * 40}ms` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-[14px] text-gray-900 break-words">{t.title}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-gray-500">
                          <span>{fmtDate(t.deadline)}</span>
                          {t.created_by && <span>• {t.created_by}</span>}
                          <span>• {fmtDate(t.created_at)}</span>
                        </div>
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap border ${STATUS_STYLES[t.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {t.status_display}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-[13px] text-gray-600 mt-2.5 whitespace-pre-wrap break-words">{t.description}</p>
                    )}
                    {t.reminder && (
                      <p className="text-[13px] mt-2 whitespace-pre-wrap break-words bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
                        <span role="img" aria-label="bell">🔔</span> Eslatma: {t.reminder}
                      </p>
                    )}
                    {canAct(t.status) && (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {t.status !== "bajarilmadi" && (
                          <button
                            onClick={() => changeStatus(t.id, "bajarildi")}
                            disabled={updating === t.id}
                            className="px-4 py-2 rounded-xl bg-[#2001FF] text-white text-[12px] font-semibold transition hover:bg-[#1800c9] disabled:opacity-60 border-none cursor-pointer active:scale-[0.98]"
                          >
                            {updating === t.id ? "Yuborilmoqda..." : "Bajarildi"}
                          </button>
                        )}
                        {t.status === "yangi" || t.status === "jarayonda" ? (
                          <button
                            onClick={() => changeStatus(t.id, "bajarilmadi")}
                            disabled={updating === t.id}
                            className="px-4 py-2 rounded-xl bg-white border border-red-300 text-red-600 text-[12px] font-semibold transition hover:bg-red-50 disabled:opacity-60 cursor-pointer active:scale-[0.98]"
                          >
                            {updating === t.id ? "Yuborilmoqda..." : "Bajarilmadi"}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* ====== Desktop View ====== */}
    <div className="hidden md:block min-h-screen bg-[#f8fafc]">
      <DesktopShell
        activeKey="tasks"
        navItems={[
          { key: "dashboard", label: "Dashboard", icon: null, onClick: onBack },
          { key: "groups", label: "Mening guruhlarim", icon: null, onClick: onBack },
          { key: "salary", label: "Mening oyligim", icon: null, onClick: () => (window.location.hash = "#salary") },
          {
            key: "tasks",
            label: "Topshiriqlar",
            icon: null,
            onClick: () => {},
            badge: notifCount !== undefined && notifCount > 0 ? (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ml-2">
                {notifCount}
              </span>
            ) : undefined,
          },
          { key: "profile", label: "Profil", icon: null, onClick: () => (window.location.hash = "#profile") },
        ]}
        onLogout={() => { localStorage.clear(); window.location.href = "/" }}
      >
        <div className="mb-2">
          <p className="text-sm text-gray-500">Topshiriqlar · O'qituvchi paneli</p>
        </div>

        <div className="flex gap-3 mt-6 mb-5">
          <button
            onClick={() => setSection("tasks")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition border-none cursor-pointer ${
              section === "tasks" ? "bg-[#2001FF] text-white shadow-sm shadow-[#2001FF]/15" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            <span role="img" aria-label="clipboard">📋</span> Topshiriqlar
          </button>
          <button
            onClick={() => setSection("reminders")}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition border-none cursor-pointer ${
              section === "reminders" ? "bg-[#2001FF] text-white shadow-sm shadow-[#2001FF]/15" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            <span role="img" aria-label="bell">🔔</span> Eslatmalar
            {unreadRem > 0 && (
              <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                {unreadRem}
              </span>
            )}
          </button>
        </div>

        {section === "reminders" ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-5">
            <Reminders onUnreadChange={handleUnreadChange} />
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mb-4">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition border-none cursor-pointer ${
                    tab === t.value ? "bg-[#2001FF] text-white shadow-sm shadow-[#2001FF]/15" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {t.label} <span className={`${tab === t.value ? "text-white/80" : "text-gray-400"} text-xs`}>{counts?.[t.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="p-10 text-center text-gray-500">Yuklanmoqda...</div>
            ) : error ? (
              <div className="p-10 text-center text-red-500">{error}</div>
            ) : data && data.tasks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-10 text-center text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p>Hozircha topshiriqlar mavjud emas</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Topshiriq</th>
                      <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Muddat</th>
                      <th className="text-left px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Holat</th>
                      <th className="text-right px-[18px] py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 align-top">
                        <td className="px-[18px] py-3.5 border-b border-gray-200">
                          <div className="font-semibold text-sm text-gray-900 break-words">{t.title}</div>
                          {t.description && <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap break-words">{t.description}</div>}
                          {t.reminder && (
                            <div className="mt-1 text-xs text-amber-700 whitespace-pre-wrap break-words"><span role="img" aria-label="bell">🔔</span> Eslatma: {t.reminder}</div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-1.5">{t.created_by ? `Yaratdi: ${t.created_by}` : ""} · {fmtDate(t.created_at)}</div>
                        </td>
                        <td className="px-[18px] py-3.5 border-b border-gray-200 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.deadline)}</td>
                        <td className="px-[18px] py-3.5 border-b border-gray-200">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border ${STATUS_STYLES[t.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {t.status_display}
                          </span>
                        </td>
                        <td className="px-[18px] py-3.5 border-b border-gray-200 text-right whitespace-nowrap">
                          {canAct(t.status) && (
                            <div className="flex justify-end gap-2">
                              {t.status !== "bajarilmadi" && (
                                <button
                                  onClick={() => changeStatus(t.id, "bajarildi")}
                                  disabled={updating === t.id}
                                  className="px-4 py-2 rounded-lg bg-[#2001FF] text-white text-xs font-semibold transition hover:bg-[#1800c9] disabled:opacity-60 border-none cursor-pointer"
                                >
                                  {updating === t.id ? "..." : "Bajarildi"}
                                </button>
                              )}
                              {t.status === "yangi" || t.status === "jarayonda" ? (
                                <button
                                  onClick={() => changeStatus(t.id, "bajarilmadi")}
                                  disabled={updating === t.id}
                                  className="px-4 py-2 rounded-lg bg-white border border-red-300 text-red-600 text-xs font-semibold transition hover:bg-red-50 disabled:opacity-60 cursor-pointer"
                                >
                                  {updating === t.id ? "..." : "Bajarilmadi"}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DesktopShell>
    </div>
    </>
  )
}