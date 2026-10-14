import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Megaphone, ExternalLink } from "lucide-react"
import { api } from "../api"
import { useAppSettings } from "../AppSettings"
import type { NewsItem } from "../types"

export default function NewsDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { tr } = useAppSettings()
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .getNews()
      .then((res) => {
        if (!active) return
        setItem((res.news || []).find((n) => String(n.id) === String(id)) || null)
      })
      .catch(() => {
        if (active) setItem(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  return (
    <div className="min-h-screen bg-[#F5F7FF] pb-20">
      <div className="max-w-lg mx-auto px-2.5 pt-8">
        <div className="flex items-center justify-between mb-4 animate-fade-in">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <ArrowLeft size={17} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#1464F4]/10 rounded-lg">
              <Megaphone size={16} className="text-[#1464F4]" />
            </div>
            <h1 className="text-base font-bold text-gray-900">{tr("Yangilik")}</h1>
          </div>
          <div className="w-8 h-8" />
        </div>

        {loading ? (
          <p className="text-center text-[11px] font-medium text-gray-400 py-16">Yuklanmoqda...</p>
        ) : !item ? (
          <div className="card-premium p-8 flex flex-col items-center gap-2 text-center animate-scale-in">
            <Megaphone size={28} className="text-gray-300" />
            <p className="text-[13px] font-bold text-gray-900">Yangilik topilmadi</p>
            <p className="text-[11px] font-medium text-gray-400">Bu yangilik o'chirilgan yoki hali yaylanmagan</p>
          </div>
        ) : (
          <article className="card-premium p-4 animate-scale-in">
            {item.image && (
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-44 object-cover rounded-2xl mb-3"
              />
            )}
            <span className="text-[9px] font-bold text-[#1464F4] uppercase tracking-wide">
              {tr(item.category_display)}
            </span>
            <h2 className="text-[17px] font-bold text-gray-900 leading-snug mt-1.5">{tr(item.title)}</h2>
            <p className="text-[10px] font-medium text-gray-400 mt-1.5">
              {item.published_at || item.created_at}
            </p>
            {item.body && (
              <p className="text-[13px] font-medium text-gray-700 leading-relaxed mt-3 whitespace-pre-wrap">
                {tr(item.body)}
              </p>
            )}
            {item.link && (
              <button
                onClick={() => window.open(item.link, "_blank", "noopener,noreferrer")}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#1464F4] py-3 text-white shadow-md shadow-[#1464F4]/20 active:scale-[0.98] transition-transform"
              >
                <ExternalLink size={15} strokeWidth={2.5} />
                <span className="text-[12px] font-bold">{item.link_text || tr("Batafsil")}</span>
              </button>
            )}
          </article>
        )}
      </div>
    </div>
  )
}
