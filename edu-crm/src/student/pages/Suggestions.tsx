import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"

const TABS: { value: "taklif" | "shikoyat"; label: string }[] = [
  { value: "taklif", label: "Takliflar" },
  { value: "shikoyat", label: "Shikoyat" },
]

const DESCRIPTION =
  "Sizning takliflaringiz va shikoyatlaringiz bevosita direktorga yuboriladi va hech qanday uchinchi tomon jalb qilinmaydi."

type Toast = { msg: string; type: "success" | "error" }

export default function Suggestions() {
  const navigate = useNavigate()
  const { tr } = useAppSettings()
  const [category, setCategory] = useState<"taklif" | "shikoyat">("taklif")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string, type: Toast["type"]) => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const submit = async () => {
    const text = message.trim()
    if (!text) {
      showToast(tr("Iltimos, xabar matnini yozing."), "error")
      return
    }
    if (text.length > 2000) {
      showToast(tr("Xabar juda uzun (maksimal 2000 belgi)."), "error")
      return
    }
    setSending(true)
    try {
      await api.createFeedback(category, text)
      showToast("Success", "success")
      setMessage("")
    } catch (e) {
      let msg = tr("Xatolik yuz berdi.")
      if (e && typeof e === "object" && "message" in e) {
        msg = String((e as { message?: unknown }).message) || msg
      }
      showToast(msg, "error")
    } finally {
      setSending(false)
    }
  }

  const title = category === "taklif" ? tr("Qanday takliflaringiz\nbor?") : tr("Qanday shikoyatingiz\nbor?")

  return (
    <div className="min-h-dvh bg-white flex flex-col animate-page-enter">
      {toast && (
        <div
          className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none px-6"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <div
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white text-[15px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.15)] animate-toast-drop ${
              toast.type === "success" ? "bg-[#10B981]" : "bg-[#EF4444]"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.msg}
          </div>
        </div>
      )}

      <div
        className="w-full max-w-lg mx-auto flex flex-col flex-1 px-5"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
        }}
      >
        <header className="flex items-center">
          <button
            onClick={() => navigate("/profile")}
            className="shrink-0 w-9 h-9 flex items-center justify-center btn-hover"
            aria-label={tr("Orqaga")}
          >
            <ArrowLeft size={22} className="text-black" strokeWidth={2} />
          </button>
          <h1 className="text-[15px] font-bold text-black tracking-tight">{tr("Takliflar va shikoyatlar")}</h1>
          <button
            onClick={() => navigate("/profile/feedback/history")}
            className="ml-auto text-[11px] font-medium text-gray-400 px-2 py-1 btn-hover"
          >
            {tr("Tarix")}
          </button>
        </header>

        <div className="mt-4 bg-[#F1F2F6] rounded-[22px] p-1 grid grid-cols-2">
          {TABS.map((tab) => {
            const active = category === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setCategory(tab.value)}
                className={`h-10 rounded-[18px] font-semibold text-[14px] transition-all duration-300 ${
                  active
                    ? "bg-white text-[#1677D2] shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
                    : "text-black"
                }`}
              >
                {tr(tab.label)}
              </button>
            )
          })}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-[22px] font-bold leading-[28px] text-black whitespace-pre-line">{title}</h2>
          <p className="mt-3 text-[14px] font-light leading-[22px] text-[#9A9A9A] max-w-[340px]">{DESCRIPTION}</p>
        </div>

        <div className="mt-6">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            placeholder={tr("Izoh")}
            className="w-full h-[130px] rounded-[20px] bg-[#F1F2F6] px-4 py-4 text-[15px] font-medium text-black placeholder:text-[#969696] resize-none focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] text-gray-400 font-medium">{message.length} / 2000</span>
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={submit}
          disabled={sending}
          className="w-full h-14 rounded-full bg-[#1677D2] text-white uppercase text-[16px] font-semibold tracking-[0.06em] flex items-center justify-center btn-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            tr("Yuborish")
          )}
        </button>
      </div>
    </div>
  )
}