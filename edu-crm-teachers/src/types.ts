export interface Employee {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  gender: string
  gender_display: string
  birth_date: string | null
  photo: string | null
  position: { id: number; name: string } | null
  role: { id: number; name: string } | null
  branches: { id: number; name: string }[]
  salary_enabled: boolean
  salary: number | null
  notes: string
  has_login: boolean
  group_count: number
  created_at: string
}

export interface EmployeeDetail extends Employee {
  groups: EmployeeGroup[]
}

export interface EmployeeGroup {
  id: number
  name: string
  course: string | null
  room: string | null
  status: string
  status_display: string
  student_count: number
  start_date: string | null
}

export interface TeacherGroup {
  id: number
  name: string
  course: string | null
  room: string | null
  status: string
  status_display: string
  student_count: number
  teacher: string | null
  lesson_times: { days: string; start_time: string; end_time: string }[]
  start_date: string | null
  end_date: string | null
}

export interface DashboardGroup {
  id: number
  name: string
  course: string | null
  room: string | null
  student_count: number
  status: string
  status_display: string
  lesson_display: string
  nearest_time: string | null
  start_date: string | null
  end_date: string | null
}

export interface DashboardData {
  groups: DashboardGroup[]
  today_display: string
  total_groups: number
  today_count: number
  active_count: number
  total_students: number
}

export interface GroupDetailStudent {
  id: number
  first_name: string
  last_name: string
  phone: string
  is_frozen: boolean
  attendance_status: string
  attendance_notes: string
}

export interface GroupDetailData {
  group: {
    id: number
    name: string
    course: string | null
    room: string | null
    education_type: string
    education_type_display: string
    status: string
    status_display: string
    start_date: string | null
    end_date: string | null
    lesson_times: { days: string; days_display: string; start_time: string; end_time: string }[]
    telegram_link: string
    student_count: number
  }
  students: GroupDetailStudent[]
  absence_reasons: { id: number; name: string }[]
}

export interface AttendanceData {
  group: { id: number; name: string; start_date: string | null; end_date: string | null; remaining_days: number | null }
  students: { id: number; first_name: string; last_name: string; phone: string }[]
  lesson_dates: string[]
  att_matrix: Record<string, Record<string, string>>
  att_notes: Record<string, Record<string, string>>
  student_att_history: Record<string, { date: string; status: string; notes: string; teacher: string }[]>
  sel_year: number
  sel_month: number
  is_admin: boolean
  can_edit: boolean
}

export interface Role {
  id: number
  name: string
}

export interface Position {
  id: number
  name: string
}

export interface Branch {
  id: number
  name: string
}
