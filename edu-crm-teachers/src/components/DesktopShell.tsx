import type { ReactNode } from "react"

interface NavItem {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
  badge?: ReactNode
}

const NAV_ICONS: Record<string, ReactNode> = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v8a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  groups: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  salary: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  tasks: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  attendance: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
}

function DesktopShell({
  activeKey,
  navItems,
  onLogout,
  headerActions,
  children,
}: {
  activeKey: string
  navItems: NavItem[]
  onLogout?: () => void
  headerActions?: ReactNode
  children: ReactNode
}) {
  const emp = JSON.parse(localStorage.getItem("employee") || "{}")
  const initials = ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase()
  const activeNav = navItems.find((i) => i.key === activeKey)

  return (
    <div className="hidden md:block min-h-screen bg-[#f8fafc]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-[260px] bg-white border-r border-gray-200 fixed top-0 left-0 h-screen z-50 flex flex-col">
          <div className="px-4 pt-[18px] pb-[18px] border-b border-gray-200 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
              ET
            </div>
            <span className="font-bold text-[17px] text-slate-900 whitespace-nowrap">
              <span className="text-[#2563eb]">Edu</span> Tizim
            </span>
          </div>

          <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.8px] px-3.5 pt-3 pb-1">
              Asosiy
            </div>
            {navItems.map((item) => {
              const active = item.key === activeKey
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className={`flex items-center gap-3 w-full px-3.5 py-2.5 min-h-[38px] rounded-lg text-sm transition-all cursor-pointer border-none text-left mb-0.5 ${
                    active
                      ? "bg-[#eff6ff] text-[#2563eb] font-semibold"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  <span className={`shrink-0 ${active ? "text-[#2563eb]" : "text-slate-400"}`}>
                    {NAV_ICONS[item.key] || item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge}
                </button>
              )
            })}
          </nav>

          <div className="px-2.5 py-2 border-t border-gray-200">
            <button
              onClick={onLogout || (() => { localStorage.clear(); window.location.href = "/" })}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 min-h-[38px] rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer border-none text-left"
            >
              <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Chiqish
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 ml-[260px] flex flex-col min-w-0">
          <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 sticky top-0 z-40 gap-4">
            <div className="hidden lg:flex items-center gap-2">
              <div className="w-9 h-9 rounded-[10px] border border-gray-200 bg-white flex items-center justify-center text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-slate-800">
                <svg className="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
                IT House Akademiyasi
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            <div className="relative flex-1 max-w-[400px] ml-auto">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder={activeNav ? `${activeNav.label} ichidan qidirish...` : "Qidirish..."}
                className="w-full h-[38px] pl-10 pr-3.5 border border-gray-200 rounded-[10px] text-sm bg-[#f8fafc] outline-none focus:border-[#2563eb] focus:bg-white focus:ring-[3px] focus:ring-[#2563eb]/10"
              />
            </div>

            {headerActions && (
              <div className="flex items-center gap-3 shrink-0">{headerActions}</div>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <button className="w-9 h-9 rounded-[10px] flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer border-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </button>
              <button className="w-9 h-9 rounded-[10px] bg-[#2563eb] text-white flex items-center justify-center text-sm font-bold">
                {initials || "A"}
              </button>
            </div>
          </header>

          <div className="px-8 pt-7 pb-10 flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default DesktopShell
