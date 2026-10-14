import { useEffect, useState } from "react"
import { ShoppingBag, Loader2, Plus, X, Pencil, CheckCircle2, PackageOpen, XCircle, Eye } from "lucide-react"
import { api } from "../../api"
import type { ShopCategory, ShopOrderItem, ShopProduct } from "../../types"
import type { SectionProps } from "./props"

type Tab = "products" | "categories" | "orders"

const ORDER_STATUS: { key: string; label: string }[] = [
  { key: "", label: "Barchasi" },
  { key: "pending", label: "Kutilmoqda" },
  { key: "approved", label: "Tasdiqlangan" },
  { key: "given", label: "Berilgan" },
  { key: "cancelled", label: "Bekor" },
]

export default function CoinShop({ isSuper, has }: SectionProps) {
  const [tab, setTab] = useState<Tab>("products")
  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: "Mahsulotlar" },
    { key: "categories", label: "Kategoriyalar" },
    { key: "orders", label: "Buyurtmalar" },
  ]
  return (
    <div className="space-y-3 animate-page-enter">
      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-full text-[11px] font-semibold transition-colors btn-hover ${
              tab === t.key ? "bg-[#2001FF] text-white" : "bg-white text-gray-500 border border-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "products" && <ProductsSection isSuper={isSuper} has={has} />}
      {tab === "categories" && <CategoriesSection isSuper={isSuper} has={has} />}
      {tab === "orders" && <OrdersSection isSuper={isSuper} has={has} />}
    </div>
  )
}

