import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Zap, History, Crown } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { LeadeboardItem } from "../types"

const FALLBACK_LIST: LeadeboardItem[] = [
  { rank: 1, student_id: -1, student_name: "Ro'zimuhammad Adxamov", phone: "", score: 0 },
  { rank: 2, student_id: -2, student_name: "Kozimov Javohir", phone: "", score: 0 },
  { rank: 3, student_id: -3, student_name: "Mamarasulov Raxmatullo", phone: "", score: 0 },
  { rank: 4, student_id: -4, student_name: "Foziljonov Mavludbek", phone: "", score: 0 },
  { rank: 5, student_id: -5, student_name: "Hoshimjonov Fazliddin", phone: "", score: 0 },
  { rank: 6, student_id: -6, student_name: "Faxriddin Hayitov", phone: "", score: 50 },
]

type Tab = "guruh" | "all"

const medal = [
  {
    ring: "ring-4 ring-amber-300/70",
    gra: "linear-gradient(135deg,#FFD76A,#F6B73C)",
    Icon: Crown,
  },
  {
    ring: "ring-4 ring-slate-200/80",
    gra: "linear-gradient(135deg,#E2E8F0,#C7D0DC)",
    Icon: Crown,
  },
  {
    ring: "ring-4 ring-orange-200/80",
    gra: "linear-gradient(135deg,#E4B98B,#C98A5B)",
    Icon: Crown,
  },
]

