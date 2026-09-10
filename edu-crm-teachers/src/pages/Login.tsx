import { useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { GraduationCap } from "lucide-react"
import { api } from "../api"

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)

  const handlePhoneInput = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "")
    if (val.startsWith("998") && val.length > 9) val = val.slice(3)
    if (val.length > 9) val = val.slice(0, 9)
    let f = ""
    if (val.length > 0) f = val.slice(0, 2)
    if (val.length > 2) f += " " + val.slice(2, 5)
    if (val.length > 5) f += " " + val.slice(5, 7)
    if (val.length > 7) f += " " + val.slice(7, 9)
    setPhone(f)
    if (error) setError("")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const raw = phone.replace(/\s/g, "")
      const res = await api.login(raw, password)
      localStorage.setItem("employee", JSON.stringify(res.employee))
      localStorage.setItem("is_admin", String(res.is_admin))
      localStorage.setItem("is_teacher", String(res.is_teacher))
      onLogin()
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#111827] select-none relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full translate-x-1/2 -translate-y-1/2 opacity-[0.03]" style={{ background: "radial-gradient(circle, #2001FF 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full -translate-x-1/3 translate-y-1/3 opacity-[0.02]" style={{ background: "radial-gradient(circle, #2001FF 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-[380px] mx-auto px-5 py-6 flex flex-col min-h-screen sm:min-h-0">
        <div className="mb-8">
          <div className="w-12 h-12 bg-[#2001FF] rounded-xl flex items-center justify-center mb-4 shadow-md shadow-[#2001FF]/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-[#111827] font-bold text-[22px] leading-[1.25] tracking-[-0.3px]">
            O'qituvchi paneliga
            <br />
            kirishingiz mumkin.
          </h1>
          <p className="text-gray-400 text-[12px] mt-2">Guruhlaringiz, davomat va oylik ma'lumotlaringizni kuzatib boring</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-[1.5px] mb-2 block">
            Telefon raqami
          </label>
          <div
            className={`flex items-center rounded-lg px-3 h-11 border transition-all duration-200 ${
              focused
                ? "border-[#2001FF] shadow-[0_0_0_2px_rgba(32,1,255,0.06)]"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <span className="text-gray-700 text-[13px] font-semibold mr-1.5 shrink-0">+998</span>
            <div className="w-px h-3.5 bg-gray-200 shrink-0" />
            <input
              type="tel"
              autoFocus
              className="flex-1 bg-transparent text-[#111827] text-[14px] font-medium ml-2.5 outline-none placeholder:text-gray-300 tracking-[0.2px]"
              placeholder="00 000 00 00"
              value={phone}
              onChange={handlePhoneInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              required
            />
          </div>

          <div>
            <label className="text-gray-400 text-[10px] font-semibold uppercase tracking-[1.5px] mb-2 block">
              Parol
            </label>
            <div className="flex items-center rounded-lg px-3 h-11 border border-gray-200 hover:border-gray-300 bg-white transition-all duration-200">
              <input
                type="password"
                className="flex-1 bg-transparent text-[#111827] text-[14px] font-medium outline-none placeholder:text-gray-300 tracking-[0.2px]"
                placeholder="Parolni kiriting"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError("")
                }}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
              <span className="text-red-500 text-[11px] font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phone.replace(/\s/g, "").length !== 9 || !password}
            className="mt-1.5 w-full h-11 rounded-xl text-white text-[13px] font-bold bg-[#2001FF] shadow-[0_6px_20px_-4px_rgba(32,1,255,0.3)] transition-all duration-300 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 rounded-full animate-spin border-t-white" />
                <span className="text-white/80 font-medium">Kirilmoqda...</span>
              </div>
            ) : (
              "Kirish"
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 mt-auto pt-6 shrink-0">
          <GraduationCap size={12} className="text-gray-300 shrink-0" />
          <p className="text-[10px] text-gray-300 text-center leading-relaxed">
            Ma'lumotlaringiz xavfsiz saqlanadi va uchinchi shaxslarga berilmaydi
          </p>
        </div>
      </div>
    </div>
  )
}
