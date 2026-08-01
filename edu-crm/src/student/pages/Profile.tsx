import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronRight, Menu, Wallet, TrendingUp,
  Clock, BookOpen, Copy, Settings, MessageCircle, Heart,
} from "lucide-react"
import { api } from "../api"
import { useDrawer } from "../context/DrawerContext"
import type { StudentProfile, GroupInfo, Transaction } from "../types"

const typeColors: Record<string, { bg: string; text: string; icon: any }> = {
  lesson: { bg: "bg-red-50", text: "text-red-600", icon: BookOpen },
  payment: { bg: "bg-green-50", text: "text-green-600", icon: TrendingUp },
  correction: { bg: "bg-amber-50", text: "text-amber-600", icon: Clock },
}

export default function Profile() {
  const navigate = useNavigate()
  const { open: openDrawer } = useDrawer()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    api.profile().then((res) => {
      setStudent(res.student)
      setGroups(res.groups)
      setTransactions(res.transactions || [])
    }).catch(() => {})
  }, [])

  if (!student) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] pb-24 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
      </div>
    )
  }

  const initials = (student.first_name?.charAt(0) || "") + (student.last_name?.charAt(0) || "")
  const isPositive = (student.balance ?? 0) >= 0
  const balanceColor = isPositive ? "text-green-600" : "text-red-600"
  const balanceBg = isPositive ? "bg-green-50" : "bg-red-50"

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-24 animate-page-enter">
      <div className="max-w-lg mx-auto px-4 pt-12">
        <header className="flex items-center justify-between mb-5">
          <button
            onClick={openDrawer}
            className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm btn-hover"
          >
            <Menu size={20} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Profil</h1>
          <div className="w-10 h-10" />
        </header>

        <section className="mb-5 animate-scale-in">
          <div className="card-premium p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-[20px] flex items-center justify-center shadow-lg shadow-[#2001FF]/20">
                  <span className="text-2xl font-bold text-white">{initials || "O"}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-2 border-white rounded-full" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {student.first_name} {student.last_name}
                </h2>
                <p className="text-sm font-medium text-gray-400 mt-0.5">{student.phone}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`px-3 py-1.5 rounded-xl ${balanceBg}`}>
                    <span className={`text-sm font-bold ${balanceColor}`}>
                      {student.balance_str || "0 so'm"}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-400">
                    {isPositive ? "Balans" : "Qarz"}
                  </span>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300" />
            </div>
          </div>
        </section>

        <section className="mb-5 animate-scale-in" style={{ animationDelay: "80ms" }}>
          <h3 className="text-sm font-bold text-gray-900 mb-3">So'nggi tranzaksiyalar</h3>
          <div className="card-premium divide-y divide-gray-50 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Wallet size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-400">Tranzaksiyalar mavjud emas</p>
              </div>
            ) : (
              transactions.slice(0, 10).map((t) => {
                const cfg = typeColors[t.type] || typeColors.correction
                const Icon = cfg.icon
                return (
                  <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {t.type_display}
                        {t.group ? ` - ${t.group}` : ""}
                      </p>
                      {t.description && (
                        <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate">{t.description}</p>
                      )}
                      <p className="text-[10px] font-medium text-gray-400 mt-0.5">{t.created_at}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount_str}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="mb-5 animate-scale-in" style={{ animationDelay: "160ms" }}>
          <div className="card-premium divide-y divide-gray-50 overflow-hidden">
            <button
              onClick={() => { navigator.clipboard?.writeText(String(student.id)) }}
              className="w-full flex items-center justify-between px-5 py-4 btn-hover hover:bg-gray-50/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Copy size={18} className="text-gray-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">User ID nusxalash</span>
              </div>
              <Copy size={14} className="text-gray-300" />
            </button>
          </div>
        </section>

        {groups.length > 0 && (
          <section className="mb-5 animate-scale-in" style={{ animationDelay: "240ms" }}>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Guruhlarim</h3>
            <div className="space-y-2.5">
              {groups.map((g, idx) => {
                const colors = [
                  "from-[#2001FF] to-[#4361FF]",
                  "from-emerald-400 to-emerald-500",
                  "from-violet-400 to-violet-500",
                  "from-amber-400 to-amber-500",
                ]
                return (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/lesson/${g.id}`)}
                    className="card-premium-sm p-4 flex items-center gap-3 w-full text-left btn-hover"
                  >
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center shrink-0 shadow-sm`}>
                      <span className="text-base font-bold text-white">{g.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{g.name}</p>
                      <p className="text-[11px] font-medium text-gray-400 mt-0.5">{g.course}</p>
                      {g.lesson_times && g.lesson_times.length > 0 && (
                        <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                          {g.lesson_times.map(lt => `${lt.days} ${lt.start_time}-${lt.end_time}`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold text-gray-500">{g.teacher}</p>
                      <p className="text-[11px] font-medium text-gray-400">{g.room}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="mb-5 animate-scale-in" style={{ animationDelay: "320ms" }}>
          <div className="card-premium divide-y divide-gray-50 overflow-hidden">
            <button className="w-full flex items-center justify-between px-5 py-4 btn-hover hover:bg-gray-50/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Settings size={18} className="text-gray-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Sozlamalar</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between px-5 py-4 btn-hover hover:bg-gray-50/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <MessageCircle size={18} className="text-indigo-500" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Takliflar</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between px-5 py-4 btn-hover hover:bg-gray-50/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                  <Heart size={18} className="text-rose-500" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Do'stni taklif qilish</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