function ProductsSection({ isSuper, has }: { isSuper: boolean; has: SectionProps["has"] }) {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ShopProduct | "new" | null>(null)

  const canCreate = isSuper || has("shop.product_create")
  const canEdit = isSuper || has("shop.product_edit")
  const canDelete = isSuper || has("shop.product_delete")

  const load = () => {
    setLoading(true)
    api
      .shopProducts()
      .then((d) => setProducts(d.products))
      .finally(() => setLoading(false))
    api.shopCategories().then((d) => setCategories(d.categories)).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (p: ShopProduct) => {
    if (!canDelete) return
    await api.toggleShopProduct(p.id, !p.is_active)
    load()
  }

  return (
    <div className="space-y-2">
      {canCreate && (
        <button
          onClick={() => setEditing("new")}
          className="w-full card-premium p-3.5 flex items-center justify-center gap-2 text-[12px] font-bold text-[#2001FF] btn-hover"
        >
          <Plus size={15} /> Yangi mahsulot
        </button>
      )}
      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <ShoppingBag size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-[12px] font-semibold text-gray-500">Mahsulotlar yo'q</p>
        </div>
      ) : (
        products.map((p) => (
          <div key={p.id} className="card-premium p-3.5 flex items-center gap-3">
            {p.image ? (
              <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#2001FF]/10 flex items-center justify-center">
                <ShoppingBag size={18} className="text-[#2001FF]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-gray-900 truncate">{p.name}</p>
              <p className="text-[9px] text-gray-400 truncate">
                {p.category_name || "Kategoriyasiz"} · {p.stock} dona
              </p>
              <p className="text-[11px] font-extrabold text-[#2001FF] mt-0.5">{p.coin_price} coin</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {canEdit && (
                <button
                  onClick={() => setEditing(p)}
                  className="w-7 h-7 bg-[#F4F5FA] rounded-lg flex items-center justify-center btn-hover"
                >
                  <Pencil size={12} className="text-gray-500" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => toggle(p)}
                  className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 ${
                    p.is_active ? "bg-[#2001FF]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                      p.is_active ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function ProductForm({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: ShopProduct | null
  categories: ShopCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ? String(product.category_id) : "",
    coin_price: product ? String(product.coin_price) : "10",
    stock: product ? String(product.stock) : "0",
    is_active: product?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description,
        category_id: form.category_id ? Number(form.category_id) : null,
        coin_price: Number(form.coin_price) || 0,
        stock: Number(form.stock) || 0,
        is_active: form.is_active,
      }
      if (product) {
        await api.updateShopProduct(product.id, body)
      } else {
        await api.createShopProduct(body)
      }
      onSaved()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 animate-page-enter">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-gray-900">
            {product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center btn-hover">
            <X size={14} className="text-gray-500" />
          </button>
        </div>
        <div className="space-y-2.5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Mahsulot nomi"
            className="w-full px-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[13px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Tavsif (ixtiyoriy)"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[13px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30 resize-none"
          />
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[13px] font-medium outline-none"
          >
            <option value="">Kategoriyasiz</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-1">Narx (coin)</p>
              <input
                type="number"
                min="0"
                value={form.coin_price}
                onChange={(e) => setForm({ ...form, coin_price: e.target.value.replace(/\D/g, "") })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[13px] font-bold outline-none focus:ring-2 ring-[#2001FF]/30"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 mb-1">Qoldiq</p>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[13px] font-bold outline-none focus:ring-2 ring-[#2001FF]/30"
              />
            </div>
          </div>
          {product && (
            <label className="flex items-center justify-between px-1 py-1">
              <span className="text-[12px] font-semibold text-gray-700">Sotuvda</span>
              <button
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  form.is_active ? "bg-[#2001FF]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.is_active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          )}
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="w-full py-3 rounded-2xl bg-[#2001FF] text-white text-[13px] font-bold btn-hover disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoriesSection({ isSuper, has }: { isSuper: boolean; has: SectionProps["has"] }) {
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)

  const canCreate = isSuper || has("shop.product_create")
  const canDelete = isSuper || has("shop.product_delete")

  const load = () => {
    setLoading(true)
    api.shopCategories().then((d) => setCategories(d.categories)).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    if (!name.trim()) return
    await api.createShopCategory(name.trim())
    setName("")
    load()
  }

  const toggle = async (c: ShopCategory) => {
    await api.toggleShopCategory(c.id, !c.is_active)
    load()
  }

  return (
    <div className="space-y-2">
      {canCreate && (
        <div className="card-premium p-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Yangi kategoriya nomi"
            className="flex-1 px-3 py-2.5 rounded-xl bg-[#F4F5FA] text-[12px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30"
          />
          <button onClick={add} className="px-4 py-2.5 rounded-xl bg-[#2001FF] text-white text-[12px] font-semibold btn-hover">
            <Plus size={14} />
          </button>
        </div>
      )}
      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : (
        categories.map((c) => (
          <div key={c.id} className="card-premium p-3.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-gray-900 truncate">{c.name}</p>
              <p className="text-[9px] text-gray-400">{c.products_count ?? 0} ta mahsulot</p>
            </div>
            {canDelete && (
              <button
                onClick={() => toggle(c)}
                className={`relative w-9 h-[18px] rounded-full transition-colors duration-200 ${
                  c.is_active ? "bg-[#2001FF]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                    c.is_active ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function OrdersSection({ isSuper, has }: { isSuper: boolean; has: SectionProps["has"] }) {
  const [orders, setOrders] = useState<ShopOrderItem[]>([])
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const canApprove = isSuper || has("shop.order_approve")

  const load = (st = status, srch = search) => {
    setLoading(true)
    api
      .shopOrders(st, srch)
      .then((d) => setOrders(d.orders))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const changeStatus = async (id: number, next: string) => {
    if (!canApprove) return
    try {
      await api.setShopOrderStatus(id, next)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik")
    }
  }

  const iconFor = (s: string) => {
    switch (s) {
      case "approved":
        return <CheckCircle2 size={13} className="text-blue-500" />
      case "given":
        return <PackageOpen size={13} className="text-green-600" />
      case "cancelled":
        return <XCircle size={13} className="text-red-400" />
      default:
        return <Eye size={13} className="text-amber-500" />
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="card-premium p-3">
        <div className="flex gap-1.5 flex-wrap">
          {ORDER_STATUS.map((o) => (
            <button
              key={o.key}
              onClick={() => setStatus(o.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors btn-hover ${
                status === o.key ? "bg-[#2001FF] text-white" : "bg-[#F4F5FA] text-gray-500"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(status, search)}
          placeholder="O'quvchi qidirish..."
          className="w-full mt-2 px-3 py-2 rounded-xl bg-[#F4F5FA] text-[12px] font-medium outline-none focus:ring-2 ring-[#2001FF]/30"
        />
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center">
          <Loader2 size={20} className="text-[#2001FF] animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card-premium p-8 text-center">
          <ShoppingBag size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-[12px] font-semibold text-gray-500">Buyurtmalar yo'q</p>
        </div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="card-premium p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-gray-900 truncate">#{o.id} · {o.student_name}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {o.product_name} × {o.quantity} = {o.total} coin
                </p>
              </div>
              <span
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold shrink-0 ${
                  o.status === "given"
                    ? "bg-green-50 text-green-600"
                    : o.status === "cancelled"
                      ? "bg-red-50 text-red-400"
                      : o.status === "approved"
                        ? "bg-blue-50 text-blue-500"
                        : "bg-amber-50 text-amber-600"
                }`}
              >
                {iconFor(o.status)}
                {o.status_display}
              </span>
            </div>
            {canApprove && o.status === "pending" && (
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => changeStatus(o.id, "approved")}
                  className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-[11px] font-bold btn-hover"
                >
                  Tasdiqlash
                </button>
                <button
                  onClick={() => changeStatus(o.id, "cancelled")}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[11px] font-bold btn-hover"
                >
                  Bekor qilish
                </button>
              </div>
            )}
            {canApprove && o.status === "approved" && (
              <button
                onClick={() => changeStatus(o.id, "given")}
                className="w-full mt-2.5 py-2 rounded-xl bg-green-600 text-white text-[11px] font-bold btn-hover flex items-center justify-center gap-1.5"
              >
                <PackageOpen size={12} /> Berilgan deb belgilash
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}