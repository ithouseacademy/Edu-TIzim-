import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronRight, LogOut, MessageSquare, KeyRound, Send, GraduationCap, Coins as CoinsIcon, Camera, Phone, Newspaper } from "lucide-react"
import { api, loadEmployee, clearSession, loadCanMessaging, storeEmployee, loadIsAdmin } from "../api"
import type { SalaryData } from "../types"

const TELEGRAM_BOT_URL = "https://t.me/ithousekuy_bot"

export default function Profile() {
  const navigate = useNavigate()
  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()
  const canMsg = loadCanMessaging()
  const fileRef = useRef<HTMLInputElement>(null)

  const [salary, setSalary] = useState<SalaryData | null>(null)
  const [photo, setPhoto] = useState<string | null>(emp?.photo || null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.mySalary().then((d) => setSalary(d.salary)).catch(() => {})
  }, [])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploading) return
    setUploading(true)
    try {
      const res = await api.uploadPhoto(file)
      const url = res.photo || null
      setPhoto(url)
      const current = loadEmployee()
      if (current) storeEmployee({ ...current, photo: url }, loadIsAdmin())
    } catch (err) {
      alert(err instanceof Error ? err.message : "Rasm yuklashda xatolik yuz berdi")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const balance = salary ? salary.balance : (emp?.teacher_balance ?? 0)
  const avans = salary ? salary.avans_balance : 0
  const net = balance - avans
  const isNegative = net < 0

  const handleLogout = async () => {
    try { await api.logout() } catch {}
    clearSession()
    window.location.href = "/login"
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col animate-page-enter">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 px-4 pb-28">
        <header className="flex items-center justify-between pt-2">
          <button
            onClick={() => navigate("/today")}
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center btn-hover shadow-sm"
            aria-label="Orqaga"
          >
            <ArrowLeft size={20} className="text-black" strokeWidth={2.2} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2001FF]/10 flex items-center justify-center shrink-0">
              {photo ? (
                <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-[#2001FF]">{initials || "A"}</span>
              )}
            </div>
          </div>
        </header>

        <main className="mt-5 space-y-4 animate-page-enter">
          <div className="bg-white rounded-[28px] px-6 py-5 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative w-16 h-16 rounded-full overflow-hidden bg-[#2001FF]/10 flex items-center justify-center shrink-0 btn-hover"
                aria-label="Rasmni o'zgartirish"
              >
                {photo ? (
                  <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-[#2001FF]">{initials || "A"}</span>
                )}
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#2001FF] ring-2 ring-white flex items-center justify-center">
                  <Camera size={11} className="text-white" />
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-400">
                  {emp?.position?.name || emp?.role?.name || "Admin"}
                </p>
                <p className="mt-1 text-[18px] font-bold leading-tight text-gray-900 truncate">
                  {emp?.first_name || ""} {emp?.last_name || ""}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-gray-400">{emp?.phone || ""}</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 text-[11px] font-semibold text-[#2001FF] flex items-center gap-1 btn-hover"
                >
                  <Camera size={12} />
                  {uploading ? "Yuklanmoqda..." : photo ? "Rasmni almashtirish" : "Rasm qo'yish"}
                </button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <button
            onClick={() => navigate("/profile/balance")}
            className="w-full bg-white rounded-[28px] p-6 shadow-sm text-left btn-hover"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-gray-400">Ish haqi balansi</p>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
            <p className={`mt-1.5 text-[32px] font-bold leading-none tracking-tight ${isNegative ? "text-red-600" : "text-gray-900"}`}>
              {isNegative ? "-" : ""}{Math.abs(net).toLocaleString()}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#F2F2F7] px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Umumiy</p>
                <p className="mt-0.5 text-[15px] font-bold text-gray-900">{balance.toLocaleString()} so'm</p>
              </div>
              <div className="rounded-2xl bg-[#F2F2F7] px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Avans</p>
                <p className="mt-0.5 text-[15px] font-bold text-red-500">{avans.toLocaleString()} so'm</p>
              </div>
            </div>
            <div
              className={`mt-4 w-fit flex items-center gap-1 px-4 h-9 rounded-full text-white text-xs font-bold uppercase tracking-wide ${
                isNegative ? "bg-[#EF4444]" : "bg-[#22C55E]"
              }`}
            >
              {isNegative ? "Minus" : "Doimiy"}
              <ChevronDown size={14} strokeWidth={2.5} />
            </div>
          </button>

          <section className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/students")}
              className="bg-[#2001FF] rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] shadow-sm shadow-[#2001FF]/20 text-left btn-hover"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <GraduationCap size={18} className="text-white" />
                </div>
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                  <ChevronRight size={16} className="text-[#2001FF]" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <p className="text-[15px] font-bold leading-snug text-white">O'quvchilar</p>
                <div className="mt-2 w-fit px-3 py-1 rounded-full bg-white/25">
                  <span className="text-[10px] font-semibold text-white">RO'YXAT</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate("/coins")}
              className="bg-white rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] shadow-sm text-left btn-hover"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-full bg-[#2001FF]/10 flex items-center justify-center">
                  <CoinsIcon size={18} className="text-[#2001FF]" />
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2001FF]/5 flex items-center justify-center">
                  <ChevronRight size={16} className="text-[#2001FF]/60" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900">Coin</p>
                <div className="mt-2 w-fit px-3 py-1 rounded-full bg-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500">BOSHQARUV</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate("/news")}
              className="bg-white rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] shadow-sm text-left btn-hover"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-full bg-[#2001FF]/10 flex items-center justify-center">
                  <Newspaper size={18} className="text-[#2001FF]" />
                </div>
                <div className="w-7 h-7 rounded-full bg-[#2001FF]/5 flex items-center justify-center">
                  <ChevronRight size={16} className="text-[#2001FF]/60" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900">Yangiliklar</p>
                <div className="mt-2 w-fit px-3 py-1 rounded-full bg-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500">BOSHQARUV</span>
                </div>
              </div>
            </button>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/change-password")}
              className="bg-white rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] shadow-sm text-left btn-hover"
            >
              <div className="w-10 h-10 rounded-full bg-[#2001FF]/10 flex items-center justify-center">
                <KeyRound size={18} className="text-[#2001FF]" />
              </div>
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900 whitespace-pre-line">Parolni{"\n"}o'zgartirish</p>
                <div className="mt-2 w-fit px-3 py-1 rounded-full bg-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500">XAVFSIZLIK</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate("/change-phone")}
              className="bg-white rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] shadow-sm text-left btn-hover"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Phone size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900 whitespace-pre-line">Telefon raqamni{"\n"}o'zgartirish</p>
                <div className="mt-2 w-fit px-3 py-1 rounded-full bg-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500">LOGIN</span>
                </div>
              </div>
            </button>
          </section>

            {canMsg && (
          <section className="grid grid-cols-2 gap-4">
              <button
                onClick={() => navigate("/messages")}
                className="bg-[#2001FF] rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] shadow-sm shadow-[#2001FF]/20 text-left btn-hover"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageSquare size={18} className="text-white" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                    <ChevronRight size={16} className="text-[#2001FF]" strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <p className="text-[15px] font-bold leading-snug text-white">Xabarlar</p>
                  <div className="mt-2 w-fit px-3 py-1 rounded-full bg-white/25">
                    <span className="text-[10px] font-semibold text-white">SUHBATLAR</span>
                  </div>
                </div>
              </button>
          </section>
          )}

          <section className="grid grid-cols-2 gap-4">
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-[28px] p-5 flex flex-col justify-end min-h-[176px] shadow-sm text-left btn-hover"
            >
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900">Telegram{"\n"}bot</p>
                <div className="mt-2.5 w-fit flex items-center gap-0.5 px-3 h-8 rounded-full bg-[#2001FF]">
                  <span className="text-[11px] font-bold text-white uppercase">Ochish</span>
                  <ChevronRight size={12} className="text-white" strokeWidth={2.5} />
                </div>
              </div>
            </a>

            <button
              onClick={handleLogout}
              className="bg-red-50 rounded-[28px] p-5 flex flex-col justify-between min-h-[176px] text-left btn-hover"
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <LogOut size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[15px] font-bold leading-snug text-red-600">Chiqish</p>
              </div>
            </button>
          </section>

          <div className="flex justify-center pt-1">
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/70 shadow-sm">
              <Send size={12} className="text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-400">@ithousekuy_bot</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}