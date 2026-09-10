import { Phone, Mail, CalendarDays, School, BookOpen, Users, MapPin, Building, User as UserIcon } from "lucide-react"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { SectionCard, InfoRow, StudentLoading, StudentError, EmptyBlock } from "./parts"

export default function StudentInfo() {
  const { data, loading, error } = useStudentDetail()

  return (
    <StudentShell title="Shaxsiy ma'lumotlar" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <>
          <SectionCard icon={UserIcon} title="Shaxsiy ma'lumotlar">
            <div className="space-y-1.5">
              <InfoRow icon={Phone} label="Telefon" value={data.student.phone.startsWith("+998") ? data.student.phone : `+998 ${data.student.phone}`} />
              <InfoRow icon={Mail} label="Email" value={data.student.email || "-"} />
              <InfoRow icon={CalendarDays} label="Tug'ilgan sana" value={data.student.birth_date || "-"} />
              <InfoRow icon={School} label="Maktab" value={data.student.school || "-"} />
              {data.student.education_language && (
                <InfoRow icon={BookOpen} label="O'qitish tili" value={data.student.education_language} />
              )}
              <InfoRow icon={CalendarDays} label="Ro'yxatdan o'tgan" value={data.student.created_at || "-"} />
            </div>
          </SectionCard>

          {(data.student.father_full_name || data.student.mother_full_name) && (
            <SectionCard icon={Users} title="Oila ma'lumotlari">
              <div className="space-y-1.5">
                {data.student.father_full_name && (
                  <>
                    <InfoRow label="Otasi" value={data.student.father_full_name} />
                    {data.student.father_phone && (
                      <InfoRow icon={Phone} label="Otasining tel" value={`+998 ${data.student.father_phone}`} />
                    )}
                    {data.student.father_workplace && (
                      <InfoRow icon={Building} label="Otasining ish joyi" value={data.student.father_workplace} />
                    )}
                  </>
                )}
                {data.student.mother_full_name && (
                  <>
                    <InfoRow label="Onasi" value={data.student.mother_full_name} />
                    {data.student.mother_phone && (
                      <InfoRow icon={Phone} label="Onasining tel" value={`+998 ${data.student.mother_phone}`} />
                    )}
                    {data.student.mother_workplace && (
                      <InfoRow icon={Building} label="Onasining ish joyi" value={data.student.mother_workplace} />
                    )}
                  </>
                )}
              </div>
            </SectionCard>
          )}

          {data.student.home_address ? (
            <SectionCard icon={MapPin} title="Manzil">
              <p className="text-[12px] font-medium text-gray-600">{data.student.home_address}</p>
            </SectionCard>
          ) : (
            <SectionCard icon={MapPin} title="Manzil">
              <EmptyBlock text="Manzil kiritilmagan" />
            </SectionCard>
          )}

          {data.student.additional_info && (
            <SectionCard icon={Building} title="Qo'shimcha ma'lumot">
              <p className="text-[12px] font-medium text-gray-600">{data.student.additional_info}</p>
            </SectionCard>
          )}
        </>
      ) : null}
    </StudentShell>
  )
}
