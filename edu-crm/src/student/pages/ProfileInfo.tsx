import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Smile, X, Check, Camera } from "lucide-react"
import { api } from "../api"
import type { StudentProfile } from "../types"
import { useAppSettings } from "../AppSettings"

const MONTHS_UZ = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr",
]

function formatBirthDate(iso: string | undefined, tr: (k: string) => string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} ${tr(MONTHS_UZ[d.getMonth()])} ${d.getFullYear()}`
}

export default function ProfileInfo() {
  const navigate = useNavigate()
  const { avatar, setAvatar, tr } = useAppSettings()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [birthDate, setBirthDate] = useState("")
  const [editing, setEditing] = useState(false)
  const [stagedAvatar, setStagedAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.profile()
      .then((res) => {
        setStudent(res.student)
        setBirthDate(res.student.birth_date || "")
      })
      .catch(() => {})
  }, [])

  const canSave = editing || stagedAvatar !== null

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setStagedAvatar(reader.result)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setError("")
    try {
      if (stagedAvatar) {
        setAvatar(stagedAvatar)
        setStagedAvatar(null)
      }
      if (editing) {
        const res = await api.updateProfile(birthDate)
        setBirthDate(res.birth_date)
        setEditing(false)
      }
      setOk(true)
      setTimeout(() => setOk(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Xatolik yuz berdi"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Top app bar */}
      <header className="px-5 pt-3 pb-3 h-16 flex items-center justify-between">
        <button onClick={() => navigate("/profile/settings")} className="btn-hover" aria-label={tr("Orqaga")}>
          <ArrowLeft size={22} className="text-gray-900" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold text-gray-900 tracking-tight">
          {tr("Mening ma'lumotlarim")}
        </h1>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className={`text-[14px] font-semibold btn-hover ${
            canSave ? "text-[#0868E8]" : "text-[#0868E8]/40 cursor-default"
          }`}
        >
          {saving ? "..." : tr("Saqlash")}
        </button>
      </header>

      {/* Profile section */}
      <div className="flex flex-col items-center mt-4">
        <div className="relative">
          <div className="w-[110px] h-[110px] rounded-full bg-[#0868E8] flex items-center justify-center overflow-hidden">
            {stagedAvatar ? (
              <img src={stagedAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Smile size={60} className="text-white" />
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#0868E8] border-2 border-white flex items-center justify-center btn-hover"
            aria-label={tr("Avatarni o'zgartirish")}
          >
            <Camera size={14} className="text-white" />
          </button>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-4 px-5 py-2.5 bg-[#0868E8] rounded-full text-white text-[13px] font-semibold btn-hover"
        >
          {tr("Avatarni o'zgartirish")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
      </div>

      {/* Form fields */}
      <div className="px-5 mt-7">
        {[
          { label: tr("Ism"), value: student?.first_name || "" },
          { label: tr("Familiya"), value: student?.last_name || "" },
          { label: tr("Telefon raqami"), value: student?.phone || "" },
        ].map((f) => (
          <div key={f.label} className="py-3.5">
            <p className="text-[13px] text-gray-400">{f.label}</p>
            <p className="text-[16px] font-bold text-gray-900 mt-0.5">{f.value}</p>
          </div>
        ))}

        {/* Tug'ilgan sana: editable */}
        <div className="py-3.5">
          <p className="text-[13px] text-gray-400">{tr("Tug'ilgan sana")}</p>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="text-[16px] font-bold text-[#0868E8] bg-gray-50 rounded-xl px-3 py-1.5 outline-none"
              />
              <button
                onClick={() => {
                  setEditing(false)
                  setError("")
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center btn-hover shrink-0"
                aria-label={tr("Bekor qilish")}
              >
                <X size={14} className="text-gray-600" />
              </button>
              <button
                onClick={handleSave}
                className="w-8 h-8 rounded-full bg-[#0868E8] flex items-center justify-center btn-hover shrink-0"
                aria-label={tr("Saqlash")}
              >
                <Check size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 mt-1 btn-hover text-left">
              <span className={`text-[16px] font-bold ${birthDate ? "text-gray-900" : "text-[#0868E8]"}`}>
                {formatBirthDate(birthDate, tr) || tr("Tanlash")}
              </span>
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-5 text-[12px] text-red-600 mt-1">{error}</p>}
      {ok && <p className="px-5 text-[12px] text-green-600 mt-1 font-medium">{tr("Ma'lumotlar saqlandi.")}</p>}

      <div className="flex-1" />

      {/* Android navigation bar */}
      <div className="bg-[#17181C] h-9 flex items-center justify-center gap-16">
        <div className="w-5 h-2 rounded-full border-[1.5px] border-white/70 rotate-45" />
        <div className="w-7 h-2 rounded-sm border-[1.5px] border-white/70" />
        <div className="w-3.5 h-3.5 rotate-45 border-[1.5px] border-white/70 rounded-[3px]" />
      </div>
    </div>
  )
}