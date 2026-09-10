import { Wallet, ArrowUpCircle, BookOpen, RefreshCcw, ArrowDownCircle, Clock } from "lucide-react"
import { StudentShell } from "./StudentShell"
import { useStudentDetail } from "./useStudentDetail"
import { StudentLoading, StudentError } from "./parts"

const txColors: Record<string, { bg: string; text: string; icon: any }> = {
  payment: { bg: "bg-green-50", text: "text-green-600", icon: ArrowUpCircle },
  lesson: { bg: "bg-red-50", text: "text-red-600", icon: BookOpen },
  correction: { bg: "bg-amber-50", text: "text-amber-600", icon: RefreshCcw },
  withdrawal: { bg: "bg-violet-50", text: "text-violet-600", icon: ArrowDownCircle },
  wrong: { bg: "bg-gray-100", text: "text-gray-500", icon: Clock },
}

export default function StudentPayments() {
  const { data, loading, error } = useStudentDetail()

  return (
    <StudentShell title="To'lov tarixi" studentId={data?.student.id}>
      {error && <StudentError message={error} />}
      {loading ? (
        <StudentLoading />
      ) : data ? (
        <>
          <div className="mb-2">
            <h3 className="text-xs font-bold text-gray-900 mb-2">Tranzaksiyalar ({data.transactions.length})</h3>
          </div>
          {data.transactions.length === 0 ? (
            <div className="card-premium p-6 text-center">
              <Wallet size={22} className="mx-auto text-gray-300 mb-1.5" />
              <p className="text-xs font-medium text-gray-400">Tranzaksiyalar mavjud emas</p>
            </div>
          ) : (
            <div className="card-premium divide-y divide-gray-50 overflow-hidden">
              {data.transactions.map((t) => {
                const cfg = txColors[t.type] || txColors.wrong
                const Icon = cfg.icon
                const isPositive = t.amount >= 0
                return (
                  <div key={t.id} className="px-3 py-2.5 flex items-center gap-2.5 animate-fade-in">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={15} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-gray-900 truncate">{t.type_display}</p>
                      {t.description && (
                        <p className="text-[9px] font-medium text-gray-400 truncate">{t.description}</p>
                      )}
                      <p className="text-[9px] font-medium text-gray-400">
                        {t.created_at}{t.created_by ? ` · ${t.created_by}` : ""}
                      </p>
                    </div>
                    <span className={`text-[12px] font-bold shrink-0 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {t.amount_str}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </StudentShell>
  )
}
