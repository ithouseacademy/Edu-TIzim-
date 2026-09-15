import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { X, Settings, Smile, Star, ChevronDown, ChevronRight } from "lucide-react"
import { api } from "../api"
import { useDrawer } from "../context/DrawerContext"
import { useAppSettings } from "../AppSettings"
import type { StudentProfile } from "../types"

export default function Profile() {
  const navigate = useNavigate()
  const { open: openDrawer } = useDrawer()
  const { avatar, tr } = useAppSettings()
  const [student, setStudent] = useState<StudentProfile | null>(null)

  useEffect(() => {
    api
      .profile()
      .then((res) => setStudent(res.student))
      .catch(() => {})
  }, [])

  if (!student) {
    return (
      <div className="min-h-dvh bg-[#F3F4F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1677D2]/30 border-t-[#1677D2] rounded-full animate-spin" />
      </div>
    )
  }

  const balance = student.balance ?? 0
  const hasBalance = balance > 0
  const hasDebt = balance < 0

  return (
    <div className="min-h-dvh bg-[#F3F4F7] flex flex-col animate-page-enter">
      <div
        className="w-full max-w-lg mx-auto flex flex-col flex-1 px-5 pb-28"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <header className="flex items-center justify-between pt-1">
          <button
            onClick={() => navigate("/home")}
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center btn-hover shadow-sm"
            aria-label={tr("Yopish")}
          >
            <X size={20} className="text-black" strokeWidth={2.2} />
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/profile/settings")}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center btn-hover shadow-sm"
              aria-label={tr("Sozlamalar")}
            >
              <Settings size={20} className="text-black" strokeWidth={2} />
            </button>
            <button
              onClick={openDrawer}
              aria-label={tr("Mening profilim")}
              className="w-11 h-11 bg-[#1677D2] rounded-full flex items-center justify-center overflow-hidden btn-hover shadow-md shadow-[#1677D2]/25"
            >
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Smile size={22} className="text-white" fill="white" />
              )}
            </button>
          </div>
        </header>

        <main className="mt-5 space-y-4">
          <button
            onClick={() => navigate("/profile/balance")}
            className="w-full bg-white rounded-[28px] p-6 shadow-sm text-left btn-hover"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-gray-400">{tr("Balans")}</p>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
            <p className={`mt-1.5 text-[32px] font-bold leading-none tracking-tight ${hasDebt ? "text-red-600" : "text-gray-900"}`}>
              {student.balance_str || "0 so'm"}
            </p>
            {hasDebt ? (
              <div className="mt-5 w-fit flex items-center gap-1 px-4 h-9 rounded-full bg-[#EF4444] text-white text-xs font-bold uppercase tracking-wide">
                {tr("Qarz")}
                <ChevronDown size={14} strokeWidth={2.5} />
              </div>
            ) : (
              <div
                className={`mt-5 w-fit flex items-center gap-1 px-4 h-9 rounded-full text-white text-xs font-bold uppercase tracking-wide ${
                  hasBalance ? "bg-[#22C55E]" : "bg-[#9AA5B1]"
                }`}
              >
                {hasBalance ? tr("To'langan") : tr("Balans")}
                <ChevronDown size={14} strokeWidth={2.5} />
              </div>
            )}
          </button>

          <section className="grid grid-cols-2 gap-4">
            <div className="relative bg-[#6754D9] rounded-[28px] p-5 flex flex-col justify-between overflow-hidden min-h-[176px]">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Star size={18} className="text-white" fill="white" />
                </div>
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                  <span className="text-[15px] font-bold text-[#6754D9] leading-none">?</span>
                </div>
              </div>
              <div>
                <p className="text-[40px] font-bold leading-none text-white">0</p>
                <div className="mt-2 w-fit px-3 py-1 rounded-full bg-white/25">
                  <span className="text-[11px] font-semibold text-white">{tr("Koinlar")}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[28px] p-5 flex flex-col justify-end min-h-[176px] shadow-sm">
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900 whitespace-pre-line">
                  {tr("Mening\nsertifikatlarim")}
                </p>
                <div className="mt-2.5 w-fit px-3 py-1 rounded-full bg-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500">0 {tr("SERTIFIKAT")}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-[28px] p-5 flex flex-col justify-end min-h-[176px] shadow-sm">
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900 whitespace-pre-line">
                  {tr("Do'stlarni\ntaklif qilish")}
                </p>
                <div className="mt-2.5 w-fit px-3 py-1 rounded-full bg-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500">0 {tr("TAKLIF QILINGAN")}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate("/profile/feedback")}
              className="bg-white rounded-[28px] p-5 flex flex-col justify-end text-left min-h-[176px] shadow-sm btn-hover"
            >
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900 whitespace-pre-line">
                  {tr("Takliflar\nva shikoyatlar")}
                </p>
                <div className="mt-2.5 w-fit flex items-center gap-0.5 px-3 h-8 rounded-full bg-[#1677D2]">
                  <span className="text-[11px] font-bold text-white uppercase">{tr("Yuborish")}</span>
                  <ChevronRight size={12} className="text-white" strokeWidth={2.5} />
                </div>
              </div>
            </button>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-[28px] p-5 flex flex-col justify-end min-h-[176px] shadow-sm">
              <div>
                <p className="text-[15px] font-bold leading-snug text-gray-900">{tr("Shartnomalar")}</p>
                <div className="mt-2.5 w-fit flex items-center gap-0.5 px-3 h-8 rounded-full bg-[#1677D2]">
                  <span className="text-[11px] font-bold text-white uppercase">{tr("Ochish")}</span>
                  <ChevronRight size={12} className="text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}