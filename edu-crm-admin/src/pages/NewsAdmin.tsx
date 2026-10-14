import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Pencil, Trash2, Newspaper, Pin, PinOff, Check, X, ChevronDown, Link2 } from "lucide-react"
import { api } from "../api"
import type { NewsCategory, NewsItem } from "../types"

type FormState = {
  title: string
  body: string
  category: string
  audience: string
  group_ids: number[]
  link: string
  link_text: string
  is_published: boolean
  is_pinned: boolean
}

const emptyForm = (category: string): FormState => ({
  title: "",
  body: "",
  category: category || "yangilik",
  audience: "barcha",
  group_ids: [],
  link: "",
  link_text: "",
  is_published: true,
  is_pinned: false,
})

export default function NewsAdmin() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsItem[]>([])
  const [categories, setCategories] = useState<NewsCategory[]>([])
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(""))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [showGroups, setShowGroups] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const d = await api.news()
      setItems(d.news)
      setCategories(d.categories)
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    api.adminGroups().then((d) => setGroups(d.groups || [])).catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(categories[0]?.value || "yangilik"))
    setMsg(null)
    setShowForm(true)
  }

  const openEdit = (n: NewsItem) => {
    setEditing(n)
    setForm({
      title: n.title,
      body: n.body,
      category: n.category,
      audience: n.audience,
      group_ids: n.group_ids || [],
      link: n.link || "",
      link_text: n.link_text || "",
      is_published: n.is_published,
      is_pinned: n.is_pinned,
    })
    setMsg(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setMsg({ type: "err", text: "Sarlavha kiritish shart" })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      if (editing) {
        await api.updateNews(editing.id, form)
        setMsg({ type: "ok", text: "Yangilik yangilandi" })
      } else {
        await api.createNews(form)
        setMsg({ type: "ok", text: "Yangilik yaratildi" })
      }
      setShowForm(false)
      setEditing(null)
      await load()
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (n: NewsItem) => {
    try {
      await api.updateNews(n.id, { ...n, is_published: !n.is_published })
      await load()
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    }
  }

  const togglePin = async (n: NewsItem) => {
    try {
      await api.updateNews(n.id, { ...n, is_pinned: !n.is_pinned })
      await load()
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    }
  }

  const handleDelete = async (n: NewsItem) => {
    if (!window.confirm(`«${n.title}» yangligini o'chirilsinmi?`)) return
    try {
      await api.deleteNews(n.id)
      await load()
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Xatolik yuz berdi" })
    }
  }

  const toggleGroup = (id: number) => {
    setForm((f) => ({
      ...f,
      group_ids: f.group_ids.includes(id) ? f.group_ids.filter((x) => x !== id) : [...f.group_ids, id],
    }))
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 animate-page-enter">
      <div className="max-w-lg mx-auto px-3 pt-8">
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm btn-hover"
          >
            <ArrowLeft size={17} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-[#2001FF]/10 rounded-lg flex items-center justify-center">
              <Newspaper size={13} className="text-[#2001FF]" />
            </div>
            <h1 className="text-sm font-bold text-gray-900">Yangiliklar</h1>
          </div>
          <button
            onClick={openCreate}
            className="w-8 h-8 bg-[#2001FF] rounded-xl flex items-center justify-center shadow-md shadow-[#2001FF]/20 btn-hover"
          >
            <Plus size={17} className="text-white" strokeWidth={2.5} />
          </button>
        </header>

        {msg && !showForm && (
          <div
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl mb-3 text-[11px] font-medium ${
              msg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            }`}
          >
            {msg.type === "ok" ? <Check size={13} /> : <X size={13} />}
            {msg.text}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="card-premium p-3.5 space-y-3 mb-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h2 className="text-[12px] font-bold text-gray-900">
                {editing ? "Yangilikni tahrirlash" : "Yangi yangilik"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
                className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center btn-hover"
              >
                <X size={13} className="text-gray-500" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
                Sarlavha
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Masalan: Yangi o'quv yili boshlandi"
                maxLength={255}
                className="w-full rounded-lg px-3 py-2.5 bg-gray-50 border border-transparent focus-within:border-[#2001FF] focus-within:bg-white transition-all duration-200 text-[12px] font-medium text-[#111827] outline-none placeholder:text-gray-300"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
                Matn
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Yangilik matnini yozing..."
                rows={5}
                className="w-full rounded-lg px-3 py-2.5 bg-gray-50 border border-transparent focus-within:border-[#2001FF] focus-within:bg-white transition-all duration-200 text-[12px] font-medium text-[#111827] outline-none placeholder:text-gray-300 resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
                Havola <span className="normal-case tracking-normal text-gray-300">(ixtiyoriy)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="url"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://telegram.me/... yoki sayt.manzil"
                  className="flex-1 min-w-0 rounded-lg px-3 py-2.5 bg-gray-50 border border-transparent focus-within:border-[#2001FF] focus-within:bg-white transition-all duration-200 text-[12px] font-medium text-[#111827] outline-none placeholder:text-gray-300"
                />
                <input
                  type="text"
                  value={form.link_text}
                  onChange={(e) => setForm({ ...form, link_text: e.target.value })}
                  placeholder="Batafsil"
                  maxLength={60}
                  className="w-28 shrink-0 rounded-lg px-3 py-2.5 bg-gray-50 border border-transparent focus-within:border-[#2001FF] focus-within:bg-white transition-all duration-200 text-[12px] font-medium text-[#111827] outline-none placeholder:text-gray-300"
                />
              </div>
              <p className="text-[10px] font-medium text-gray-300 mt-1.5">
                Bo'sh qoldirilsa — o'quvchi ilova ichida ochadi. `https://` avtomatik qo'shiladi.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
                Tur
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.value })}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                      form.category === c.value
                        ? "bg-[#2001FF] text-white shadow-md shadow-[#2001FF]/15"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-[1.5px] mb-1.5 block">
                Kimlar uchun
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, audience: "barcha", group_ids: [] })}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                    form.audience === "barcha" ? "bg-[#2001FF] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  Barcha o'quvchilar
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, audience: "guruh" })}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                    form.audience === "guruh" ? "bg-[#2001FF] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  Tanlangan guruhlar
                </button>
              </div>
            </div>

            {form.audience === "guruh" && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowGroups(!showGroups)}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 bg-gray-50 border border-transparent focus-within:border-[#2001FF] transition-all duration-200"
                >
                  <span className="text-[12px] font-medium text-[#111827]">
                    {form.group_ids.length > 0 ? `${form.group_ids.length} ta guruh tanlangan` : "Guruhni tanlang"}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-gray-400 transition-transform duration-200 ${showGroups ? "rotate-180" : ""}`}
                  />
                </button>
                {showGroups && (
                  <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-1.5 space-y-0.5">
                    {groups.map((g) => {
                      const on = form.group_ids.includes(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition-colors ${
                            on ? "bg-white" : "hover:bg-white/60"
                          }`}
                        >
                          <span className={`text-[11px] font-medium ${on ? "text-[#2001FF]" : "text-gray-600"}`}>
                            {g.name}
                          </span>
                          {on && <Check size={13} className="text-[#2001FF]" strokeWidth={3} />}
                        </button>
                      )
                    })}
                    {groups.length === 0 && (
                      <p className="px-2.5 py-2 text-[11px] text-gray-400">Guruhlar topilmadi</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_published: !form.is_published })}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-bold transition-all duration-200 ${
                  form.is_published
                    ? "bg-green-50 text-green-600 border border-green-200"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <Check size={14} strokeWidth={2.5} />
                {form.is_published ? "Yaylangan" : "Qoralamada"}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_pinned: !form.is_pinned })}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-bold transition-all duration-200 ${
                  form.is_pinned
                    ? "bg-[#2001FF]/10 text-[#2001FF] border border-[#2001FF]/30"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {form.is_pinned ? <Pin size={14} /> : <PinOff size={14} />}
                Mahkamlash
              </button>
            </div>

            {msg && (
              <div
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium ${
                  msg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                }`}
              >
                {msg.type === "ok" ? <Check size={13} /> : <X size={13} />}
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-10 rounded-xl bg-[#2001FF] text-white text-[12px] font-bold shadow-md shadow-[#2001FF]/15 transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
            >
              {saving ? "Saqlanmoqda..." : editing ? "Saqlash" : "Yaratish"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-16 text-[12px] font-medium text-gray-400">Yuklanmoqda...</div>
        ) : items.length === 0 ? (
          <div className="card-premium p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-[#2001FF]/10 rounded-2xl flex items-center justify-center">
              <Newspaper size={22} className="text-[#2001FF]" />
            </div>
            <p className="text-[13px] font-bold text-gray-900">Hali yangilik yo'q</p>
            <p className="text-[11px] font-medium text-gray-400 leading-relaxed">
              O'quvchilar ilovasida ko'rinadigan birinchi yangilikni yarating
            </p>
            <button
              onClick={openCreate}
              className="mt-1 h-9 px-4 rounded-xl bg-[#2001FF] text-white text-[12px] font-bold shadow-md shadow-[#2001FF]/15 btn-hover"
            >
              Yangilik yaratish
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <div key={n.id} className="card-premium p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-[#2001FF]/10 text-[#2001FF] text-[9px] font-bold uppercase tracking-wide">
                        {n.category_display}
                      </span>
                      {n.is_pinned && <Pin size={11} className="text-[#2001FF]" />}
                      {!n.is_published && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-wide">
                          Qoralamada
                        </span>
                      )}
                    </div>
                    <h3 className="text-[13px] font-bold text-gray-900 leading-snug">{n.title}</h3>
                    {n.body && (
                      <p className="mt-1 text-[11px] font-medium text-gray-500 leading-relaxed line-clamp-2">{n.body}</p>
                    )}
                    <p className="mt-1.5 text-[10px] font-medium text-gray-400">
                      {n.published_at || n.created_at}
                      {n.created_by ? ` · ${n.created_by}` : ""}
                      {n.audience === "guruh" ? ` · ${n.group_ids.length} ta guruh` : " · Barcha o'quvchilar"}
                    </p>
                    {n.link && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#2001FF]/5 px-2 py-1 text-[10px] font-semibold text-[#2001FF] max-w-full">
                        <Link2 size={11} strokeWidth={2.5} className="shrink-0" />
                        <span className="truncate">{n.link}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => togglePublish(n)}
                      title={n.is_published ? "Qoralamaga o'tkazish" : "Yaylash"}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors btn-hover ${
                        n.is_published ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Check size={13} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => togglePin(n)}
                      title={n.is_pinned ? "Mahkamdan olish" : "Mahkamlash"}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors btn-hover ${
                        n.is_pinned ? "bg-[#2001FF]/10 text-[#2001FF]" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Pin size={13} />
                    </button>
                    <button
                      onClick={() => openEdit(n)}
                      title="Tahrirlash"
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center btn-hover"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(n)}
                      title="O'chirish"
                      className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center btn-hover"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
