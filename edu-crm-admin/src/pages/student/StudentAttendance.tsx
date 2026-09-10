import { CalendarDays } from "lucide-react"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { SectionCard, StudentLoading, StudentError, EmptyBlock } from "./parts"

const attStatusColors: Record<string, string> = {
  bor: "bg-green-50 text-green-600",
  "yo'q": "bg-red-50 text-red-600",
  safar: "bg-amber-50 text-amber-600",
  qoldirildi: "bg-gray-100 text-gray-500",
}

export default function StudentAttendance() {
  const { data, loading, error } = useStudentDetail()

  return (
    <StudentShell title="Davomat" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <>
          <SectionCard icon={CalendarDays} title="Davomat xulosasi">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-base font-bold text-gray-900">{data.attendance_stats.total}</p>
                <p className="text-[9px] font-medium text-gray-400">Jami</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2.5 text-center">
                <p className="text-base font-bold text-green-600">{data.attendance_stats.present}</p>
                <p className="text-[9px] font-medium text-green-500">Bor</p>
              </div>
              <div className="bg-red-50 rounded-xl p-2.5 text-center">
                <p className="text-base font-bold text-red-600">{data.attendance_stats.absent}</p>
                <p className="text-[9px] font-medium text-red-500">Yo'q</p>
              </div>
            </div>
          </SectionCard>

          <div className="mb-2">
            <h3 className="text-xs font-bold text-gray-900 mb-2">Tarix ({data.attendance_history.length})</h3>
          </div>
          {data.attendance_history.length === 0 ? (
            <div className="card-premium">
              <EmptyBlock text="Davomat tarixi mavjud emas" />
            </div>
          ) : (
            <div className="card-premium divide-y divide-gray-50 overflow-hidden">
              {data.attendance_history.map((a) => (
                <div key={a.id} className="px-3 py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800">{a.date} · {a.group}</p>
                    <p className="text-[10px] font-medium text-gray-400 truncate">
                      {a.teacher}{a.created_at ? ` · ${a.created_at}` : ""}
                    </p>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${attStatusColors[a.status] || "bg-gray-100 text-gray-500"}`}>
                    {a.status_display}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </StudentShell>
  )
}
