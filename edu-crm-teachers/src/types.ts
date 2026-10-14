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
  balance?: number
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
  group: { id: number; name: string; course: string | null; room: string | null; teacher: string | null; lesson_time: string; start_date: string | null; end_date: string | null; remaining_days: number | null }
  students: { id: number; first_name: string; last_name: string; phone: string; balance?: number }[]
  lesson_dates: string[]
  att_matrix: Record<string, Record<string, string>>
  att_notes: Record<string, Record<string, string>>
  student_att_history: Record<string, { date: string; status: string; notes: string; teacher: string }[]>
  absence_reasons: { id: number; name: string }[]
  sel_year: number
  sel_month: number
  is_admin: boolean
  can_edit: boolean
}

export interface Task {
  id: number
  title: string
  description: string
  reminder: string
  status: string
  status_display: string
  deadline: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface TasksData {
  tasks: Task[]
  counts: {
    all: number
    yangi: number
    jarayonda: number
    bajarildi: number
    bajarilmadi: number
    bekor_qilindi: number
  }
}

export interface Reminder {
  id: number
  message: string
  is_read: boolean
  read_at: string | null
  created_by: string
  created_at: string
}

export interface RemindersData {
  reminders: Reminder[]
  unread: number
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

export interface ChatMemberSummary {
  id: number
  kind: "student" | "employee" | "user"
  name: string
  username: string
  phone: string
  is_admin: boolean
}

export interface ChatMessage {
  id: number
  chat_id: number
  text: string
  media_type: string
  media_url: string
  media_duration: number | null
  sender_id: number | null
  sender_kind: string
  sender_name: string
  is_me: boolean
  created_at: string
}

export interface ChatSummary {
  id: number
  chat_type: "group" | "private"
  title: string
  group_id: number | null
  members_count: number
  members_preview: string[]
  members: ChatMemberSummary[]
  last_message: ChatMessage | null
  unread_count: number
  last_msg_at: string
  is_group_admin: boolean
}

export interface ChatDetail {
  id: number
  chat_type: "group" | "private"
  title: string
  members: ChatMemberSummary[]
  messages: ChatMessage[]
  is_group_admin: boolean
}

export interface SalaryTransaction {
  id: number
  amount: number
  transaction_type: string
  transaction_type_display: string
  student_name: string
  group_name: string
  percent: number
  payment_method: string
  description: string
  created_by: string
  balance_after: number
  created_at: string
}

export interface PendingStudent {
  student_id: number
  student_name: string
  amount: number
  lessons: number
}

export interface SalaryPayoutItem {
  id: number
  amount: number
  payment_method: string
  description: string
  created_at: string
}

export interface AvansItem extends SalaryPayoutItem {
  transaction_type: string
  transaction_type_display: string
}

export interface MonthlySalaryItem {
  year: number
  month: number
  month_display: string
  received: number
  income: number
  count: number
}

export interface SalaryData {
  employee_id: number
  first_name: string
  last_name: string
  salary_type: string
  salary_type_display: string
  percent: number
  salary_enabled: boolean
  salary: number | null
  balance: number
  avans_balance: number
  today_income: number
  month_earned: number
  paid_total: number
  month_paid: number
  pending_amount: number
  pending_count: number
  pending_student_count: number
  pending_students: PendingStudent[]
  unpaid: number
  transactions?: SalaryTransaction[]
  salary_history?: SalaryPayoutItem[]
  avans_history?: AvansItem[]
  monthly_summary?: MonthlySalaryItem[]
}

export interface CoinSummary {
  total_balance: number
  today_given: number
  today_penalty: number
  today_shop: number
  today_students: number
  today_shop_students: number
  leaderboard_enabled: boolean
  shop_enabled: boolean
  teacher_daily_limit?: number | null
  teacher_daily_used?: number
}

export interface CoinReasonItem {
  id: number
  name: string
  reason_type: "BONUS" | "PENALTY"
  amount: number
  is_active: boolean
}

export interface CoinTxItem {
  id: number
  student_id: number | null
  student_name: string
  amount: number
  transaction_type: string
  transaction_type_display: string
  reason_name: string
  reason_id: number | null
  reason_type: string
  description: string
  created_by: string
  created_at: string
  date: string
  time: string
  group_name: string
  attendance_id: number | null
  attendance_status: string
  shop_order_id: number | null
  reversal_of: number | null
  status: string
}

export interface CoinStudentRow {
  student_id: number
  student_name: string
  phone: string
  balance: number
  bonus: number
  penalty: number
  attendance: number
  shop: number
  month_spent: number
}

export interface CoinStudentDetail {
  student: { student_id: number; student_name: string; phone: string }
  summary: {
    balance: number
    today: number
    today_coins: number
    month_earned: number
    month_spent: number
    bonus: number
    penalty: number
    attendance: number
    shop: number
  }
  transactions: CoinTxItem[]
}

export interface LeadeboardItem {
  rank: number
  student_id: number
  student_name: string
  phone: string
  score: number
}
