import { useEffect, useState } from "react"
import { Loader2, Package, ShoppingBag } from "lucide-react"
import { api } from "../api"
import type { ShopOrderItem, ShopProduct } from "../types"

export default function ShopTab({ tr, onBalanceChange }: { tr: (s: string) => string; onBalanceChange: () => void }) {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [orders, setOrders] = useState<ShopOrderItem[]>([])
  const [balance, setBalance] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<ShopProduct | null>(null)
  const [error, setError] = useState("")

  const load = () => {
    setLoading(true)
    Promise.all([api.shopProducts(), api.shopOrders()])
      .then(([p, o]) => {
        setProducts(p.products)
        setBalance(p.balance)
        setEnabled(p.shop_enabled)
        setOrders(o.orders)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const buy = async (p: ShopProduct) => {
    setBuying(p.id)
    setError("")
    try {
      const requestId = `${p.id}-${Date.now()}`
      await api.shopBuy(p.id, 1, requestId)
      setConfirm(null)
      load()
      onBalanceChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik")
    } finally {
      setBuying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={22} className="animate-spin text-[#8A8A8E]" />
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="text-center py-12">
        <ShoppingBag size={30} className="mx-auto text-[#D1D1D6] mb-3" />
        <p className="text-[14px] text-[#8A8A8E]">Do'kon hozircha yopiq</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#FFF7E6]">
        <span className="text-[13px] text-[#B45309]">Xarid uchun balans</span>
        <span className="text-[15px] font-semibold text-[#B45309]">{balance}</span>
      </div>

      {error && <p className="text-[13px] text-red-500 font-medium">{error}</p>}

      {products.length === 0 ? (
        <div className="text-center py-10">
          <Package size={30} className="mx-auto text-[#D1D1D6] mb-3" />
          <p className="text-[14px] text-[#8A8A8E]">Mahsulotlar yo'q</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => {
            const purchasable = p.is_active && p.show_price
            const canBuy = purchasable && p.stock > 0 && balance >= p.coin_price
            return (
              <div key={p.id} className="rounded-2xl bg-[#F8F8FA] overflow-hidden">
                {p.image ? (
                  <img src={p.image} alt="" className="w-full h-24 object-cover bg-[#F2F2F5]" />
                ) : (
                  <div className="w-full h-24 bg-[#F2F2F5] flex items-center justify-center">
                    <ShoppingBag size={24} className="text-[#C7C7CC]" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-[13px] font-medium text-[#1B1B1F] truncate">{p.name}</p>
                  <p className="text-[11px] text-[#8A8A8E] truncate">
                    {p.category_name || ""} {p.stock > 0 ? `· ${p.stock} ta` : "· tugagan"}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[14px] font-semibold text-[#2001FF]">
                      {p.show_price ? `${p.coin_price} coin` : "?? coin"}
                    </span>
                    {purchasable ? (
                      <button
                        disabled={!canBuy}
                        onClick={() => setConfirm(p)}
                        className="px-3 py-1.5 rounded-xl bg-[#2001FF] text-white text-[11px] font-semibold btn-hover disabled:opacity-30"
                      >
                        Sotib olish
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#8A8A8E] font-semibold">Tez orada</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {orders.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-[#1B1B1F] mt-2 mb-2">Mening buyurtmalarim</p>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8F8FA]">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#1B1B1F] truncate">{o.product_name}</p>
                  <p className="text-[11px] text-[#8A8A8E]">
                    {o.status_display} · {o.created_at.slice(0, 10)}
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-[#8A8A8E] shrink-0">{o.total} coin</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 animate-page-enter">
            <p className="text-[17px] font-semibold text-[#1B1B1F] text-center">Xaridni tasdiqlash</p>
            <p className="text-[13px] text-[#8A8A8E] text-center mt-2">
              {confirm.name} — {confirm.coin_price} coin
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-3 rounded-2xl bg-[#F2F2F5] text-[#1B1B1F] text-[14px] font-semibold btn-hover"
              >
                {tr("Bekor qilish")}
              </button>
              <button
                onClick={() => buy(confirm)}
                disabled={buying === confirm.id}
                className="flex-1 py-3 rounded-2xl bg-[#2001FF] text-white text-[14px] font-semibold btn-hover disabled:opacity-50 flex items-center justify-center"
              >
                {buying === confirm.id ? <Loader2 size={16} className="animate-spin" /> : "Sotib olish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}