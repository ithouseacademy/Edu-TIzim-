import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Users } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { GroupInfo } from "../types"

export default function GroupsPage() {
  const navigate = useNavigate()
  const { tr } = useAppSettings()
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.profile()
      .then((res) => setGroups(res.groups || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const colors = [
    "from-[#2001FF] to-[#4361FF]",
    "from-emerald-400 to-emerald-500",
    "from-violet-400 to-violet-500",
    "from-amber-400 to-amber-500",
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">{tr("Guruhlarim")}</h1>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="card-premium px-5 py-10 text-center">
            <Users size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-medium text-gray-400">{tr("Guruhlar mavjud emas")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g, idx) => (
              <button
                key={g.id}
                onClick={() => navigate(`/lesson/${g.id}`)}
                className="card-premium-sm p-3 flex items-center gap-2.5 w-full text-left btn-hover"
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center shrink-0 shadow-sm`}>
                  <span className="text-sm font-bold text-white">{g.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900">{g.name}</p>
                  <p className="text-[10px] font-medium text-gray-400 mt-0.5">{g.course}</p>
                  {g.lesson_times && g.lesson_times.length > 0 && (
                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                      {g.lesson_times.map(lt => `${lt.days} ${lt.start_time}-${lt.end_time}`).join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-gray-500">{g.teacher}</p>
                  <p className="text-[10px] font-medium text-gray-400">{g.room}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
