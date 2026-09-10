export function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="card-premium p-3 mb-3">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
          <Icon size={14} className="text-[#2001FF]" />
        </div>
        <h3 className="text-[12px] font-bold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export function InfoRow({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon size={13} className="text-gray-400 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-[12px] font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}

export function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="py-3 text-center">
      <p className="text-[11px] font-medium text-gray-400">{text}</p>
    </div>
  )
}

export function StudentLoading() {
  return (
    <div className="card-premium p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#2001FF]/30 border-t-[#2001FF] rounded-full animate-spin" />
    </div>
  )
}

export function StudentError({ message }: { message: string }) {
  return (
    <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium mb-3">{message}</div>
  )
}

export const fmtSum = (n: number) => `${n.toLocaleString("ru-RU")} so'm`
