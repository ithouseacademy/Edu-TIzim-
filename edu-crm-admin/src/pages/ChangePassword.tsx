import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react"
import { api } from "../api"

export default function ChangePassword() {
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passMsg, setPassMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [passSaving, setPassSaving] = useState(false)

  const handlePassSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPassMsg(null)
    if (newPassword.length < 4) {
      setPassMsg({ type: "err", text: "Yangi parol kamida 4 ta belgidan iborat bo'lsin" })
      return
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: "err", text: "Parollar mos kelmadi" })
      return
    }
    setPassSaving(true)
    try {
      const res = await api.changePassword(oldPassword, newPassword)
      setPassMsg({ type: "ok", text: res.message || "Parol o'zgartirildi" })
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPassMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    } finally {
      setPassSaving(false)
    }
  }

  const passInputs: {
    label: string
    value: string
    placeholder: string
    show: boolean
    setter: (v: string) => void
    toggle: () => void
    autoComplete: string
  }[] = [
    {
      label: "Joriy parol",
      value: oldPassword,
      placeholder: "Joriy parolingiz",
      show: showOld,
      setter: setOldPassword,
      toggle: () => setShowOld(!showOld),
      autoComplete: "current-password",
    },
    {
      label: "Yangi parol",
      value: newPassword,
      placeholder: "Yangi parol (kamida 4 belgi)",
      show: showNew,
      setter: setNewPassword,
      toggle: () => setShowNew(!showNew),
      autoComplete: "new-password",
    },
    {
      label: "Yangi parolni tasdiqlash",
      value: confirmPassword,
      placeholder: "Yangi parolni qayta kiriting",
      show: showConfirm,
      setter: setConfirmPassword,
      toggle: () => setShowConfirm(!showConfirm),
      autoComplete: "new-password",
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <ArrowLeft size={17} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
              <KeyRound size={13} className="text-[#2001FF]" />
            </div>
            <h1 className="text-sm font-bold text-gray-900">Parolni o'zgartirish</h1>
          </div>
          <div className="w-8 h-8" />
        </header>

        <form onSubmit={handlePassSubmit} className="card-premium p-3.5 space-y-3 animate-scale-in">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
              <KeyRound size={13} className="text-[#2001FF]" />
            </div>
            <h2 className="text-[12px] font-bold text-gray-900">Yangi parol o'rnatish</h2>
          </div>

          {passInputs.map((f) => (
            <div key={f.label}>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
                {f.label}
              </label>
              <div className="flex items-center rounded-lg px-3 bg-gray-50 border border-transparent focus-within:border-[#2001FF] focus-within:bg-white transition-all duration-200">
                <input
                  type={f.show ? "text" : "password"}
                  className="flex-1 bg-transparent text-[#111827] text-[12px] font-medium outline-none placeholder:text-gray-300 py-2.5"
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={(e) => {
                    f.setter(e.target.value)
                    if (passMsg) setPassMsg(null)
                  }}
                  autoComplete={f.autoComplete}
                />
                <button type="button" onClick={f.toggle} className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 btn-hover">
                  {f.show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          {passMsg && (
            <div
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium ${
                passMsg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              }`}
            >
              {passMsg.type === "ok" ? <ShieldCheck size={13} /> : <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />}
              {passMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={passSaving || !oldPassword || !newPassword || newPassword !== confirmPassword}
            className="w-full h-10 rounded-xl bg-[#2001FF] text-white text-[12px] font-bold shadow-md shadow-[#2001FF]/15 transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
          >
            {passSaving ? "Saqlanmoqda..." : "Parolni yangilash"}
          </button>
        </form>
      </div>
    </div>
  )
}