import type {
  StudentProfile,
  GroupInfo,
  TodayClass,
  AttendanceStats,
  MonthlyCalendar,
  ScheduleDay,
  Transaction,
  Feedback,
  MessagingSettings,
  ChatInfo,
  ChatData,
  SearchUser,
  MessageInfo,
} from "./types"

const BASE = import.meta.env.DEV ? "/api" : "https://it-house-academt-edu-tizim-production.up.railway.app/api"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("student_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  }
  const res = await fetch(`${BASE}/student${url}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "So'rov xatoligi")
  return data as T
}

async function msgRequest<T>(url: string, options?: RequestInit, form = false): Promise<T> {
  const token = localStorage.getItem("student_token")
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Token ${token}`
  if (!form) headers["Content-Type"] = "application/json"
  const res = await fetch(`${BASE}/messaging${url}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "So'rov xatoligi")
  return data as T
}

export const api = {
  sendCode(phone: string) {
    return request<{ success: boolean; message: string; telegram_connected: boolean }>("/send-code/", {
      method: "POST",
      body: JSON.stringify({ phone }),
    })
  },

  verifyCode(phone: string, code: string) {
    return request<{
      success: boolean
      message: string
      token: string
      student: StudentProfile | null
      has_password: boolean
      transactions?: Transaction[]
    }>("/verify-code/", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    })
  },

  setPassword(phone: string, password: string, confirm_password: string) {
    return request<{ success: boolean; message: string }>("/set-password/", {
      method: "POST",
      body: JSON.stringify({ phone, password, confirm_password }),
    })
  },

  login(phone: string, password: string) {
    return request<{
      success: boolean
      token: string
      student: StudentProfile
      groups: GroupInfo[]
      transactions?: Transaction[]
    }>("/login/", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    })
  },

  profile() {
    return request<{ student: StudentProfile; groups: GroupInfo[]; transactions: Transaction[] }>("/profile/")
  },

  todayClasses() {
    return request<{
      date: string
      weekday: string
      classes: TodayClass[]
    }>("/today-classes/")
  },

  schedule() {
    return request<{ schedule: Record<string, ScheduleDay> }>("/schedule/")
  },

  attendanceHistory() {
    return request<AttendanceStats>("/attendance-history/")
  },

  monthlyCalendar(year: number, month: number) {
    return request<MonthlyCalendar>(`/monthly-calendar/?year=${year}&month=${month}`)
  },

  myFeedback() {
    return request<{ feedbacks: Feedback[] }>("/feedback/")
  },

  createFeedback(category: string, message: string) {
    return request<{ success: boolean; message: string; feedback: Feedback }>("/feedback/create/", {
      method: "POST",
      body: JSON.stringify({ category, message }),
    })
  },

  updateProfile(birth_date: string) {
    return request<{ success: boolean; message: string; birth_date: string }>("/profile/update/", {
      method: "POST",
      body: JSON.stringify({ birth_date }),
    })
  },

  messagingSettings() {
    return msgRequest<MessagingSettings>("/settings/")
  },

  messengerChats() {
    return msgRequest<{ chats: ChatInfo[] }>("/chats/")
  },

  chatMessages(chatId: number, after?: number) {
    const q = after ? `?after=${after}` : ""
    return msgRequest<ChatData>(`/chats/${chatId}/messages/${q}`)
  },

  markChatRead(chatId: number) {
    return msgRequest<{ ok: boolean }>(`/chats/${chatId}/read/`, { method: "POST" })
  },

  sendChatMessage(formData: FormData) {
    return msgRequest<{ success: boolean; message: MessageInfo }>("/send/", { method: "POST", body: formData }, true)
  },

  searchMessagingUsers(q: string) {
    return msgRequest<{ results: SearchUser[] }>(`/users/search/?q=${encodeURIComponent(q)}`)
  },

  myStudyGroups() {
    return msgRequest<{ groups: { id: number; name: string; course: string; members_count: number }[] }>("/study-groups/")
  },

  messengerUnread() {
    return msgRequest<{ count: number }>("/unread/")
  },

  openPrivateChat(studentId: number) {
    return msgRequest<{ chat: ChatInfo }>(`/chats/private/${studentId}/`, { method: "POST" })
  },

  openGroupChat(payload: { study_group_id?: number; title?: string; student_ids?: number[] }) {
    return msgRequest<{ chat: ChatInfo }>("/chats/group/", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  addChatMembers(chatId: number, studentIds: number[]) {
    return msgRequest<{ ok: boolean; added: number; chat: ChatInfo }>(`/chats/${chatId}/members/`, {
      method: "POST",
      body: JSON.stringify({ student_ids: studentIds }),
    })
  },
}
