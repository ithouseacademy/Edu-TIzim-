import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowLeft, ShieldCheck, KeyRound, Phone, Eye, EyeOff } from "lucide-react"
import { api } from "../api"
import DesktopShell from "../components/DesktopShell"

const normPhoneInput = (val: string) => {
  let digits = val.replace(/\D/g, "")
  if (digits.startsWith("998") && digits.length > 9) digits = digits.slice(3)
  return digits.slice(0, 9)
}

interface ChangePasswordProps {
  onBack: () => void
}

export default function ChangePassword({ onBack }: ChangePasswordProps) {
  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const currentPhone = emp.phone || ""

  const [newPhone, setNewPhone] = useState("")
  const [phonePassword, setPhonePassword] = useState("")
  const [showPhonePw, setShowPhonePw] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [phoneSaving, setPhoneSaving] = useState(false)

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passMsg, setPassMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [passSaving, setPassSaving] = useState(false)

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPhoneMsg(null)
    if (newPhone.length !== 9) {
      setPhoneMsg({ type: "err", text: "Telefon raqam to'liq kiritilishi kerak (9 ta raqam)" })
      return
    }
    if (newPhone === currentPhone.replace(/\D/g, "").replace(/^998/, "")) {
      setPhoneMsg({ type: "err", text: "Yangi raqam joriy raqam bilan bir xil" })
      return
    }
    setPhoneSaving(true)
    try {
      const res = await api.changePhone(phonePassword, newPhone)
      setPhoneMsg({ type: "ok", text: res.message || "Telefon raqam yangilandi" })
      localStorage.removeItem("employee")
      localStorage.removeItem("is_admin")
      localStorage.removeItem("is_teacher")
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setPhoneMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    } finally {
      setPhoneSaving(false)
    }
  }

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
    <>
    {/* ====== Mobile View ====== */}
    <div className="md:hidden min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <ArrowLeft size={17} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
              <KeyRound size={13} className="text-[#2001FF]" />
            </div>
            <h1 className="text-sm font-bold text-gray-900">Profilni o'zgartirish</h1>
          </div>
          <div className="w-8 h-8" />
        </header>

        <form onSubmit={handlePhoneSubmit} className="card-premium p-3.5 space-y-3 mb-3 animate-scale-in">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Phone size={13} className="text-blue-500" />
            </div>
            <h2 className="text-[12px] font-bold text-gray-900">Telefon raqamni o'zgartirish</h2>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
              Joriy raqam
            </label>
            <div className="rounded-lg px-3 py-2.5 bg-gray-100 text-[12px] font-medium text-gray-500">
              +998 {currentPhone.replace(/^998/, "") || "-"}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
              Yangi telefon raqam
            </label>
            <div className="flex items-center rounded-lg px-3 bg-gray-50 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all duration-200">
              <span className="text-[12px] font-semibold text-gray-400 pr-1.5">+998</span>
              <input
                type="tel"
                className="flex-1 bg-transparent text-[#111827] text-[12px] font-medium outline-none placeholder:text-gray-300 py-2.5"
                placeholder="9 ta raqam"
                inputMode="numeric"
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(normPhoneInput(e.target.value))
                  if (phoneMsg) setPhoneMsg(null)
                }}
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
              Joriy parol
            </label>
            <div className="flex items-center rounded-lg px-3 bg-gray-50 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all duration-200">
              <input
                type={showPhonePw ? "text" : "password"}
                className="flex-1 bg-transparent text-[#111827] text-[12px] font-medium outline-none placeholder:text-gray-300 py-2.5"
                placeholder="Tasdiqlash uchun parolingiz"
                value={phonePassword}
                onChange={(e) => {
                  setPhonePassword(e.target.value)
                  if (phoneMsg) setPhoneMsg(null)
                }}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPhonePw(!showPhonePw)} className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 btn-hover">
                {showPhonePw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {phoneMsg && (
            <div
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium ${
                phoneMsg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              }`}
            >
              {phoneMsg.type === "ok" ? <ShieldCheck size={13} /> : <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />}
              {phoneMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={phoneSaving || newPhone.length !== 9 || !phonePassword}
            className="w-full h-10 rounded-xl bg-blue-600 text-white text-[12px] font-bold shadow-md shadow-blue-600/15 transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
          >
            {phoneSaving ? "Saqlanmoqda..." : "Raqamni saqlash"}
          </button>
          <p className="text-[10px] font-medium text-gray-400 text-center">
            Raqam yangilangach, yangi raqam bilan qayta kirishingiz kerak bo'ladi
          </p>
        </form>

        <form onSubmit={handlePassSubmit} className="card-premium p-3.5 space-y-3 animate-scale-in">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
              <KeyRound size={13} className="text-[#2001FF]" />
            </div>
            <h2 className="text-[12px] font-bold text-gray-900">Parolni o'zgartirish</h2>
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

    {/* ====== Desktop View ====== */}
    <div className="hidden md:block min-h-screen bg-[#f8fafc]">
      <DesktopShell
        activeKey="profile"
        navItems={[
          { key: "dashboard", label: "Dashboard", icon: null, onClick: () => window.location.hash = "#dashboard" },
          { key: "groups", label: "Mening guruhlarim", icon: null, onClick: () => window.location.hash = "#my-groups" },
          { key: "salary", label: "Mening oyligim", icon: null, onClick: () => window.location.hash = "#salary" },
          { key: "tasks", label: "Topshiriqlar", icon: null, onClick: () => window.location.hash = "#tasks" },
          { key: "profile", label: "Profil", icon: null, onClick: onBack },
        ]}
      >
        <div className="mb-2">
          <p className="text-sm text-gray-500">Profilni o'zgartirish · O'qituvchi paneli</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 max-w-5xl">
          {/* Phone form */}
          <form onSubmit={handlePhoneSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Phone size={16} className="text-blue-500" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Telefon raqamni o'zgartirish</h2>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">Joriy raqam</label>
              <div className="rounded-lg px-3 py-2.5 bg-gray-100 text-sm font-medium text-gray-500">
                +998 {currentPhone.replace(/^998/, "") || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">Yangi telefon raqam</label>
              <div className="flex items-center rounded-lg px-3 bg-gray-50 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all duration-200">
                <span className="text-sm font-semibold text-gray-400 pr-1.5">+998</span>
                <input
                  type="tel"
                  className="flex-1 bg-transparent text-gray-900 text-sm font-medium outline-none placeholder:text-gray-300 py-2.5"
                  placeholder="9 ta raqam"
                  inputMode="numeric"
                  value={newPhone}
                  onChange={(e) => { setNewPhone(normPhoneInput(e.target.value)); if (phoneMsg) setPhoneMsg(null) }}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">Joriy parol</label>
              <div className="flex items-center rounded-lg px-3 bg-gray-50 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all duration-200">
                <input
                  type={showPhonePw ? "text" : "password"}
                  className="flex-1 bg-transparent text-gray-900 text-sm font-medium outline-none placeholder:text-gray-300 py-2.5"
                  placeholder="Tasdiqlash uchun parolingiz"
                  value={phonePassword}
                  onChange={(e) => { setPhonePassword(e.target.value); if (phoneMsg) setPhoneMsg(null) }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPhonePw(!showPhonePw)} className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 btn-hover">
                  {showPhonePw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {phoneMsg && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${phoneMsg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                {phoneMsg.type === "ok" ? <ShieldCheck size={15} /> : <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />}
                {phoneMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={phoneSaving || newPhone.length !== 9 || !phonePassword}
              className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-600/15 transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer border-none"
            >
              {phoneSaving ? "Saqlanmoqda..." : "Raqamni saqlash"}
            </button>
            <p className="text-xs font-medium text-gray-400 text-center">
              Raqam yangilangach, yangi raqam bilan qayta kirishingiz kerak bo'ladi
            </p>
          </form>

          {/* Password form */}
          <form onSubmit={handlePassSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
                <KeyRound size={16} className="text-[#2001FF]" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Parolni o'zgartirish</h2>
            </div>

            {passInputs.map((f) => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">{f.label}</label>
                <div className="flex items-center rounded-lg px-3 bg-gray-50 border border-transparent focus-within:border-[#2001FF] focus-within:bg-white transition-all duration-200">
                  <input
                    type={f.show ? "text" : "password"}
                    className="flex-1 bg-transparent text-gray-900 text-sm font-medium outline-none placeholder:text-gray-300 py-2.5"
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => { f.setter(e.target.value); if (passMsg) setPassMsg(null) }}
                    autoComplete={f.autoComplete}
                  />
                  <button type="button" onClick={f.toggle} className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 btn-hover">
                    {f.show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}

            {passMsg && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${passMsg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                {passMsg.type === "ok" ? <ShieldCheck size={15} /> : <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />}
                {passMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={passSaving || !oldPassword || !newPassword || newPassword !== confirmPassword}
              className="w-full h-11 rounded-xl bg-[#2001FF] text-white text-sm font-bold shadow-md shadow-[#2001FF]/15 transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer border-none"
            >
              {passSaving ? "Saqlanmoqda..." : "Parolni yangilash"}
            </button>
          </form>
        </div>
      </DesktopShell>
    </div>
    </>
  )
}
