import { MessageSquare } from "lucide-react"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { SectionCard, StudentLoading, StudentError, EmptyBlock } from "./parts"

export default function StudentSms() {
  const { data, loading, error } = useStudentDetail()

  return (
    <StudentShell title="SMS tarixi" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <SectionCard icon={MessageSquare} title={`SMS tarixi (${data.sms_history.length})`}>
          {data.sms_history.length === 0 ? (
            <EmptyBlock text="SMS tarixi mavjud emas" />
          ) : (
            <div className="space-y-1.5">
              {data.sms_history.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-2.5 py-2">
                  <p className="text-[11px] font-medium text-gray-800">{s.message}</p>
                  <p className="text-[9px] font-medium text-gray-400 mt-0.5">
                    {s.recipient_name ? `${s.recipient_name} · ` : ""}
                    {s.recipient_phone ? `${s.recipient_phone} · ` : ""}
                    {s.created_at}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </StudentShell>
  )
}
