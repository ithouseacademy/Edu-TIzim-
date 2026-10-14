import type { Employee, EmployeeDetail, TeacherGroup, AttendanceData, DashboardData, GroupDetailData, Role, Position, Branch, SalaryData, TasksData, RemindersData, ChatDetail, ChatMessage, ChatSummary, CoinSummary, CoinReasonItem, CoinTxItem, CoinStudentRow, CoinStudentDetail, LeadeboardItem } from "./types"

const BASE = import.meta.env.DEV ? "/api" : "https://it-house-academt-edu-tizim-production.up.railway.app/api"
const MEDIA_BASE = import.meta.env.DEV ? "" : "https://it-house-academt-edu-tizim-production.up.railway.app"

export function fixPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith("http")) return url
  return MEDIA_BASE + url
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/employee${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (res.status === 401) {
    // Sessiya bekor qilingan (masalan raqam o'zgarganida barcha qurilmalar chiqariladi).
    const hadSession = !!localStorage.getItem("employee")
    localStorage.removeItem("employee")
    localStorage.removeItem("is_admin")
    localStorage.removeItem("is_teacher")
    localStorage.removeItem("teacher_can_messaging")
    if (hadSession) {
      window.location.hash = "#login"
      window.location.reload()
    }
  }
  const contentType = res.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi")
    return data as T
  }
  const text = await res.text()
  throw new Error(text || `Server xatosi (${res.status})`)
}

