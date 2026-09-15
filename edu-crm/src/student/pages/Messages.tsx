import { useCallback, useEffect, useState } from "react"
import { MessageCircle, Search, Plus, Users, UserPlus, X } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import { useMessagingSettings } from "../messaging"
import ChatWindow from "../components/ChatWindow"
import type { ChatInfo, SearchUser } from "../types"

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return `hsl(${h},58%,48%)`
}
function initials(name: string) {
  if (!name) return "?"
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase()
}
function timeStr(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m}`
}
function mediaLabel(t: string) {
  if (t === "photo") return "📷"
  if (t === "video") return "🎬"
  if (t === "voice") return "🎤"
  if (t === "file") return "📎"
  return ""
}

export default function Messages() {
  const { tr } = useAppSettings()
  const settings = useMessagingSettings()
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [loadingChats, setLoadingChats] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [mode, setMode] = useState<"private" | "group">("private")
  const [chatTitle, setChatTitle] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const loadChats = useCallback(() => {
    api
      .messengerChats()
      .then((d) => setChats(d.chats || []))
      .catch(() => {})
      .finally(() => setLoadingChats(false))
  }, [])

  useEffect(() => {
    loadChats()
    const t = setInterval(() => {
      if (!document.hidden) loadChats()
    }, 5000)
    return () => clearInterval(t)
  }, [loadChats])

  const openChat = (id: number) => {
    setSelectedId(id)
    setMobileShowChat(true)
  }

  const goBack = () => {
    setMobileShowChat(false)
    setTimeout(() => setSelectedId(null), 300)
  }

  const filtered = chats.filter((c) =>
    (c.title || "").toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!showNew) return
    if (mode === "private") {
      api
        .searchMessagingUsers(query)
        .then((d) => setResults(d.results || []))
        .catch(() => setResults([]))
    } else {
      api
        .myStudyGroups()
        .then((d) => {
          setResults(
            (d.groups || []).map((g) => ({
              id: g.id,
              kind: "group",
              name: g.name,
              username: "",
              phone: "",
              initials: "G",
            }))
          )
        })
        .catch(() => setResults([]))
    }
  }, [showNew, mode, query])

  const toggleSel = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const startChat = () => {
    const ids = Array.from(selectedIds)
    if (mode === "private") {
      if (!ids.length) return
      api
        .openPrivateChat(ids[0])
        .then((d) => {
          setShowNew(false)
          openChat(d.chat.id)
        })
        .catch(() => {})
    } else {
      if (!chatTitle.trim()) return
      api
        .openGroupChat({ title: chatTitle.trim(), student_ids: ids })
        .then((d) => {
          setShowNew(false)
          openChat(d.chat.id)
        })
        .catch(() => {})
    }
  }

  if (settings && !settings.enabled) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] pb-20">
        <div className="max-w-lg mx-auto px-4 pt-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageCircle size={28} className="text-gray-400" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">{tr("Xabarlar")}</h1>
          <p className="text-sm text-gray-400 max-w-xs">{tr("Xabarlar hozircha yopiq")}</p>
          <p className="text-xs text-gray-300">{tr("Admin xabarlar bo'limini vaqtincha yopdi")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-16 md:pb-0">
      <div className="max-w-5xl mx-auto px-1.5 md:px-2.5 pt-6 md:pt-3" style={{ height: "calc(100vh - 60px)" }}>
        <div className="bg-white md:rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden flex h-full">
          {/* Sidebar */}
          <div
            className={`w-full md:w-[300px] lg:w-[320px] flex-shrink-0 flex flex-col border-r border-gray-100 ${
              mobileShowChat ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageCircle size={17} className="text-[#2001FF]" />
                  <span className="text-sm font-bold text-gray-900">{tr("Xabarlar")}</span>
                </div>
                <button
                  onClick={() => {
                    setShowNew(true)
                    setMode("private")
                    setQuery("")
                    setSelectedIds(new Set())
                    setChatTitle("")
                  }}
                  className="w-8 h-8 rounded-full bg-[#2001FF] flex items-center justify-center text-white btn-scale"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr("Qidirish...")}
                  className="w-full h-9 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#2001FF]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
              {loadingChats && (
                <div className="text-center text-xs text-gray-400 py-10">{tr("Yuklanmoqda...")}</div>
              )}
              {!loadingChats && !filtered.length && (
                <div className="text-center text-xs text-gray-400 py-10">{tr("Suhbatlar yo'q")}</div>
              )}
              {filtered.map((c) => {
                const last = c.last_message
                const lastText = last
                  ? (last.media_type !== "text" && mediaLabel(last.media_type)
                      ? mediaLabel(last.media_type) + " "
                      : "") + (last.text || " ")
                  : tr("Xabarlar yo'q")
                return (
                  <button
                    key={c.id}
                    onClick={() => openChat(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${
                      selectedId === c.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: avatarColor(c.title || String(c.id)) }}
                    >
                      {initials(c.title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-gray-900 truncate">
                          {c.title}
                        </span>
                        {last && (
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {timeStr(last.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400 truncate">{lastText}</span>
                        {c.unread_count > 0 && (
                          <span className="min-w-[18px] h-[18px] bg-[#2001FF] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1 shrink-0">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main / Chat */}
          <div
            className={`flex-1 min-w-0 ${
              !mobileShowChat && !selectedId ? "hidden md:flex" : "flex"
            } ${mobileShowChat ? "flex" : "hidden md:flex"} flex-col`}
          >
            {selectedId ? (
              <ChatWindow
                key={selectedId}
                chatId={selectedId}
                onBack={goBack}
                onChatsUpdate={loadChats}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#EEF1F5] text-gray-400">
                <MessageCircle size={48} className="opacity-30" />
                <span className="text-sm font-medium">{tr("Chat tanlanmagan")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New chat modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">
                {tr("Yangi suhbat")}
              </h3>
              <button onClick={() => setShowNew(false)} className="p-1 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => { setMode("private"); setSelectedIds(new Set()); setQuery("") }}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition ${
                    mode === "private"
                      ? "bg-[#2001FF]/5 border-[#2001FF] text-[#2001FF]"
                      : "bg-white border-gray-200 text-gray-500"
                  }`}
                >
                  {tr("Shaxsiy chat")}
                </button>
                <button
                  onClick={() => { setMode("group"); setSelectedIds(new Set()); setQuery(""); setChatTitle("") }}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition ${
                    mode === "group"
                      ? "bg-[#2001FF]/5 border-[#2001FF] text-[#2001FF]"
                      : "bg-white border-gray-200 text-gray-500"
                  }`}
                >
                  {tr("Guruh chat")}
                </button>
              </div>

              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={mode === "group" ? tr("Guruh nomi") + "... " : tr("Qidirish...")}
                  className="w-full h-9 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#2001FF]"
                />
              </div>

              {mode === "group" && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={chatTitle}
                    onChange={(e) => setChatTitle(e.target.value)}
                    placeholder={tr("Guruh nomi")}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#2001FF]"
                  />
                  {selectedIds.size > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Array.from(selectedIds).map((id) => {
                        const r = results.find((x) => String(x.id) === String(id))
                        return r ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-[#2001FF]/10 text-[#2001FF] text-[10px] font-semibold rounded-full px-2 py-0.5"
                          >
                            {r.name}
                            <button onClick={() => toggleSel(id)} className="ml-0.5">
                              <X size={10} />
                            </button>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {results.map((r) => {
                  const sel = selectedIds.has(r.id)
                  return mode === "group" ? (
                    <button
                      key={`${r.kind}-${r.id}`}
                      onClick={() => toggleSel(r.id)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition ${
                        sel ? "bg-[#2001FF]/5" : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                        style={{ background: avatarColor(r.name) }}
                      >
                        {r.kind === "group" ? <Users size={14} /> : initials(r.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-gray-900 truncate">{r.name}</div>
                        {r.kind !== "group" && (
                          <div className="text-[10.5px] text-gray-400">
                            {r.username ? `@${r.username}` : r.phone || ""}
                          </div>
                        )}
                      </div>
                      <UserPlus size={14} className={sel ? "text-[#2001FF]" : "text-gray-300"} />
                    </button>
                  ) : (
                    <button
                      key={`${r.kind}-${r.id}`}
                      onClick={() => {
                        api
                          .openPrivateChat(r.id)
                          .then((d) => {
                            setShowNew(false)
                            openChat(d.chat.id)
                          })
                          .catch(() => {})
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left hover:bg-gray-50 transition"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                        style={{ background: avatarColor(r.name) }}
                      >
                        {initials(r.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-gray-900 truncate">{r.name}</div>
                        <div className="text-[10.5px] text-gray-400">
                          {r.username ? `@${r.username}` : r.phone || ""}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {!results.length && (
                  <div className="text-center text-[11px] text-gray-400 py-4">{tr("Natija yo'q")}</div>
                )}
              </div>
            </div>
            {mode === "group" && (
              <div className="p-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={startChat}
                  disabled={!chatTitle.trim()}
                  className="px-5 py-2 bg-[#2001FF] text-white text-[12px] font-semibold rounded-xl disabled:opacity-50 btn-scale"
                >
                  {tr("Boshla")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}