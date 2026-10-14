export interface SectionProps {
  isAdmin: boolean
  teacherOnly: boolean
  isSuper: boolean
  perms: string[]
  has: (codename: string) => boolean
}