import { useState } from "react"
import { GraduationCap, LogOut, Loader2 } from "lucide-react"
import { api } from "../../api"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { SectionCard, StudentLoading, StudentError, EmptyBlock } from "./parts"

export default function StudentGroups() {
  const { id, data, setData, loading, error, setError } = useStudentDetail()
  const [removingId, setRemovingId] = useState<number | null>(null)

  const handleRemove = async (groupId: number, groupName: string) => {
    if (!id) return
    const ok = window.confirm(`"${groupName}" guruhidan chiqarilsinmi?`)
    if (!ok) return
    setRemovingId(groupId)
    setError("")
    try {
      await api.studentRemoveGroup(Number(id), groupId)
      const d = await api.studentDetail(Number(id))
      setData(d)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <StudentShell title="Guruhlar" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <SectionCard icon={GraduationCap} title={`Guruhlar (${data.groups.length})`}>
          {data.groups.length === 0 ? (
            <EmptyBlock text="Guruhlarga biriktirilmagan" />
          ) : (
            <div className="space-y-1.5">
              {data.groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-2">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{g.name}</p>
                    <span
                      className={`inline-block text-[8px] font-semibold px-1.5 py-0.5 rounded ${
                        g.graduated ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                      }`}
                    >
                      {g.graduated ? "Bitirgan" : "Aktiv"}
                    </span>
                  </div>
                  {!g.graduated && (
                    <button
                      onClick={() => handleRemove(g.id, g.name)}
                      disabled={removingId === g.id}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg btn-hover shrink-0 disabled:opacity-50"
                    >
                      {removingId === g.id ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                      {removingId === g.id ? "Chiqarilmoqda..." : "Chiqarish"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </StudentShell>
  )
}
