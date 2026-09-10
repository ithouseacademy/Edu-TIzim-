import type { ReactNode } from "react"

interface WaveHeaderProps {
  title: string
  subtitle?: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
}

export default function WaveHeader({ title, subtitle, leftSlot, rightSlot }: WaveHeaderProps) {
  return (
    <header className="relative bg-gradient-to-b from-[#3E37FF] via-[#2001FF] to-[#1B00E0] text-white shadow-md shadow-[#2001FF]/20">
      <div className="relative max-w-lg mx-auto px-4 pt-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="w-7 shrink-0">{leftSlot}</div>
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-[13px] font-bold leading-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-[9px] font-medium text-white/65 mt-px truncate">{subtitle}</p>
            )}
          </div>
          <div className="w-7 shrink-0 flex justify-end">{rightSlot}</div>
        </div>
      </div>
    </header>
  )
}
