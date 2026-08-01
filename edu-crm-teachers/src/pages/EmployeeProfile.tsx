import { useEffect, useState } from "react"
import { api } from "../api"
import type { EmployeeDetail } from "../types"

export default function EmployeeProfile({ id, onBack }: { id: number; onBack: () => void }) {
  const [data, setData] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    api.employee(id)
      .then((res) => setData(res.employee))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6 text-center text-gray-500">Yuklanmoqda...</div>
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>
  if (!data) return null

  const emp = data

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Orqaga
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
                {emp.first_name[0]}{emp.last_name[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{emp.first_name} {emp.last_name}</h2>
                {emp.has_login && <span className="text-xs text-green-600"><svg className="w-3 h-3 inline mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Login mavjud</span>}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Telefon</span>
                <span className="font-medium">+998 {emp.phone}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{emp.email || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Jinsi</span>
                <span className="font-medium">{emp.gender_display || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Tug'ilgan sana</span>
                <span className="font-medium">{emp.birth_date ? new Date(emp.birth_date).toLocaleDateString("uz-UZ") : "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Vazifasi</span>
                <span className="font-medium">{emp.position?.name || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Rol</span>
                <span className="font-medium">{emp.role?.name || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Guruhlar soni</span>
                <span className="font-medium">{emp.group_count} ta</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Filiallar</span>
                <span className="font-medium">{emp.branches.map((b) => b.name).join(", ") || "-"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Ish haqi</span>
                <span className="font-medium">{emp.salary_enabled ? `${emp.salary?.toLocaleString() ?? 0} so'm` : "Chiqmaydi"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Izoh</span>
                <span className="font-medium text-right max-w-[200px]">{emp.notes || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Guruhlari ({emp.groups.length})</h3>
          </div>
          {emp.groups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs uppercase">#</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs uppercase">Guruh</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs uppercase">Kurs</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs uppercase">O'quvchilar</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs uppercase">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.groups.map((g, i) => (
                    <tr key={g.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-blue-600">{g.name}</td>
                      <td className="px-4 py-3 text-gray-600">{g.course || "-"}</td>
                      <td className="px-4 py-3 text-center">{g.student_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                          g.status === "aktiv" ? "bg-green-50 text-green-700" :
                          g.status === "kutilyotgan" ? "bg-yellow-50 text-yellow-700" :
                          "bg-gray-50 text-gray-500"
                        }`}>{g.status_display}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>Bu xodimga guruh biriktirilmagan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
