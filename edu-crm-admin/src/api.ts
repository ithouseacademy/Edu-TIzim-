import type {
  AdminGroup, AdminTransactionsResponse, DashboardData, Employee, GroupAttendanceData, LoginResponse, MeResponse, SalaryData, StudentItem, StudentDetailResponse,
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
}

export function storeEmployee(employee: Employee, isAdmin: boolean) {
  localStorage.setItem("admin_employee", JSON.stringify(employee))
  localStorage.setItem("admin_is_admin", String(isAdmin))
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