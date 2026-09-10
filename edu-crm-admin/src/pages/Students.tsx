import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Users, Search, Phone, ChevronRight } from "lucide-react"
import { api, loadEmployee } from "../api"
import type { StudentItem } from "../types"
import WaveHeader from "../components/WaveHeader"

const statusColors: Record<string, string> = {
  kutilyotgan: "bg-amber-50 text-amber-600",
  bitirilgan: "bg-blue-50 text-blue-600",
  chiqarilgan: "bg-red-50 text-red-600",
}

export default function Students() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  useEffect(() => {
    setLoading(true)
    api.students(search)
      .then((d) => setStudents(d.students))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [search])

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="O'quvchilar"
        leftSlot={
          <button className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover">
            <Users size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />
      <div className="max-w-lg mx-auto px-3">

        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium mb-3">{error}</div>
        )}

        <div className="mb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, familya yoki telefon..."
              className="w-full h-10 pl-9 pr-3 text-[13px] font-medium text-gray-900 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#2001FF] transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-gray-900">O'quvchilar</h2>
          <span className="text-[10px] font-semibold text-gray-400">{students.length} ta</span>
        </div>

        {loading ? (
          <div className="card-premium p-6 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="card-premium p-6 text-center">
            <Users size={22} className="mx-auto text-gray-300 mb-1.5" />
            <p className="text-xs font-medium text-gray-400">O'quvchilar topilmadi</p>
          </div>
        ) : (
          <div className="card-premium divide-y divide-gray-50 overflow-hidden">
            {students.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/students/${s.id}`)}
                className="px-3 py-2.5 flex items-center gap-2.5 animate-fade-in btn-hover cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-[#2001FF]/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[#2001FF]">
                    {(s.first_name[0] || "") + (s.last_name[0] || "")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-900 truncate">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1 truncate">
                    <Phone size={9} /> +998 {s.phone}
                  </p>
                  {s.groups_str && (
                    <p className="text-[9px] font-medium text-gray-400 truncate">{s.groups_str}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-bold ${Number(s.balance) < 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {s.balance_str}
                  </span>
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${statusColors[s.status] || "bg-gray-100 text-gray-500"}`}>
                    {s.status_display}
                  </span>
                </div>
                <ChevronRight size={14} className="text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
