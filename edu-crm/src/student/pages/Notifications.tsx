import { Bell, BookOpen, CalendarCheck, AlertTriangle, CreditCard, Megaphone, RefreshCw } from "lucide-react"

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
  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5">
        <div className="flex items-center justify-between mb-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2001FF]/10 rounded-xl">
              <Bell size={20} className="text-[#2001FF]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Bildirishnomalar</h1>
              <p className="text-xs text-gray-500">So'nggi yangiliklar</p>
            </div>
          </div>
          <div className="relative">
            <Bell size={22} className="text-gray-400" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
              {notifications.length}
            </span>
          </div>
        </div>

        <div className="space-y-2 animate-slide-up">
          {notifications.map((n, idx) => {
            const Icon = n.icon
            return (
              <div
                key={n.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className={`p-2.5 rounded-xl ${n.bg} shrink-0`}>
                  <Icon size={20} className={n.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{n.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{n.desc}</p>
                </div>
                <div className="w-1.5 h-1.5 bg-[#2001FF] rounded-full mt-2 shrink-0" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
