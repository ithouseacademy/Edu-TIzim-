import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, Paperclip, Send, Mic, CheckCheck, X } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { MessageInfo, ChatInfo, ChatMemberInfo } from "../types"

interface Props {
  chatId: number
  onBack: () => void
  onChatsUpdate: () => void
}

function dayKey(iso: string) {
  return new Date(iso).toDateString()
}
function dayLabel(iso: string, tr: (k: string) => string) {
  const d = new Date(iso)
  const now = new Date()
  const yest = new Date()
  yest.setDate(now.getDate() - 1)
  if (dayKey(iso) === dayKey(now.toISOString())) return tr("Bugun")
  if (dayKey(iso) === dayKey(yest.toISOString())) return tr("Kecha")
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })
}
function timeStr(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m}`
}
function isNearBottom(el: HTMLElement | null) {
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 140
}
function durationStr(s: number | null) {
  if (!s) return ""
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec < 10 ? "0" : ""}${sec}`
}

export default function ChatWindow({ chatId, onBack, onChatsUpdate }: Props) {
  const { tr } = useAppSettings()
  const [chat, setChat] = useState<ChatInfo | null>(null)
  const [msgs, setMsgs] = useState<MessageInfo[]>([])
  const [members, setMembers] = useState<ChatMemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [recording, setRecording] = useState(false)
  const [recordDur, setRecordDur] = useState(0)
  const [attachName, setAttachName] = useState("")

  const bodyRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recStartRef = useRef(0)
  const recTimerRef = useRef<number | null>(null)
  const wasAtBottomRef = useRef(true)

  const load = useCallback(
    async (after?: number) => {
      try {
        const data = await api.chatMessages(chatId, after)
        setChat({
          id: data.id,
          chat_type: data.chat_type,
          title: data.title,
          group_id: null,
          members_count: data.members.length,
          members_preview: data.members.map((m) => m.name),
          last_message: null,
          unread_count: 0,
          last_msg_at: new Date().toISOString(),
          is_group_admin: data.is_group_admin,
        })
        setMembers(data.members)
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const fresh = data.messages.filter((m) => !seen.has(m.id))
          return fresh.length ? [...prev, ...fresh].sort((a, b) => a.id - b.id) : prev
        })
        if (after) {
          api.markChatRead(chatId).catch(() => {})
          onChatsUpdate()
        }
      } catch (e) {
        if (!after) setError((e as Error).message)
      }
      setLoading(false)
    },
    [chatId, onChatsUpdate]
  )

  const refresh = useCallback(() => {
    api
      .chatMessages(chatId)
      .then((data) => {
        setMembers(data.members)
        setMsgs(data.messages)
        api.markChatRead(chatId).catch(() => {})
      })
      .catch(() => {})
  }, [chatId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const t = setInterval(() => {
      if (!document.hidden) refresh()
    }, 2500)
    return () => clearInterval(t)
  }, [chatId, load, refresh])

  useEffect(() => {
    if (bodyRef.current) wasAtBottomRef.current = isNearBottom(bodyRef.current)
    if (wasAtBottomRef.current) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [msgs, loading])

  const sendMedia = useCallback(
    async (file: File, type: string, duration?: number) => {
      const fd = new FormData()
      fd.append("chat_id", String(chatId))
      fd.append("media_file", file)
      fd.append("media_type", type)
      if (duration) fd.append("media_duration", String(duration))
      setSending(true)
      try {
        const res = await api.sendChatMessage(fd)
        setMsgs((prev) => [...prev, res.message].sort((a, b) => a.id - b.id))
        onChatsUpdate()
      } catch (e) {
        setError((e as Error).message)
      }
      setSending(false)
    },
    [chatId, onChatsUpdate]
  )

  const sendText = useCallback(async () => {
    const value = text.trim()
    if (!value || sending) return
    setText("")
    if (textRef.current) textRef.current.style.height = "auto"
    const tmp: MessageInfo = {
      id: -Date.now(),
      chat_id: chatId,
      text: value,
      media_type: "text",
      media_url: "",
      media_duration: null,
      sender_id: 0,
      sender_kind: "me",
      sender_name: "",
      is_me: true,
      created_at: new Date().toISOString(),
    }
    setMsgs((prev) => [...prev, tmp])
    setSending(true)
    try {
      const res = await api.sendChatMessage((() => {
        const fd = new FormData()
        fd.append("chat_id", String(chatId))
        fd.append("text", value)
        return fd
      })())
      setMsgs((prev) => prev.map((m) => (m.id === tmp.id ? res.message : m)))
      onChatsUpdate()
    } catch (e) {
      setError((e as Error).message)
      setMsgs((prev) => prev.filter((m) => m.id !== tmp.id))
      setText(value)
    }
    setSending(false)
  }, [text, sending, chatId, onChatsUpdate])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ""
    setAttachName(f.name)
    sendMedia(f, "auto").then(() => setAttachName(""))
  }

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : ""
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recStartRef.current = Date.now()
      setRecordDur(0)
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (recTimerRef.current) window.clearInterval(recTimerRef.current)
        const duration = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000))
        const type = rec.mimeType || "audio/webm"
        const ext = type.includes("mp4") ? "m4a" : "webm"
        const blob = new Blob(chunksRef.current, { type })
        const file = new File([blob], `voice.${ext}`, { type })
        setRecording(false)
        setRecordDur(0)
        if (duration >= 1) sendMedia(file, "voice", duration)
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      recTimerRef.current = window.setInterval(() => {
        setRecordDur(Math.round((Date.now() - recStartRef.current) / 1000))
      }, 500)
    } catch {
      setError(tr("Yozib olish..."))
      setError("")
    }
  }
  useEffect(() => () => {
    recorderRef.current?.stop()
    if (recTimerRef.current) window.clearInterval(recTimerRef.current)
  }, [])

  const memberName = (m: MessageInfo) => {
    const found = members.find((x) => x.kind === m.sender_kind && String(x.id) === String(m.sender_id))
    return found?.name || m.sender_name || ""
  }

  if (error && !msgs.length && !chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white p-6">
        <p className="text-sm font-medium text-gray-500">{error}</p>
        <button onClick={() => { setError(""); load() }} className="text-xs font-semibold text-[#2001FF]">{tr("Qayta yuborish")}</button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#EEF1F5] h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="lg:hidden p-1.5 -ml-1 text-gray-500 btn-scale" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{chat?.title || "..."}</div>
            {chat && (
              <div className="text-[10px] text-gray-400 font-medium truncate">
                {chat.chat_type === "group"
                  ? `${tr("A'zolar")}: ${chat.members_count}`
                  : (chat.members_preview[0] || "")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 [scrollbar-width:thin]"
        style={{ height: 0 }}
      >
        {loading && (
          <div className="text-center text-xs text-gray-400 py-8">{tr("Yuklanmoqda...")}</div>
        )}
        {!loading && !msgs.length && (
          <div className="text-center text-xs text-gray-400 py-10">{tr("Xabarlar yo'q")}</div>
        )}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const showDate = !prev || dayKey(prev.created_at) !== dayKey(m.created_at)
          return (
            <div key={m.id}>
              {showDate && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] font-medium text-gray-500 bg-white px-3 py-1 rounded-full">
                    {dayLabel(m.created_at, tr)}
                  </span>
                </div>
              )}
              <div className={`flex ${m.is_me ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-sm text-[13px] leading-relaxed break-words ${
                    m.is_me
                      ? "bg-[#2001FF] text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md"
                  }`}
                >
                  {chat?.chat_type === "group" && !m.is_me && (
                    <div className="text-[11px] font-bold text-[#7c3aed] mb-0.5">{memberName(m)}</div>
                  )}
                  {m.media_type === "photo" && (
                    <img src={m.media_url} alt="" loading="lazy" className="max-w-[220px] max-h-[220px] rounded-xl block" />
                  )}
                  {m.media_type === "video" && (
                    <video controls preload="metadata" className="max-w-[220px] max-h-[220px] rounded-xl block">
                      <source src={m.media_url} />
                    </video>
                  )}
                  {m.media_type === "voice" && (
                    <div className="flex items-center gap-2 py-0.5">
                      <Mic size={16} className={m.is_me ? "text-white/80" : "text-[#2001FF]"} />
                      <audio controls preload="metadata" className="h-8" src={m.media_url} />
                      {m.media_duration ? (
                        <span className="text-[10px] opacity-70">{durationStr(m.media_duration)}</span>
                      ) : null}
                    </div>
                  )}
                  {m.media_type === "file" && (
                    <a
                      href={m.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1.5 underline ${m.is_me ? "text-white" : "text-[#2001FF]"}`}
                    >
                      <Paperclip size={13} />
                      <span className="text-[12px] font-medium">{m.text || tr("Fayl")}</span>
                    </a>
                  )}
                  {m.text && m.media_type !== "file" && <span>{m.text}</span>}
                  <div className={`flex items-center gap-1 justify-end mt-0.5 text-[9.5px] ${m.is_me ? "text-white/75" : "text-gray-400"}`}>
                    <span>{timeStr(m.created_at)}</span>
                    {m.is_me && <CheckCheck size={12} />}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {sending && (
          <div className="text-center text-[10px] text-gray-400 py-1">{tr("Yuborilmoqda...")}</div>
        )}
      </div>

      {error && (
        <div className="px-3 py-1 text-[11px] text-red-500 bg-red-50 shrink-0">{error}</div>
      )}

      <div className="bg-white border-t border-gray-100 px-2.5 py-2 flex items-end gap-1.5 shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 btn-scale"
          aria-label={tr("Fayl")}
        >
          <Paperclip size={17} />
        </button>
        <div className="flex-1 min-w-0">
          {attachName && <div className="text-[10px] text-[#2001FF] truncate">{attachName}</div>}
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = "auto"
              e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendText()
              }
            }}
            placeholder={tr("Xabar yozing...")}
            rows={1}
            className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-[#2001FF] max-h-[110px]"
          />
        </div>
        {text.trim() ? (
          <button
            onClick={sendText}
            className="w-9 h-9 rounded-full bg-[#2001FF] flex items-center justify-center text-white shrink-0 btn-scale"
            aria-label={tr("Yuborish")}
          >
            <Send size={16} />
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 btn-scale transition-colors ${
              recording ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-500"
            }`}
            aria-label={tr("Ovozli xabar")}
          >
            {recording ? <X size={16} /> : <Mic size={17} />}
          </button>
        )}
        {recording && (
          <span className="text-[10px] font-bold text-red-500 animate-pulse">
            {durationStr(recordDur)}
          </span>
        )}
      </div>
    </div>
  )
}