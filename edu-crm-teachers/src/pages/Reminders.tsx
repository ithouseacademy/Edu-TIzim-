import { useEffect, useState, useCallback } from "react"
import { api } from "../api"
import type { RemindersData } from "../types"

function fmtDateTime(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("ru-RU")
}

export default function Reminders({ onUnreadChange }: { onUnreadChange?: (unread: number) => void }) {
  const [data, setData] = useState<RemindersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reading, setReading] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    api.myReminders()
      .then((d) => {
        setData(d)
        onUnreadChange?.(d.unread)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [onUnreadChange])

  useEffect(() => {
    load()
  }, [load])

  const markRead = async (id: number) => {
    setReading(id)
    try {
      await api.markReminderRead(id)
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setReading(null)
    }
  }

  return (
    <div>
      {data && data.unread > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-[13px] font-semibold px-3 py-2 rounded-xl">
          <span role="img" aria-label="bell">🔔</span> Sizda {data.unread} ta o'qilmagan eslatma bor
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-gray-500">Yuklanmoqda...</div>
      ) : error ? (
        <div className="p-10 text-center text-red-500">{error}</div>
      ) : data && data.reminders.length === 0 ? (
        <div className="card-premium p-10 text-center text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p>Hozircha eslatmalar mavjud emas</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data?.reminders.map((r, idx) => (
            <div key={r.id} className={`card-premium p-4 animate-page-enter ${r.is_read ? "" : "border border-blue-200"}`} style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words min-w-0">{r.message}</p>
                {r.is_read ? (
                  <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap bg-green-50 text-green-700 border border-green-200">
                    O'qilgan
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200">
                    O'qilmagan
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="text-[11px] text-gray-500">
                  <span>📅 {fmtDateTime(r.created_at)}</span>
                  {r.created_by && <span> • {r.created_by}</span>}
                </div>
                {!r.is_read && (
                  <button
                    onClick={() => markRead(r.id)}
                    disabled={reading === r.id}
                    className="px-4 py-1.5 rounded-xl bg-[#2001FF] text-white text-[11px] font-semibold transition hover:bg-[#1800c9] disabled:opacity-60 border-none cursor-pointer active:scale-[0.98]"
                  >
                    {reading === r.id ? "Yuborilmoqda..." : "O'qidim"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}