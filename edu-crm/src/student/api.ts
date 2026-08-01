import type {
  StudentProfile,
  GroupInfo,
  TodayClass,
  AttendanceStats,
  MonthlyCalendar,
  ScheduleDay,
  Transaction,
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
}
