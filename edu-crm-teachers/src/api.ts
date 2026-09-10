import type { Employee, EmployeeDetail, TeacherGroup, AttendanceData, DashboardData, GroupDetailData, Role, Position, Branch, SalaryData, TasksData, RemindersData } from "./types"

const BASE = import.meta.env.DEV ? "/api" : "https://it-house-academt-edu-tizim-production.up.railway.app/api"

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
}
