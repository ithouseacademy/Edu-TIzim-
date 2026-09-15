import { Bell, BookOpen, CalendarCheck, AlertTriangle, CreditCard, Megaphone, RefreshCw } from "lucide-react"
import { useAppSettings } from "../AppSettings"

const notifications = [
  { id: 1, type: "assignment", title: "Yangi topshiriq", desc: "Matematika fanidan uy vazifasi berildi", time: "10 min oldin", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50" },
  { id: 2, type: "exam", title: "Imtixon eslatmasi", desc: "Ingliz tili imtixoni ertaga", time: "1 soat oldin", icon: CalendarCheck, color: "text-orange-500", bg: "bg-orange-50" },
  { id: 3, type: "attendance", title: "Davomat ogohlantirish", desc: "3 kun ketma-ket kelmadingiz", time: "2 soat oldin", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
  { id: 4, type: "lesson", title: "Yangi dars qo'shildi", desc: "Dushanba kuni 14:00 da fizika darsi", time: "1 kun oldin", icon: BookOpen, color: "text-purple-500", bg: "bg-purple-50" },
  { id: 5, type: "announcement", title: "O'qituvchi e'loni", desc: "Ertaga dars bo'lmaydi", time: "1 kun oldin", icon: Megaphone, color: "text-indigo-500", bg: "bg-indigo-50" },
  { id: 6, type: "payment", title: "To'lov eslatmasi", desc: "Oktabr oyi to'lovini amalga oshiring", time: "3 kun oldin", icon: CreditCard, color: "text-green-500", bg: "bg-green-50" },
  { id: 7, type: "system", title: "Tizim yangilanishi", desc: "Yangi qo'shimchalar bilan tanishing", time: "5 kun oldin", icon: RefreshCw, color: "text-gray-500", bg: "bg-gray-50" },
]

export default function Notifications() {
  const { tr } = useAppSettings()
  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-20">
      <div className="max-w-lg mx-auto px-2.5 pt-8">
        <div className="flex items-center justify-between mb-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#2001FF]/10 rounded-lg">
              <Bell size={16} className="text-[#2001FF]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">{tr("Bildirishnomalar")}</h1>
              <p className="text-[10px] text-gray-500">{tr("So'nggi yangiliklar")}</p>
            </div>
          </div>
          <div className="relative">
            <Bell size={17} className="text-gray-400" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm">
              {notifications.length}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 animate-slide-up">
          {notifications.map((n, idx) => {
            const Icon = n.icon
            return (
              <div
                key={n.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-start gap-2.5 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className={`p-2 rounded-lg ${n.bg} shrink-0`}>
                  <Icon size={16} className={n.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-900">{tr(n.title)}</h3>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{tr(n.time)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{tr(n.desc)}</p>
                </div>
                <div className="w-1 h-1 bg-[#2001FF] rounded-full mt-1.5 shrink-0" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
