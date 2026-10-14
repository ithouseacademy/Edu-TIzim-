import type {
  AdminGroup, AdminTransactionsResponse, ChatDetail, ChatMessage, ChatSummary, DashboardData, Employee, GroupAttendanceData, LoginResponse, MeResponse, SalaryData, StudentItem, StudentDetailResponse,
  CoinSummary, CoinReasonItem, CoinTxItem, CoinStudentRow, CoinStudentDetail, CoinSettings, CoinTeacherLimit, MonthlyReport, ReportStudentRow, LeadeboardItem, ShopCategory, ShopProduct, ShopOrderItem,
  NewsItem, NewsCategory,
} from "./types"

const BASE = import.meta.env.DEV ? "/api" : "https://it-house-academt-edu-tizim-production.up.railway.app/api"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/employee${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (res.status === 401) {
    const hadSession = !!localStorage.getItem("admin_employee")
    localStorage.removeItem("admin_employee")
    localStorage.removeItem("admin_is_admin")
    localStorage.removeItem("admin_can_messaging")
    if (hadSession) {
      window.location.hash = ""
      window.location.href = "/"
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
    const hadSession = !!localStorage.getItem("admin_employee")
    localStorage.removeItem("admin_employee")
    localStorage.removeItem("admin_is_admin")
    localStorage.removeItem("admin_can_messaging")
    if (hadSession) {
      window.location.hash = ""
      window.location.href = "/"
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

export const api = {
  login(phone: string, password: string) {
    return request<LoginResponse>("/login/", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    })
  },

  logout() {
    return request<{ success: boolean }>("/logout/")
  },

  me() {
    return request<MeResponse>("/me/")
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
    const body = new FormData()
    body.append("photo", file)
    return request<{ success: boolean; photo: string }>("/upload-photo/", {
      method: "POST",
      headers: {},
      body,
    })
  },

  transactions(limit = 50) {
    return request<AdminTransactionsResponse>(`/transactions/?limit=${limit}`)
  },

  students(search = "") {
    return request<{ students: StudentItem[]; count: number }>(
      `/students/?search=${encodeURIComponent(search)}`
    )
  },

  studentDetail(id: number) {
    return request<StudentDetailResponse>(`/students/${id}/`)
  },

  studentRemoveGroup(id: number, groupId: number, reason = "") {
    return request<{ success: boolean; message: string }>(`/students/${id}/remove_group/`, {
      method: "POST",
      body: JSON.stringify({ group_id: groupId, reason }),
    })
  },

  adminGroups() {
    return request<{ groups: AdminGroup[] }>("/my-groups/")
  },

  mySalary() {
    return request<{ salary: SalaryData }>("/my-salary/")
  },

  teacherDashboard(day?: string, date?: string) {
    let q = ""
    if (day) q = `?day=${day}`
    else if (date) q = `?date=${date}`
    return request<DashboardData>(`/teacher-dashboard/${q}`)
  },

  groupAttendance(groupId: number, year?: number, month?: number) {
    const q = year && month ? `?year=${year}&month=${month}` : ""
    return request<GroupAttendanceData>(`/attendance/${groupId}/${q}`)
  },

  saveAttendance(
    groupId: number,
    attendance: { student_id: number; date: string; status: string; notes?: string }[]
  ) {
    return request<{ success: boolean; message?: string }>("/take-attendance/", {
      method: "POST",
      body: JSON.stringify({ group_id: groupId, attendance }),
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

  // ===== COIN TIZIMI (admin/o'qituvchi) =====
  coinSummary() {
    return request<CoinSummary>("/coins/summary")
  },
  coinSettings() {
    return request<{ settings: CoinSettings }>("/coins/settings")
  },
  updateCoinSettings(body: Partial<CoinSettings>) {
    return request<{ success: boolean; settings: CoinSettings }>("/coins/settings", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
  coinReasons(all = false) {
    return request<{ reasons: CoinReasonItem[] }>(`/coins/reasons${all ? "?all=1" : ""}`)
  },
  createCoinReason(body: { name: string; reason_type: string; amount: number }) {
    return request<{ success: boolean; reason: CoinReasonItem }>("/coins/reasons", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
  updateCoinReason(
    id: number,
    body: Partial<{ name: string; reason_type: string; amount: number; is_active: boolean }>
  ) {
    return request<{ success: boolean; reason: CoinReasonItem }>(`/coins/reasons/${id}/`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  },
  toggleCoinReason(id: number, is_active: boolean) {
    return request<{ success: boolean; is_active: boolean }>(`/coins/reasons/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ is_active }),
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
  coinAdjust(body: { student_id: number; amount: number; description?: string }) {
    return request<{ success: boolean; transaction: CoinTxItem }>("/coins/adjust", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
  teacherLimits() {
    return request<{ limits: CoinTeacherLimit[] }>("/coins/teacher-limits")
  },
  setTeacherLimit(id: number, body: { daily_limit?: number | null; is_enabled?: boolean }) {
    return request<{ success: boolean; limit: CoinTeacherLimit }>(
      `/coins/teacher-limits/${id}/`,
      { method: "POST", body: JSON.stringify(body) }
    )
  },
  coinReports(year: number, month: number) {
    return request<MonthlyReport>(`/coins/reports?year=${year}&month=${month}`)
  },
  coinReportStudents(year: number, month: number, search = "") {
    return request<{ rows: ReportStudentRow[]; count: number }>(
      `/coins/report-students?year=${year}&month=${month}&search=${encodeURIComponent(search)}`
    )
  },
  coinLeaderboard(period = "all", limit = 20, groupId = "") {
    return request<{ leaderboard: LeadeboardItem[]; enabled: boolean }>(
      `/coins/leaderboard?period=${period}&limit=${limit}${groupId ? `&group_id=${groupId}` : ""}`
    )
  },
  shopCategories() {
    return request<{ categories: ShopCategory[] }>("/shop/categories")
  },
  createShopCategory(name: string) {
    return request<{ success: boolean; category: { id: number; name: string } }>(
      "/shop/categories",
      { method: "POST", body: JSON.stringify({ name }) }
    )
  },
  toggleShopCategory(id: number, is_active: boolean) {
    return request<{ success: boolean; is_active: boolean }>(
      `/shop/categories/${id}/toggle`,
      { method: "POST", body: JSON.stringify({ is_active }) }
    )
  },
  shopProducts() {
    return request<{ products: ShopProduct[] }>("/shop/products")
  },
  createShopProduct(body: Partial<ShopProduct>) {
    return request<{ success: boolean; product: ShopProduct }>("/shop/products", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
  updateShopProduct(
    id: number,
    body: Partial<{ name: string; description: string; category_id: number | null; coin_price: number; stock: number; is_active: boolean }>
  ) {
    return request<{ success: boolean; product: ShopProduct }>(`/shop/products/${id}/`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  },
  toggleShopProduct(id: number, is_active: boolean) {
    return request<{ success: boolean; is_active: boolean }>(
      `/shop/products/${id}/?action=toggle`,
      { method: "POST", body: JSON.stringify({ is_active }) }
    )
  },
  shopOrders(status = "", search = "") {
    const qs = new URLSearchParams()
    if (status) qs.set("status", status)
    if (search) qs.set("search", search)
    return request<{ orders: ShopOrderItem[] }>(`/shop/orders?${qs.toString()}`)
  },
  setShopOrderStatus(id: number, status: string) {
    return request<{ success: boolean; order: ShopOrderItem }>(`/shop/orders/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    })
  },
  news() {
    return request<{ news: NewsItem[]; categories: NewsCategory[] }>("/news/")
  },
  createNews(body: Partial<NewsItem>) {
    return request<{ success: boolean; news: NewsItem }>("/news/create/", {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
  updateNews(id: number, body: Partial<NewsItem>) {
    return request<{ success: boolean; news: NewsItem }>(`/news/${id}/update/`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
  deleteNews(id: number) {
    return request<{ success: boolean }>(`/news/${id}/delete/`, { method: "POST" })
  },
}

export function storeEmployee(employee: Employee, isAdmin: boolean, canMessaging = false) {
  localStorage.setItem("admin_employee", JSON.stringify(employee))
  localStorage.setItem("admin_is_admin", String(isAdmin))
  localStorage.setItem("admin_can_messaging", String(canMessaging))
}

export function setCanMessaging(value: boolean) {
  localStorage.setItem("admin_can_messaging", String(value))
}

export function loadCanMessaging(): boolean {
  return localStorage.getItem("admin_can_messaging") === "true"
}

export function loadIsAdmin(): boolean {
  return localStorage.getItem("admin_is_admin") === "true"
}

export function loadEmployee(): Employee | null {
  const raw = localStorage.getItem("admin_employee")
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem("admin_employee")
  localStorage.removeItem("admin_is_admin")
}