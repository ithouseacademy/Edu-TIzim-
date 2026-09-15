import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Languages,
  LogOut,
  Palette,
  Smile,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { api } from "../api"
import type { StudentProfile } from "../types"
import { useAppSettings, type Lang, type Theme } from "../AppSettings"

const LANGUAGES = [
  { value: "uz", label: "O'zbekcha" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
]

const THEMES = [
  { value: "light", label: "Yorug'" },
  { value: "dark", label: "Tunli" },
]

function Sheet<T extends string>({
  open,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean
  title: string
  options: { value: T; label: string }[]
  selected: string
  onSelect: (v: T) => void
  onClose: () => void
}) {
  const { tr } = useAppSettings()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl pb-6 pt-3 animate-slide-up">
        <div className="px-5 pb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-gray-900">{tr(title)}</h3>
          <button onClick={onClose} className="btn-hover" aria-label={tr("Yopish")}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onSelect(o.value)
                onClose()
              }}
              className="w-full flex items-center justify-between px-5 py-4 btn-hover"
            >
              <span className={`text-[15px] font-semibold ${selected === o.value ? "text-[#0868E8]" : "text-gray-900"}`}>
                {tr(o.label)}
              </span>
              {selected === o.value && <Check size={18} className="text-[#0868E8]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { lang, theme, avatar, setLang, setTheme, toast, tr } = useAppSettings()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [langOpen, setLangOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  useEffect(() => {
    api.profile()
      .then((res) => setStudent(res.student))
      .catch(() => {})
  }, [])

  const name = [student?.first_name, student?.last_name].filter(Boolean).join(" ") || tr("IT House Talaba")
  const phone = student?.phone || ""
  const langLabel = LANGUAGES.find((l) => l.value === lang)?.label || "O'zbekcha"
  const themeLabel = tr(THEMES.find((t) => t.value === theme)?.label || "Yorug'")

  const handleLogout = () => {
    localStorage.removeItem("student_token")
    navigate("/", { replace: true })
  }

  const handleDelete = () => {
    toast(tr("Profilni o'chirish hali mavjud emas"))
  }

  const handleFilial = () => {
    toast(tr("Filial tanlash hali mavjud emas"))
  }

  const handleComingSoon = () => {
    toast(tr("Bu bo'lim hali mavjud emas"))
  }

  return (
    <div className="min-h-screen bg-[#F2F3F7] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white px-5 pt-3 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/profile")} className="btn-hover" aria-label={tr("Orqaga")}>
          <ArrowLeft size={20} className="text-gray-900" />
        </button>
        <h1 className="text-[19px] font-bold text-gray-900 tracking-tight">{tr("Sozlamalar")}</h1>
      </header>

      {/* Content */}
      <div className="flex-1 px-5 pt-5 pb-8">
        {/* Profile card -> Mening ma'lumotlarim */}
        <button
          onClick={() => navigate("/profile/settings/info")}
          className="w-full bg-white rounded-3xl px-4 py-5 flex items-center gap-3 btn-hover transition-all"
        >
          <div className="w-[56px] h-[56px] rounded-full bg-[#0868E8] flex items-center justify-center shrink-0 overflow-hidden">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Smile size={28} className="text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[16px] font-bold text-gray-900 truncate">{name}</p>
            <p className="text-[12px] text-gray-400 font-normal mt-0.5 truncate">{phone}</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </button>

        {/* Main settings card */}
        <div className="mt-4 bg-white rounded-3xl divide-y divide-[#F2F3F7] overflow-hidden">
          <button onClick={handleFilial} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <Building2 size={18} className="text-gray-900 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-gray-900">{tr("Filial")}</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">IT House Academy - IT House Academy</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
          <button onClick={() => setLangOpen(true)} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <Languages size={18} className="text-gray-900 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-gray-900">{tr("Til")}</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{langLabel}</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
          <button onClick={() => setThemeOpen(true)} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <Palette size={18} className="text-gray-900 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-gray-900">{tr("Mavzu")}</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{themeLabel}</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
          <button onClick={handleComingSoon} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <Star size={18} className="text-gray-900 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-gray-900">{tr("Ilovani baholash")}</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
          <button onClick={handleComingSoon} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <FileText size={18} className="text-gray-900 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-gray-900">{tr("Oferta shartlari")}</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Danger/action card */}
        <div className="mt-4 bg-white rounded-3xl divide-y divide-[#F2F3F7] overflow-hidden">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <LogOut size={18} className="text-[#C6283D] shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-gray-900">{tr("Profildan chiqish")}</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
          <button onClick={handleDelete} className="w-full flex items-center gap-3 px-5 h-[56px] btn-hover transition-all">
            <Trash2 size={18} className="text-[#A71932] shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[14px] font-semibold text-[#A71932]">{tr("Profilni o'chirish")}</p>
            </div>
            <ChevronRight size={17} className="text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[13px] text-gray-400 mt-8">{tr("Versiya")} 1.0.9</p>
      </div>

      <Sheet
        open={langOpen}
        title="Tilni tanlang"
        options={LANGUAGES}
        selected={lang}
        onSelect={(v) => {
          setLang(v as Lang)
        }}
        onClose={() => setLangOpen(false)}
      />
      <Sheet
        open={themeOpen}
        title="Mavzuni tanlang"
        options={THEMES}
        selected={theme}
        onSelect={(v) => {
          setTheme(v as Theme)
        }}
        onClose={() => setThemeOpen(false)}
      />
    </div>
  )
}