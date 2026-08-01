import type { Employee, EmployeeDetail, TeacherGroup, AttendanceData, DashboardData, GroupDetailData, Role, Position, Branch } from "./types"

const BASE = import.meta.env.DEV ? "/api" : "https://it-house-academt-edu-tizim-production.up.railway.app/api"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/employee${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  })
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
    return request<{ success: boolean; employee: Employee; is_admin: boolean; is_teacher: boolean }>("/login/", {
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
}
