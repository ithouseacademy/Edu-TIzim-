export interface StudentProfile {
  id: number
  first_name: string
  last_name: string
  phone: string
  birth_date?: string
  father_full_name?: string
  father_phone?: string
  mother_full_name?: string
  mother_phone?: string
  balance?: number
  balance_str?: string
  debt?: number
  debt_str?: string
  to_pay?: number
  to_pay_str?: string
  total_to_pay?: number
  total_to_pay_str?: string
  remaining_lessons?: number
  has_password?: boolean
}

export interface Transaction {
  id: number
  amount: number
  amount_str: string
  balance_after: number
  balance_after_str: string
  type: string
  type_display: string
  group: string
  description: string
  created_by: string
  created_at: string
}

export interface GroupInfo {
  id: number
  name: string
  course: string
  room: string
  teacher: string
  lesson_times?: LessonTimeInfo[]
  start_date?: string
  end_date?: string
}

export interface LessonTimeInfo {
  days: string
  start_time: string
  end_time: string
}

export interface TodayClass {
  id: string
  group_id: number
  subject: string
  teacher: string
  room: string
  group_name: string
  start_time: string
  end_time: string
  status: "upcoming" | "ongoing" | "finished"
  attendance_status: string
}

export interface AttendanceStats {
  total: number
  present: number
  absent: number
  excused: number
  percentage: number
  records: AttendanceRecord[]
}

export interface AttendanceRecord {
  date: string
  status: string
  group: string
}

export interface MonthlyCalendar {
  year: number
  month: number
  lesson_dates: string[]
  attendance_map: Record<string, string>
}

export interface ScheduleDay {
  label: string
  lessons: ScheduleLesson[]
}

export interface ScheduleLesson {
  group_id: number
  group_name: string
  subject: string
  teacher: string
  room: string
  start_time: string
  end_time: string
}

export interface Feedback {
  id: number
  category: string
  category_display: string
  message: string
  status: string
  status_display: string
  admin_response: string
  responded_at: string
  created_at: string
}

export interface MessagingSettings {
  enabled: boolean
  private_chats: boolean
  group_chats: boolean
  teachers_in_group_chats: boolean
  role: string
}

export interface ChatMemberInfo {
  id: number
  kind: string
  name: string
  username: string
  phone: string
  is_admin: boolean
}

export interface MessageInfo {
  id: number
  chat_id: number
  text: string
  media_type: string
  media_url: string
  media_duration: number | null
  sender_id: number
  sender_kind: string
  sender_name: string
  is_me: boolean
  created_at: string
}

export interface ChatInfo {
  id: number
  chat_type: string
  title: string
  group_id: number | null
  members_count: number
  members_preview: string[]
  members?: ChatMemberInfo[]
  last_message: MessageInfo | null
  unread_count: number
  last_msg_at: string
  is_group_admin: boolean
  is_me?: boolean
}

export interface ChatData {
  id: number
  chat_type: string
  title: string
  members: ChatMemberInfo[]
  messages: MessageInfo[]
  is_group_admin: boolean
}

export interface SearchUser {
  id: number
  kind: string
  name: string
  username: string
  phone: string
  initials: string
}
