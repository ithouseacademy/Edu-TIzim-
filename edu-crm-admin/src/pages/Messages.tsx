import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, MessageSquare, Paperclip, Send } from "lucide-react"
import { api, loadEmployee } from "../api"
import type { ChatDetail, ChatMessage, ChatSummary } from "../types"
import WaveHeader from "../components/WaveHeader"

const AVATAR_COLORS = ["#2001FF", "#2563eb", "#ea580c", "#7c3aed", "#0891b2"]

function timeStr(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "?" : d.toDateString()
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/)
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?"
}

function mediaText(m: ChatMessage): string {
  if (m.media_type === "photo") return "Rasm"
  if (m.media_type === "video") return "Video"
  if (m.media_type === "voice") return "Ovozli xabar"
  if (m.media_type === "file") return "Fayl"
  return m.text || ""
}

export default function Messages() {
  const emp = loadEmployee()
  const initials = ((emp?.first_name?.[0] || "") + (emp?.last_name?.[0] || "")).toUpperCase()

  const [chats, setChats] = useState<ChatSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [chatId, setChatId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ChatDetail | null>(null)
  const [sending, setSending] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const loadChats = useCallback(async () => {
    try {
      const data = await api.chats()
      setChats(data.chats)
      setError("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (id: number, mark = false) => {
    try {
      const d = await api.chatMessages(id)
      setDetail(d)
      if (mark) api.markRead(id).catch(() => {})
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    loadChats()
    const t = setInterval(() => {
      loadChats()
      if (chatId) loadMessages(chatId, true)
    }, 6000)
    return () => clearInterval(t)
  }, [loadChats, loadMessages, chatId])

  const openChat = (id: number) => {
    setChatId(id)
    setError("")
    loadMessages(id, true)
  }

  const closeChat = () => {
    setChatId(null)
    setDetail(null)
    loadChats()
  }

  const send = async () => {
    const input = document.getElementById("msgInput") as HTMLInputElement | null
    const text = (input?.value || "").trim()
    if ((!text && !pendingFile) || !chatId || sending) return
    setSending(true)
    try {
      const res = await api.sendMessage(chatId, text, pendingFile || undefined)
      setPendingFile(null)
      if (input) input.value = ""
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, res.message] } : prev
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const groups = chats.filter((c) => c.chat_type === "group")
  const privates = chats.filter((c) => c.chat_type !== "group")

  const memberName = useMemo(() => {
    const map: Record<string, string> = {}
    ;(detail?.members || []).forEach((m) => {
      map[`${m.kind}:${m.id}`] = m.name
    })
    return map
  }, [detail])

  const unreadTotal = chats.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title="Xabarlar"
        subtitle={unreadTotal > 0 ? `${unreadTotal} ta o'qilmagan` : "Guruh va shaxsiy suhbatlar"}
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials || "A"}</span>
          </div>
        }
      />

      {chatId !== null ? (
        /* ---------- conversation ---------- */
        <div className="fixed inset-0 z-[60] bg-[#eef1f5] flex flex-col animate-page-enter">
          <div className="bg-gradient-to-b from-[#3E37FF] via-[#2001FF] to-[#1B00E0] text-white shadow-md shadow-[#2001FF]/20">
            <div className="max-w-lg mx-auto px-3 pt-2 pb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeChat}
                  className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover shrink-0"
                >
                  <ArrowLeft size={14} className="text-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold leading-tight truncate">{detail?.title || "Chat"}</p>
                  <p className="text-[9px] font-medium text-white/65 truncate">
                    {detail ? (detail.chat_type === "group" ? `${detail.members.length} a'zo` : "") : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div id="msgBody" className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {!detail ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
              </div>
            ) : detail.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                <MessageSquare size={30} className="text-gray-300" />
                <p className="text-xs font-medium">Hali xabarlar yo'q. Birinchi xabar yozing!</p>
              </div>
            ) : (
              detail.messages.map((m, i) => {
                const prev = detail.messages[i - 1]
                const sep = prev ? dayKey(m.created_at) !== dayKey(prev.created_at) : true
                const label =
                  detail.chat_type === "group" && !m.is_me
                    ? m.sender_name || memberName[`${m.sender_kind}:${m.sender_id}`] || ""
                    : ""
                return (
                  <div key={m.id}>
                    {sep && (
                      <div className="text-center my-2">
                        <span className="bg-white rounded-xl px-3 py-1 text-[10px] font-semibold text-gray-500 shadow-sm">
                          {dayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${m.is_me ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                          m.is_me
                            ? "bg-[#2001FF] text-white rounded-br-md"
                            : "bg-white text-gray-900 rounded-bl-md"
                        }`}
                      >
                        {label && (
                          <p className="text-[10px] font-bold mb-0.5 text-[#7c3aed]">{label}</p>
                        )}
                        {m.media_type === "photo" && m.media_url && (
                          <img src={m.media_url} alt="" loading="lazy" className="rounded-lg max-h-52 mb-1" />
                        )}
                        {m.media_type === "video" && m.media_url && (
                          <video controls preload="metadata" className="rounded-lg max-h-52 mb-1 max-w-full">
                            <source src={m.media_url} />
                          </video>
                        )}
                        {m.media_type === "voice" && m.media_url && (
                          <audio controls preload="metadata" className="max-w-full mb-0.5" style={{ height: 34 }}>
                            <source src={m.media_url} />
                          </audio>
                        )}
                        {m.media_type === "file" && m.media_url && (
                          <a
                            href={m.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold"
                          >
                            <Paperclip size={14} /> {m.text || "Fayl"}
                          </a>
                        )}
                        {m.text && <p className="text-[12.5px] leading-snug whitespace-pre-wrap break-words">{m.text}</p>}
                        <p className={`text-[9px] mt-0.5 text-right ${m.is_me ? "text-white/70" : "text-gray-400"}`}>
                          {timeStr(m.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-3 py-2 text-xs font-medium">{error}</div>
          )}

          <div className="bg-white border-t border-gray-100 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
            <div className="max-w-lg mx-auto flex items-end gap-2">
              <input
                id="fileInput"
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
              />
              <button
                onClick={() => document.getElementById("fileInput")?.click()}
                className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 border border-gray-100 btn-hover shrink-0"
              >
                <Paperclip size={16} />
              </button>
              {pendingFile && (
                <span className="text-[10px] font-semibold text-[#2001FF] bg-[#2001FF]/10 rounded-lg px-2 py-1 max-w-[90px] truncate shrink-0">
                  {pendingFile.name}
                </span>
              )}
              <input
                id="msgInput"
                type="text"
                placeholder="Xabar yozing..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-[13px] outline-none border border-gray-100 focus:border-[#2001FF]/40 min-h-[40px]"
              />
              <button
                onClick={send}
                disabled={sending}
                className="w-10 h-10 bg-[#2001FF] rounded-full flex items-center justify-center text-white shadow-md shadow-[#2001FF]/20 btn-hover disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ---------- chat list ---------- */
        <div className="max-w-lg mx-auto px-3 pt-3">
          {error && (
            <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium mb-3">{error}</div>
          )}

          {loading ? (
            <div className="card-premium p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {chats.length === 0 && (
                <div className="card-premium p-8 text-center">
                  <MessageSquare size={28} className="mx-auto text-gray-300 mb-1.5" />
                  <p className="text-xs font-medium text-gray-400">Suhbatlar hali yo'q</p>
                </div>
              )}

              {groups.length > 0 && (
                <section className="mb-2">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1">
                    Guruhlar
                  </h2>
                  <div className="space-y-1.5">
                    {groups.map((c, idx) => (
                      <ChatRow key={c.id} chat={c} idx={idx} onClick={() => openChat(c.id)} />
                    ))}
                  </div>
                </section>
              )}

              {privates.length > 0 && (
                <section>
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1">
                    Shaxsiy suhbatlar
                  </h2>
                  <div className="space-y-1.5">
                    {privates.map((c, idx) => (
                      <ChatRow key={c.id} chat={c} idx={idx} onClick={() => openChat(c.id)} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ChatRow({ chat, idx, onClick }: { chat: ChatSummary; idx: number; onClick: () => void }) {
  const last = chat.last_message
    ? chat.last_message.media_type !== "text"
      ? mediaText(chat.last_message)
      : chat.last_message.text || " "
    : "Suhbat boshlandi"
  const subName = chat.chat_type === "group" && last !== "Suhbat boshlandi" ? chat.members_preview[0] || "" : ""
  return (
    <div
      onClick={onClick}
      className="card-premium p-3 flex items-center gap-3 btn-hover active:scale-[0.98] cursor-pointer transition-transform"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
      >
        {initialsOf(chat.title)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-bold text-gray-900 truncate">{chat.title}</p>
          {chat.last_msg_at && (
            <span className="text-[9.5px] text-gray-400 shrink-0">{timeStr(chat.last_msg_at)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[11px] text-gray-500 truncate">
            {subName ? `${subName}: ` : ""}
            {last}
          </p>
          {chat.unread_count > 0 ? (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#2001FF] text-white text-[9.5px] font-bold flex items-center justify-center shrink-0">
              {chat.unread_count}
            </span>
          ) : (
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
          )}
        </div>
      </div>
    </div>
  )
}