async function msgRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/messaging${url}`, {
    credentials: "include",
    ...options,
  })
  if (res.status === 401) {
    const hadSession = !!localStorage.getItem("employee")
    localStorage.removeItem("employee")
    localStorage.removeItem("is_admin")
    localStorage.removeItem("is_teacher")
    localStorage.removeItem("teacher_can_messaging")
    if (hadSession) {
      window.location.hash = "#login"
      window.location.reload()
    }
  }
  const contentType = res.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi")
    return data as T
  }
  const text = await res.text()
  throw new Error(text || `Server xatosi (${res.status})`)
}

export function loadCanMessaging(): boolean {
  return localStorage.getItem("teacher_can_messaging") !== "false"
}

export const api = {
  login(phone: string, password: string) {
    return request<{ success: boolean; employee: Employee; is_admin: boolean; is_teacher: boolean; can_messaging: boolean }>("/login/", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    })
  },

  logout() {
    return request<{ success: boolean }>("/logout/")
  },

  me() {
    return request<{ employee: Employee & { is_admin: boolean; is_teacher: boolean; username: string } }>("/me/")
  },

  employees() {
    return request<{ employees: Employee[] }>("/employees/")
  },

  employee(id: number) {
    return request<{ employee: EmployeeDetail }>(`/employees/${id}/`)
  },

  createEmployee(data: Partial<Employee> & { password?: string }) {
    return request<{ success: boolean; employee: Employee }>("/employees/create/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateEmployee(id: number, data: Partial<Employee> & { password?: string }) {
    return request<{ success: boolean; employee: Employee }>(`/employees/${id}/update/`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  deleteEmployee(id: number) {
    return request<{ success: boolean }>(`/employees/${id}/delete/`, {
      method: "DELETE",
    })
  },

  myGroups() {
    return request<{ groups: TeacherGroup[] }>("/my-groups/")
  },

  teacherDashboard(day?: string, date?: string) {
    let q = ""
    if (day) q = `?day=${day}`
    else if (date) q = `?date=${date}`
    return request<DashboardData>(`/teacher-dashboard/${q}`)
  },

  teacherGroupDetail(id: number) {
    return request<GroupDetailData>(`/teacher-group/${id}/`)
  },

  updateTeacherGroup(
    id: number,
    payload: { name: string; lesson_times: { days: string; start_time: string; end_time: string }[]; telegram_link?: string }
  ) {
    return request<{ success: boolean; message?: string }>(`/teacher-group/${id}/update/`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  groupAttendance(groupId: number, year: number, month: number) {
    return request<AttendanceData>(`/attendance/${groupId}/?year=${year}&month=${month}`)
  },

  takeAttendance(groupId: number, attendance: { student_id: number; date: string; status: string; notes?: string }[]) {
    return request<{ success: boolean }>("/take-attendance/", {
      method: "POST",
      body: JSON.stringify({ group_id: groupId, attendance }),
    })
  },

  roles() {
    return request<{ roles: Role[] }>("/roles/")
  },

  positions() {
    return request<{ positions: Position[] }>("/positions/")
  },

  branches() {
    return request<{ branches: Branch[] }>("/branches/")
  },

  mySalary() {
    return request<{ salary: SalaryData }>("/my-salary/")
  },

  myTasks(status?: string) {
    return request<TasksData>(`/my-tasks/${status ? `?status=${status}` : ""}`)
  },

  updateTaskStatus(taskId: number, status: string) {
    return request<{ success: boolean; status: string; status_display: string }>("/task-status/", {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, status }),
    })
  },

  myReminders() {
    return request<RemindersData>("/reminders/")
  },

  markReminderRead(id: number) {
    return request<{ success: boolean; is_read: boolean }>("/reminder-read/", {
      method: "POST",
      body: JSON.stringify({ reminder_id: id }),
    })
  },

  notifications() {
    return request<{ unread_reminders: number; active_tasks: number; total: number }>("/notifications/")
  },

  markNotificationsSeen() {
    return request<{ success: boolean }>("/notifications/seen/", { method: "POST" })
  },

  pushVapidPublic() {
    return request<{ public_key: string }>("/push/vapid-public/")
  },

  pushSubscribe(endpoint: string, p256dh: string, auth: string) {
    return request<{ success: boolean }>("/push/subscribe/", {
      method: "POST",
      body: JSON.stringify({ endpoint, keys: { p256dh, auth } }),
    })
  },

  pushUnsubscribe(endpoint: string) {
    return request<{ success: boolean }>("/push/unsubscribe/", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    })
  },

  changePassword(old_password: string, new_password: string) {
    return request<{ success: boolean; message: string }>("/change-password/", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    })
  },

  changePhone(old_password: string, new_phone: string) {
    return request<{ success: boolean; message: string }>("/change-phone/", {
      method: "POST",
      body: JSON.stringify({ old_password, new_phone }),
    })
  },

  uploadPhoto(file: File) {
    const formData = new FormData()
    formData.append("photo", file)
    return fetch(`${BASE}/employee/upload-photo/`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Xatolik")
      return data as { success: boolean; photo: string | null }
    })
  },

  chats() {
    return msgRequest<{ chats: ChatSummary[] }>("/chats/")
  },

  chatMessages(chatId: number) {
    return msgRequest<ChatDetail>(`/chats/${chatId}/messages/`)
  },

  sendMessage(chatId: number, text: string, file?: File, mediaType = "auto") {
    const fd = new FormData()
    fd.append("chat_id", String(chatId))
    if (text) fd.append("text", text)
    if (file) {
      fd.append("media_file", file)
      fd.append("media_type", mediaType)
    }
    return msgRequest<{ success: boolean; message: ChatMessage }>("/send/", {
      method: "POST",
      body: fd,
    })
  },

  markRead(chatId: number) {
    return msgRequest<{ ok: boolean }>(`/chats/${chatId}/read/`, { method: "POST" })
  },

  coinSummary() {
    return request<CoinSummary>("/coins/summary")
  },

  coinReasons() {
    return request<{ reasons: CoinReasonItem[] }>("/coins/reasons")
  },

  coinStudents(search = "") {
    return request<{ students: CoinStudentRow[]; count: number }>(
      `/coins/students?search=${encodeURIComponent(search)}`
    )
  },

  coinStudentDetail(id: number) {
    return request<CoinStudentDetail>(`/coins/students/${id}/`)
  },

  coinGive(body: { student_id: number; reason_id: number; description?: string }) {
    return request<{ success: boolean; transaction: CoinTxItem }>("/coins/give", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },

  coinTransactions(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v))
    })
    const qs = q.toString()
    return request<{ transactions: CoinTxItem[]; total: number }>(
      `/coins/transactions${qs ? `?${qs}` : ""}`
    )
  },

  coinMyTransactions() {
    return request<{ transactions: CoinTxItem[] }>("/coins/my-transactions")
  },

  coinLeaderboard(period = "all", limit = 20) {
    return request<{ leaderboard: LeadeboardItem[]; enabled: boolean }>(
      `/coins/leaderboard?period=${period}&limit=${limit}`
    )
  },
}
