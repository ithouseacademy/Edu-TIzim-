import { useState } from "react"
import { MessageCircle, Search, ChevronRight, Clock } from "lucide-react"

const chats = [
  { id: 1, name: "Mr. Khan", role: "Matematika o'qituvchisi", lastMsg: "Ertaga imtihon 10:00 da", time: "5 min", unread: 2, online: true, avatar: "K" },
  { id: 2, name: "Javlon", role: "Ingliz tili o'qituvchisi", lastMsg: "Homework check tomorrow", time: "1 soat", unread: 0, online: true, avatar: "J" },
  { id: 3, name: "Azizjon", role: "Fizika o'qituvchisi", lastMsg: "Laboratoriya ishi №5", time: "3 soat", unread: 0, online: false, avatar: "A" },
  { id: 4, name: "Zarina", role: "Kimyo o'qituvchisi", lastMsg: "Rahmat! 😊", time: "1 kun", unread: 1, online: false, avatar: "Z" },
  { id: 5, name: "Guruh: Frontend", role: "14:00 - 16:00", lastMsg: "Azizjon: Keyingi darsga 5-bobni o'qing", time: "2 kun", unread: 0, online: false, avatar: "F" },
]

export default function Messages() {
  const [search, setSearch] = useState("")

  const filtered = chats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-14">
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2001FF]/10 rounded-xl">
              <MessageCircle size={22} className="text-[#2001FF]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Messages</h1>
              <p className="text-xs text-gray-400 font-medium">O'qituvchilar bilan suhbat</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs text-gray-400 font-medium">Online</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4 animate-fade-in">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className="w-full h-[52px] pl-11 pr-4 bg-white border-2 border-gray-200 rounded-[18px] text-sm font-medium focus:outline-none transition-all duration-300 focus:border-[#2001FF] focus:shadow-[0_0_0_3px_rgba(32,1,255,0.1),0_0_20px_rgba(32,1,255,0.05)]"
          />
        </div>

        {/* Chat List */}
        <div className="space-y-1.5 animate-slide-up">
          {filtered.map((chat) => (
            <div
              key={chat.id}
              className="bg-white rounded-[22px] p-4 card-shadow card-shadow-hover transition-all cursor-pointer btn-scale"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    chat.online ? "bg-gradient-to-br from-[#2001FF] to-[#4361FF]" : "bg-gray-400"
                  }`}>
                    {chat.avatar}
                  </div>
                  {chat.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">{chat.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-medium">{chat.time}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">{chat.role}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-500 truncate flex-1">{chat.lastMsg}</p>
                    {chat.unread > 0 && (
                      <span className="ml-2 w-4 h-4 bg-[#2001FF] rounded-full flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-white">{chat.unread}</span>
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
