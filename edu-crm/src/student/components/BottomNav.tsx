import { useLocation, useNavigate } from "react-router-dom"
import { Home, CalendarDays, MessageCircle, User } from "lucide-react"

const tabs = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: CalendarDays, label: "Schedule", path: "/schedule" },
  { icon: MessageCircle, label: "Messages", path: "/messages" },
  { icon: User, label: "Profile", path: "/profile" },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100/80 safe-bottom shadow-[0_-4px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-around max-w-lg mx-auto px-4 py-1">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-4 min-w-0 transition-all duration-200 relative btn-scale"
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  active
                    ? "text-[#2001FF]"
                    : "text-[#9CA3AF]"
                }`}
              >
                <tab.icon
                  size={24}
                  strokeWidth={active ? 2.5 : 1.8}
                  className="transition-all duration-200"
                />
              </div>
              <span
                className={`text-[9px] font-semibold leading-none transition-all duration-200 ${
                  active ? "text-[#2001FF]" : "text-[#9CA3AF]"
                }`}
              >
                {tab.label}
              </span>
              {active && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#2001FF] rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
