import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { api } from "../api"

const CODE_EXPIRY = 300

export default function VerifyCode() {
  const navigate = useNavigate()
  const location = useLocation()
  const { phone, telegram_connected } = location.state || {}
  const [digits, setDigits] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [timeLeft, setTimeLeft] = useState(CODE_EXPIRY)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!phone) navigate("/")
  }, [phone, navigate])

  useEffect(() => {
    inputRefs.current[0]?.focus()
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatPhone = (p: string) => {
    const d = p.replace(/\D/g, "")
    if (d.length < 12) return p
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value.slice(-1)
    setDigits(newDigits)
    setError("")

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newDigits.every((d) => d !== "")) {
      verifyCode(newDigits.join(""))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const verifyCode = async (code: string) => {
    setLoading(true)
    try {
      const res = await api.verifyCode(phone, code)
      if (res.has_password) {
        localStorage.setItem("student_token", res.token)
        navigate("/home", { replace: true })
      } else {
        navigate("/set-password", { state: { phone, tempToken: res.token } })
      }
    } catch (err: any) {
      setError(err.message)
      setDigits(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    const newDigits = text.split("").concat(Array(6 - text.length).fill(""))
    setDigits(newDigits)
    if (text.length === 6) verifyCode(text)
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await api.sendCode(phone)
      setTimeLeft(CODE_EXPIRY)
      setDigits(["", "", "", "", "", ""])
      setError("")
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#2001FF]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-[#2001FF]/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col px-6 max-w-md mx-auto w-full pt-12 pb-8">
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="self-start w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all active:scale-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>

        {telegram_connected === false && (
          <div className="mb-4 p-3 rounded-xl bg-[#F0F0FF] border border-[#2001FF]/10 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#2001FF" className="mt-0.5 shrink-0">
              <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            <p className="text-xs text-gray-600 leading-relaxed">
              Kod Telegram'ingizga kelmagan bo'lsa, <a href="https://t.me/ithousekuy_bot" target="_blank" rel="noopener noreferrer" className="text-[#2001FF] font-semibold">@ithousekuy_bot</a> ga o'tib, telefon raqamingizni ulang va kodni qayta yuboring.
            </p>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center -mt-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 bg-[#2001FF]/5 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-full flex items-center justify-center shadow-lg">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            </div>
            <h1 className="text-[26px] font-bold text-[#111827] tracking-[-0.5px]">Tasdiqlash kodi</h1>
            <p className="text-[15px] text-[#6B7280] font-normal mt-2 leading-relaxed">
              6 xonali kod <span className="text-[#2001FF] font-semibold">{formatPhone(phone || "")}</span> raqamiga yuborildi
            </p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-[10px] mb-8">
            {digits.map((digit, index) => (
              <div key={index} className="relative">
                <input
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className={`w-[48px] sm:w-[54px] h-[60px] text-center text-[24px] font-bold rounded-2xl focus:outline-none transition-all duration-200 ${
                    digit
                      ? "bg-white border-2 border-[#2001FF] shadow-[0_0_0_4px_rgba(32,1,255,0.1)]"
                      : error
                      ? "bg-red-50 border-2 border-red-300"
                      : "bg-[#F3F4F6] border-2 border-transparent focus:bg-white focus:border-[#2001FF] focus:shadow-[0_0_0_4px_rgba(32,1,255,0.1)]"
                  } ${loading ? "opacity-30 pointer-events-none" : ""}`}
                />
              </div>
            ))}
          </div>

          {/* States */}
          {loading && (
            <div className="flex justify-center mb-3">
              <div className="flex items-center gap-2.5 bg-[#F0F0FF] px-5 py-2.5 rounded-full">
                <div className="w-4 h-4 border-[2.5px] border-[#2001FF]/20 border-t-[#2001FF] rounded-full animate-spin" />
                <span className="text-sm font-medium text-[#2001FF]">Tekshirilmoqda...</span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex justify-center mb-3">
              <div className="flex items-center gap-2 bg-red-50 px-4 py-2.5 rounded-full border border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-red-500">{error}</span>
              </div>
            </div>
          )}

          {/* Timer */}
          <div className="text-center">
            {timeLeft > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span className={timeLeft <= 10 ? "text-red-500 font-semibold" : ""}>
                    {minutes}:{seconds.toString().padStart(2, "0")}
                  </span>
                </div>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm font-medium text-[#2001FF] hover:text-[#1a00e0] transition-colors disabled:opacity-40"
                >
                  Kodni qayta yuborish
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-red-500">Kod muddati tugadi</p>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="h-[48px] px-7 bg-gradient-to-r from-[#2001FF] to-[#4361FF] text-white rounded-2xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-40 active:scale-[0.97] flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={resending ? "animate-spin" : ""}>
                    <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                  </svg>
                  {resending ? "Yuborilmoqda..." : "Qayta yuborish"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="text-center">
          <p className="text-[13px] text-gray-400 font-medium">
            Kod kelmadimi?{" "}
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-[#2001FF] font-semibold hover:underline disabled:opacity-40"
            >
              {resending ? "Yuborilmoqda..." : "Qayta yuborish"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
