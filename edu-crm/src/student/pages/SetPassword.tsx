import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Lock, Eye, EyeOff, ArrowLeft, Check, X } from "lucide-react"
import { api } from "../api"

type Strength = "weak" | "medium" | "strong"

const strengthConfig: Record<Strength, { label: string; color: string; bg: string; width: string }> = {
  weak: { label: "Zaif", color: "text-red-500", bg: "bg-red-500", width: "w-1/3" },
  medium: { label: "O'rtacha", color: "text-yellow-500", bg: "bg-yellow-500", width: "w-2/3" },
  strong: { label: "Kuchli", color: "text-green-500", bg: "bg-green-500", width: "w-full" },
}

export default function SetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const { phone, tempToken } = location.state || {}
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const hasMinLength = password.length >= 6

  const score = hasMinLength ? 3 : password.length > 0 ? 1 : 0
  const strength: Strength = score <= 1 ? "weak" : score <= 2 ? "medium" : "strong"
  const st = strengthConfig[strength]

  const rules = [
    { label: "Kamida 6 ta belgi", passed: hasMinLength },
  ]

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      setError("Parol kamida 6 belgidan iborat bo'lishi kerak")
      return
    }
    if (password !== confirmPassword) {
      setError("Parollar mos kelmadi")
      return
    }
    setLoading(true)
    try {
      await api.setPassword(phone, password, confirmPassword)
      localStorage.setItem("student_token", tempToken)
      navigate("/home")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col page-enter">
      <div className="flex-1 flex flex-col px-6 max-w-md mx-auto w-full py-10">
        <button
          onClick={() => navigate("/verify-code", { state: { phone } })}
          className="self-start p-2 -ml-2 rounded-xl hover:bg-gray-50 transition-all text-gray-400 hover:text-gray-600 btn-scale"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="flex-1 flex flex-col justify-center -mt-12">
          <div className="text-center mb-8 animate-slide-up">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-[#2001FF]/5 rounded-2xl blur-xl" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-2xl flex items-center justify-center shadow-xl shadow-[#2001FF]/20">
                <Lock size={36} className="text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Yangi parol</h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">
              Hisobingizni himoyalash uchun parol o'rnating
            </p>
          </div>

          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Parol</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError("")
                  }}
                  placeholder="Kamida 6 belgi"
                  className="w-full h-[56px] px-4 bg-[#F7F9FC] border-2 border-gray-200 rounded-[18px] text-base font-medium focus:outline-none transition-all duration-300 focus:border-[#2001FF] focus:shadow-[0_0_0_3px_rgba(32,1,255,0.1),0_0_20px_rgba(32,1,255,0.05)] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {password.length > 0 && (
              <div className="animate-slide-up">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">Parol kuchi</span>
                  <span className={`text-xs font-bold ${st.color}`}>{st.label}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${st.bg} ${st.width}`} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Parolni tasdiqlang</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setError("")
                  }}
                  placeholder="Parolni qayta kiriting"
                  className="w-full h-[56px] px-4 bg-[#F7F9FC] border-2 border-gray-200 rounded-[18px] text-base font-medium focus:outline-none transition-all duration-300 focus:border-[#2001FF] focus:shadow-[0_0_0_3px_rgba(32,1,255,0.1),0_0_20px_rgba(32,1,255,0.05)] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all"
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">Parollar mos kelmadi</p>
              )}
            </div>

            {password.length > 0 && (
              <div className="space-y-2 animate-slide-up">
                {rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${rule.passed ? "bg-green-100" : "bg-gray-100"}`}>
                      {rule.passed ? (
                        <Check size={12} className="text-green-600" />
                      ) : (
                        <X size={12} className="text-gray-400" />
                      )}
                    </div>
                    <span className={`text-xs font-medium transition-all duration-300 ${rule.passed ? "text-green-600" : "text-gray-400"}`}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-500 text-sm px-4 py-3 rounded-[14px] flex items-center gap-2 font-medium">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !password || !confirmPassword || password !== confirmPassword}
              className="w-full h-[56px] bg-gradient-to-r from-[#2001FF] to-[#4361FF] text-white rounded-[18px] font-semibold text-base shadow-lg shadow-[#2001FF]/25 hover:shadow-xl hover:shadow-[#2001FF]/30 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 btn-scale mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Yaratilmoqda...</span>
                </div>
              ) : (
                "Parolni saqlash"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
