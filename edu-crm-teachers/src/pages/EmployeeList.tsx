import { useEffect, useState } from "react"
import { api } from "../api"
import type { Employee } from "../types"

export default function EmployeeList({ onSelect }: { onSelect: (id: number) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    api.employees()
      .then((res) => setEmployees(res.employees))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-center text-gray-500">Yuklanmoqda...</div>
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Xodimlar</h1>
          <p className="text-sm text-gray-500">{employees.length} ta xodim</p>
        </div>
        <button
          onClick={() => onSelect(0)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Xodim qo'shish
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Xodim</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Telefon</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Vazifasi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Rol</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase">Guruhlar</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </div>
                      <div>
                        <button onClick={() => onSelect(emp.id)} className="font-medium text-gray-900 hover:text-blue-600 text-left">
                          {emp.first_name} {emp.last_name}
                        </button>
                        {emp.has_login && (
                          <div className="text-xs text-green-600">
                            <svg className="w-3 h-3 inline mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Login mavjud
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">+998 {emp.phone}</td>
                  <td className="px-4 py-3">
                    {emp.position ? (
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{emp.position.name}</span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {emp.role ? (
                      <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">{emp.role.name}</span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md text-xs font-medium">{emp.group_count} ta</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onSelect(emp.id)} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition">Profil</button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Xodimlar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
