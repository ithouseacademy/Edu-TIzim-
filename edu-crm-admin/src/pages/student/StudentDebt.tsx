import { Wallet } from "lucide-react"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { SectionCard, StudentLoading, StudentError, fmtSum } from "./parts"

export default function StudentDebt() {
  const { data, loading, error } = useStudentDetail()

  return (
    <StudentShell title="Qarz / to'lov holati" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <SectionCard icon={Wallet} title="Qarz / to'lov holati">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[13px] font-bold text-gray-900">{fmtSum(data.debt.shu_kungacha)}</p>
              <p className="text-[8px] font-medium text-gray-400">Shu kungacha</p>
            </div>
            <div className="bg-red-50 rounded-xl p-2.5 text-center">
              <p className="text-[13px] font-bold text-red-600">{fmtSum(data.debt.oy_oxirigacha)}</p>
              <p className="text-[8px] font-medium text-red-400">Oy oxirigacha</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2.5 text-center">
              <p className="text-[13px] font-bold text-amber-600">{data.debt.remaining_lessons}</p>
              <p className="text-[8px] font-medium text-amber-500">Qolgan dars</p>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between bg-gray-50 rounded-lg px-2.5 py-2 mb-1.5">
              <span className="text-[11px] font-semibold text-gray-700">Kutilgan to'lov</span>
              <span className="text-[11px] font-bold text-gray-800">{fmtSum(data.debt.current_expected)}</span>
            </div>
            <div className="flex justify-between bg-gray-50 rounded-lg px-2.5 py-2">
              <span className="text-[11px] font-semibold text-gray-700">Oxirigacha qarz</span>
              <span className="text-[11px] font-bold text-red-600">{fmtSum(data.debt.total_owed)}</span>
            </div>
          </div>

          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Oylik qarzlar</p>
          {data.debt.monthly_debts.length > 0 ? (
            <div className="space-y-1">
              {data.debt.monthly_debts.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] font-semibold text-gray-700">{d.label}</span>
                  <span className="text-[11px] font-bold text-red-600">{fmtSum(d.debt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-medium text-gray-400">Oldingi qarzlar mavjud emas</p>
          )}
        </SectionCard>
      ) : null}
    </StudentShell>
  )
}
