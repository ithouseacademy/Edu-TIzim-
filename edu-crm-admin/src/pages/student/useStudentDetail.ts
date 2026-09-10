import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { api } from "../../api"
import type { StudentDetailResponse } from "../../types"

export function useStudentDetail() {
  const { id } = useParams()
  const [data, setData] = useState<StudentDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.studentDetail(Number(id))
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  return { id, data, setData, loading, error, setError }
}
