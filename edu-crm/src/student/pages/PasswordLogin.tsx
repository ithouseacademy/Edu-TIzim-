import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { api } from "../api"

export default function PasswordLogin() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [focused, setFocused] = useState({ phone: false, password: false })

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "")
    if (val.length > 9) val = val.slice(0, 9)
    let f = ""
    if (val.length > 0) f = val.slice(0, 2)
    if (val.length > 2) f += " " + val.slice(2, 5)
    if (val.length > 5) f += " " + val.slice(5, 7)
    if (val.length > 7) f += " " + val.slice(7, 9)
    setPhone(f)
    if (error) setError("")
  }

  const handleSubmit = async () => {
    const raw = phone.replace(/\s/g, "")
    if (raw.length !== 9) {
      setError("Telefon raqamni to'liq kiriting")
      return
    }
    if (!password) {
      setError("Parolni kiriting")
      return
    }
    setLoading(true)
    try {
      const res = await api.login("+998" + raw, password)
      localStorage.setItem("student_token", res.token)
      navigate("/home", { replace: true })
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#111827] select-none relative overflow-hidden flex items-center justify-center">

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full translate-x-1/2 -translate-y-1/2 opacity-[0.04]" style={{ background: "radial-gradient(circle, #2001FF 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full -translate-x-1/3 translate-y-1/3 opacity-[0.03]" style={{ background: "radial-gradient(circle, #2001FF 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px] mx-auto px-6 py-8 flex flex-col min-h-screen sm:min-h-0 sm:py-0 sm:justify-center">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-12 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all active:scale-90"
          >
            <ArrowLeft size={18} className="text-gray-400" />
          </button>
          <span className="text-gray-300 text-[10px] font-bold uppercase tracking-[2px]">IT House Superapp</span>
          <div className="w-9" />
        </div>

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-[#111827] font-bold text-[28px] leading-[1.25] tracking-[-0.5px]">
            Hisobingizga kiring
          </h1>
        </div>

        {/* Phone input */}
        <label className="text-gray-400 text-[11px] font-semibold uppercase tracking-[1.5px] mb-3 block">
          Telefon raqami
        </label>
        <div
          className={`flex items-center rounded-xl px-4 h-14 border transition-all duration-200 ${
            focused.phone
              ? "border-[#2001FF] shadow-[0_0_0_3px_rgba(32,1,255,0.08)]"
              : error && !password
                ? "border-red-300 bg-red-50/30"
                : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-[2px] shrink-0">
            <rect width="24" height="16" rx="1" fill="#1EB53A" />
            <rect width="24" height="5.33" fill="#0099B5" />
            <rect y="5.33" width="24" height="5.34" fill="white" />
            <rect y="5.33" width="24" height="0.67" fill="#CE1126" />
            <rect y="10" width="24" height="0.67" fill="#CE1126" />
            <rect y="10.67" width="24" height="5.33" fill="#1EB53A" />
            <g fill="white" transform="translate(2,0.8)">
              <path d="M2.2 3.5 A1.8 1.8 0 0 0 2.2 0.5 A2.2 2.2 0 0 1 3.2 3.5 A2.2 2.2 0 0 1 2.2 6.5 A1.8 1.8 0 0 0 2.2 3.5z" />
              <circle cx="5" cy="0.8" r="0.4" /><circle cx="6.2" cy="1.2" r="0.35" /><circle cx="6.8" cy="2.3" r="0.35" />
              <circle cx="6.2" cy="3.4" r="0.35" /><circle cx="5" cy="3.8" r="0.35" /><circle cx="3.8" cy="3.4" r="0.35" />
              <circle cx="3.2" cy="2.3" r="0.35" /><circle cx="3.8" cy="1.2" r="0.35" /><circle cx="6.8" cy="0.8" r="0.28" />
              <circle cx="7.2" cy="1.2" r="0.28" /><circle cx="7.2" cy="2.8" r="0.28" /><circle cx="6.8" cy="3.4" r="0.28" />
            </g>
          </svg>
          <span className="text-gray-700 text-sm font-semibold ml-3 mr-2 shrink-0">+998</span>
          <div className="w-px h-4 bg-gray-200 shrink-0" />
          <input
            type="tel"
            className="flex-1 bg-transparent text-[#111827] text-base font-medium ml-3 outline-none placeholder:text-gray-300 tracking-[0.3px]"
            placeholder="00 000 00 00"
            value={phone}
            onChange={handlePhone}
            onFocus={() => setFocused({ ...focused, phone: true })}
            onBlur={() => setFocused({ ...focused, phone: false })}
          />
        </div>

        {/* Password input */}
        <label className="text-gray-400 text-[11px] font-semibold uppercase tracking-[1.5px] mb-3 mt-5 block">
          Parol
        </label>
        <div
          className={`flex items-center rounded-xl px-4 h-14 border transition-all duration-200 ${
            focused.password
              ? "border-[#2001FF] shadow-[0_0_0_3px_rgba(32,1,255,0.08)]"
              : error && password
                ? "border-red-300 bg-red-50/30"
                : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <input
            type={showPassword ? "text" : "password"}
            className="flex-1 bg-transparent text-[#111827] text-base font-medium outline-none placeholder:text-gray-300 tracking-[0.3px]"
            placeholder="Parolingizni kiriting"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError("") }}
            onFocus={() => setFocused({ ...focused, password: true })}
            onBlur={() => setFocused({ ...focused, password: false })}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-2"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mt-3">
            <div className="w-[5px] h-[5px] rounded-full bg-red-400 shrink-0" />
            <span className="text-red-500 text-xs font-medium">{error}</span>
          </div>
        )}

        {/* Forgot password */}
        <div className="flex justify-end mt-3">
          <button
            onClick={() => navigate("/")}
            className="text-[#2001FF] text-xs font-semibold hover:opacity-80 transition-opacity"
          >
            Parolni unutdingizmi?
          </button>
        </div>

        {/* Login button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-5 w-full h-14 rounded-2xl text-white text-base font-bold bg-[#2001FF] shadow-[0_8px_25px_-5px_rgba(32,1,255,0.35)] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none hover:shadow-[0_12px_30px_-5px_rgba(32,1,255,0.45)]"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-5 h-5 border-2 border-white/30 rounded-full animate-spin border-t-white" />
              <span className="text-white/80 font-medium">Kirish...</span>
            </div>
          ) : (
            "Kirish"
          )}
        </button>

        {/* Register link */}
        <div className="flex justify-center mt-8">
          <p className="text-gray-400 text-sm font-medium">
            Hisobingiz yo'qmi?{" "}
            <button
              onClick={() => navigate("/")}
              className="text-[#2001FF] font-semibold hover:opacity-80 transition-opacity"
            >
              Ro'yxatdan o'tish
            </button>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-10 shrink-0">
          <ShieldCheck size={14} className="text-gray-300 shrink-0" />
          <p className="text-gray-300 text-[11px] font-medium text-center leading-relaxed">
            Ma'lumotlaringiz xavfsiz saqlanadi va uchinchi shaxslarga berilmaydi
          </p>
        </div>

      </div>
    </div>
  )
}
