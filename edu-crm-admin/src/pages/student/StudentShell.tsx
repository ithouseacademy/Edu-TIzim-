import { useNavigate } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import WaveHeader from "../../components/WaveHeader"

export function StudentShell({
  title,
  children,
  studentId,
}: {
  title: string
  children: React.ReactNode
  studentId?: number
}) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <WaveHeader
        title={title}
        leftSlot={
          <button
            onClick={() => (studentId ? navigate(`/students/${studentId}`) : navigate(-1))}
            className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25 flex items-center justify-center btn-hover"
          >
            <ChevronLeft size={14} className="text-white" />
          </button>
        }
        rightSlot={
          <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-full border border-white/25" />
        }
      />
      <div className="max-w-lg mx-auto px-3">{children}</div>
    </div>
  )
}