function Avatar({ name, size, className, src }: { name: string; size: number; className?: string; src?: string | null }) {
  const letter = (name.trim().charAt(0) || "?").toUpperCase()
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-[#1464F4] to-[#4A90FF] flex items-center justify-center text-white font-bold shrink-0 overflow-hidden ${className || ""}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
}

export default function CoinsPage() {
  const navigate = useNavigate()
  const { avatar } = useAppSettings()
  const [myName, setMyName] = useState("")
  const [myPhoto, setMyPhoto] = useState<string | null>(null)
  const [items, setItems] = useState<LeadeboardItem[]>(FALLBACK_LIST)
  const [tab, setTab] = useState<Tab>("guruh")
  const [myScore, setMyScore] = useState(12)
  const [myRank, setMyRank] = useState(1820)
  const [groupId, setGroupId] = useState<number | undefined>()

  useEffect(() => {
    api
      .profile()
      .then((res) => {
        const first = res.student.first_name || ""
        const last = res.student.last_name || ""
        setMyName(`${first} ${last}`.trim() || "Humoyun Mamasodiqov")
        setMyPhoto(res.student.photo || null)
        const g = res.groups?.find((x) => x.id)
        setGroupId(g?.id)
      })
      .catch(() => setMyName("Humoyun Mamasodiqov"))
  }, [])

  useEffect(() => {
    let alive = true
    api
      .coinLeaderboard("all", tab === "guruh" ? groupId : undefined)
      .then((d) => {
        if (!alive) return
        const list = d.leaderboard.length ? d.leaderboard : FALLBACK_LIST
        setItems(list)
        if (typeof d.my_rank === "number") setMyRank(d.my_rank)
        if (typeof d.my_score === "number") setMyScore(d.my_score)
      })
      .catch(() => {
        if (alive) setItems(FALLBACK_LIST)
      })
    return () => {
      alive = false
    }
  }, [tab, groupId])

  const top3 = [1, 0, 2].map((i) => items[i]).filter(Boolean)
  const rest = items.slice(3)
  const maxScore = Math.max(...items.map((i) => i.score), 1)
  const progress = Math.min(100, Math.max(4, Math.round((myScore / maxScore) * 100)))
  const listTitle = tab === "guruh" ? "Guruh bo'yicha" : "O'quv markaz bo'yicha"

  const tabs: { key: Tab; label: string }[] = [
    { key: "guruh", label: "Guruh" },
    { key: "all", label: "Barcha filiallar" },
  ]

  return (
    <div className="min-h-[100dvh] bg-[#F4F7FB] text-[#1B1B1F] pb-28 animate-page-enter relative overflow-x-hidden font-sans">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[360px] rounded-full bg-gradient-to-b from-[#DBEBFF] to-transparent blur-2xl pointer-events-none" />
      <div className="absolute top-40 -right-24 w-72 h-72 rounded-full bg-[#E7F1FF] blur-2xl pointer-events-none" />

      <div className="relative max-w-md mx-auto px-4 pt-5">
        <header className="flex items-center justify-between mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm btn-hover" aria-label="Orqaga">
            <ArrowLeft size={20} className="text-[#1B1B1F]" />
          </button>
          <h1 className="text-[17px] font-bold text-[#1B1B1F] tracking-tight">Koinlar</h1>
          <button onClick={() => navigate("/profile/transactions")} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm btn-hover" aria-label="Tarix">
            <History size={19} className="text-[#1B1B1F]" />
          </button>
        </header>

        <section className="rounded-3xl p-5 shadow-[0_8px_30px_rgba(20,100,244,0.10)] relative overflow-hidden animate-scale-in"
          style={{ background: "linear-gradient(150deg,#FFFFFF 0%,#EAF3FF 55%,#DCEAFF 100%)" }}
        >
          <div className="flex items-center gap-4">
            <Avatar name={myName} size={58} src={myPhoto || avatar} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#12141A] leading-tight truncate">{myName}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex items-center gap-1 text-[12px] font-bold text-[#1464F4]">
                  <Zap size={13} className="text-[#F6B73C]" fill="currentColor" />
                  {myScore} coin
                </div>
                <span className="w-1 h-1 rounded-full bg-[#B7C6DE]" />
                <span className="text-[12px] font-semibold text-[#8296B4]">Eng faol o'quvchi</span>
              </div>
            </div>
            <div className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white/90 border border-[#1464F4]/15 shadow-sm">
              <span className="text-[12px] font-extrabold text-[#1464F4]">#{myRank.toLocaleString("ru-RU")}</span>
            </div>
          </div>

          <div className="mt-4 h-1.5 rounded-full bg-white/90 shadow-inner overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1464F4] to-[#5AAEF5]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/80 border border-[#1464F4]/10">
            {tabs.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 btn-hover ${
                    active ? "bg-[#1464F4] text-white shadow-md shadow-[#1464F4]/25" : "text-[#6E7FA0]"
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-5 mb-5 animate-scale-in stagger-1">
          <div className="flex items-end justify-center gap-3">
            {top3.map((u, i) => {
              const rank = top3[i] ? [2, 1, 3][i] : 0
              const spec = medal[rank - 1] || medal[0]
              const isFirst = rank === 1
              return (
                <div
                  key={u.student_id + i}
                  className={`flex-1 rounded-3xl bg-white p-4 flex flex-col items-center text-center shadow-sm ${
                    isFirst
                      ? "shadow-[0_12px_30px_rgba(246,183,60,0.25)] ring-2 ring-amber-300/70 -mt-4"
                      : "shadow-[0_6px_20px_rgba(20,100,244,0.06)]"
                  }`}
                >
                  <div className="relative mb-2.5">
                    <Avatar name={u.student_name} size={isFirst ? 64 : 58} className={spec.ring} />
                    <div
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                      style={{ background: spec.gra }}
                    >
                      <Crown size={13} className="text-white" fill="white" />
                    </div>
                  </div>
                  <p className="text-[13px] font-extrabold text-[#12141A] leading-tight line-clamp-2 h-8 flex items-center justify-center">
                    {u.student_name}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Zap size={11} className="text-[#F6B73C]" fill="currentColor" />
                    <span className="text-[12px] font-bold text-[#5B6B8C]">{u.score} coin</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {rest.length > 0 && (
          <section className="rounded-3xl bg-white shadow-[0_6px_24px_rgba(20,100,244,0.06)] p-5 animate-scale-in stagger-2">
            <h2 className="text-[14px] font-bold text-[#12141A] mb-3">{listTitle}</h2>
            <div className="divide-y divide-[#EFF3F9]">
              {rest.map((u) => (
                <div key={u.rank} className="flex items-center gap-3 py-3">
                  <div className="w-8 shrink-0 text-[13px] font-bold text-[#B0BFD4] tabular-nums">
                    {String(u.rank).padStart(2, "0")}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#EAF3FF] flex items-center justify-center text-[11px] font-bold text-[#1464F4] shrink-0">
                    {initials(u.student_name)}
                  </div>
                  <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#1B1B1F] truncate">{u.student_name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <Zap size={11} className="text-[#F6B73C]" fill="currentColor" />
                    <span className="text-[13px] font-bold text-[#5B6B8C] tabular-nums">{u.score} coin</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
