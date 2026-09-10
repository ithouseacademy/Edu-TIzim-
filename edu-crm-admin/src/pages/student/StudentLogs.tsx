import { History } from "lucide-react"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { SectionCard, StudentLoading, StudentError, EmptyBlock } from "./parts"

export default function StudentLogs() {
  const { data, loading, error } = useStudentDetail()

  return (
    <StudentShell title="Harakatlar tarixi" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <SectionCard icon={History} title={`Harakatlar tarixi (${data.logs.length})`}>
          {data.logs.length === 0 ? (
            <EmptyBlock text="Harakatlar tarixi mavjud emas" />
          ) : (
            <div className="space-y-1">
              {data.logs.map((l) => (
                <div key={l.id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2001FF] mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-800">{l.action_display}</p>
                    {l.reason && <p className="text-[9px] font-medium text-gray-400 truncate">{l.reason}</p>}
                    <p className="text-[9px] font-medium text-gray-400">
                      {l.created_at}{l.created_by ? ` · ${l.created_by}` : ""}
                      {l.group ? ` · ${l.group}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </StudentShell>
  )
}
