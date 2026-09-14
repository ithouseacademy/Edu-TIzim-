import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronRight, Menu, Wallet, Settings, MessageCircle, Heart, Users,
} from "lucide-react"
import { api } from "../api"
import { useDrawer } from "../context/DrawerContext"
import type { StudentProfile, GroupInfo, Transaction } from "../types"

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
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center justify-between mb-3">
          <button
            onClick={openDrawer}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <Menu size={16} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Profil</h1>
          <div className="w-8 h-8" />
        </header>

        <section className="mb-3 animate-scale-in">
          <div className="card-premium p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-[#2001FF] to-[#4361FF] rounded-2xl flex items-center justify-center shadow-lg shadow-[#2001FF]/20">
                  <span className="text-lg font-bold text-white">{initials || "O"}</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900">
                  {student.first_name} {student.last_name}
                </h2>
                <p className="text-xs font-medium text-gray-400 mt-0.5">{student.phone}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className={`px-2 py-0.5 rounded-lg ${balanceBg}`}>
                    <span className={`text-xs font-bold ${balanceColor}`}>
                      {student.balance_str || "0 so'm"}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400">
                    {isPositive ? "Balans" : "Qarz"}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
        </section>

        <section className="mb-3 animate-scale-in" style={{ animationDelay: "40ms" }}>
          <button
            onClick={() => navigate("/profile/balance")}
            className="card-premium w-full px-3 py-3 flex items-center gap-2.5 btn-hover hover:bg-gray-50/50 transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-green-500" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-gray-900">Balans</p>
              <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                {student.balance_str || "0 so'm"}
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
          </button>
        </section>

        <section className="mb-3 animate-scale-in" style={{ animationDelay: "80ms" }}>
          <button
            onClick={() => navigate("/profile/transactions")}
            className="card-premium w-full px-3 py-3 flex items-center gap-2.5 btn-hover hover:bg-gray-50/50 transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-gray-900">So'nggi tranzaksiyalar</p>
              <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                {transactions.length > 0 ? `${transactions.length} ta tranzaksiya` : "Tranzaksiyalar mavjud emas"}
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
          </button>
        </section>

        {groups.length > 0 && (
          <section className="mb-3 animate-scale-in" style={{ animationDelay: "160ms" }}>
            <button
              onClick={() => navigate("/profile/groups")}
              className="card-premium w-full px-3 py-3 flex items-center gap-2.5 btn-hover hover:bg-gray-50/50 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Users size={15} className="text-violet-500" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-gray-900">Guruhlarim</p>
                <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                  {groups.length} ta guruh
                </p>
              </div>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </button>
          </section>
        )}

        <section className="mb-3 animate-scale-in" style={{ animationDelay: "240ms" }}>
          <div className="card-premium divide-y divide-gray-50 overflow-hidden">
            <button className="w-full flex items-center justify-between px-3 py-3 btn-hover hover:bg-gray-50/50 transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Settings size={15} className="text-gray-600" />
                </div>
                <span className="text-xs font-semibold text-gray-700">Sozlamalar</span>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 btn-hover hover:bg-gray-50/50 transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <MessageCircle size={15} className="text-indigo-500" />
                </div>
                <span className="text-xs font-semibold text-gray-700">Takliflar</span>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 btn-hover hover:bg-gray-50/50 transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Heart size={15} className="text-rose-500" />
                </div>
                <span className="text-xs font-semibold text-gray-700">Do'stni taklif qilish</span>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
