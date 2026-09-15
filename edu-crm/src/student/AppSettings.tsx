/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { CheckCircle2 } from "lucide-react"
import { LANGS, translate, type Lang, type Theme } from "./i18n"

export type { Lang, Theme }

interface AppSettingsValue {
  lang: Lang
  theme: Theme
  avatar: string | null
  setLang: (l: Lang) => void
  setTheme: (t: Theme) => void
  setAvatar: (dataUrl: string | null) => void
  toast: (msg: string) => void
  tr: (key: string) => string
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null)

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider")
  return ctx
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("app_lang") as Lang) || "uz")
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("app_theme") as Theme) || "light")
  const [avatar, setAvatarState] = useState<string | null>(() => localStorage.getItem("app_avatar"))
  const [toastMsg, setToastMsg] = useState("")
  const [toastId, setToastId] = useState(0)

  const tr = useCallback((key: string) => translate(lang, key), [lang])

  useEffect(() => {
    localStorage.setItem("app_lang", lang)
    document.documentElement.setAttribute("lang", lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem("app_theme", theme)
    document.documentElement.classList.toggle("app-dark", theme === "dark")
  }, [theme])

  useEffect(() => {
    localStorage.setItem("app_avatar", avatar || "")
  }, [avatar])

  useEffect(() => {
    if (toastId === 0) return
    const timer = setTimeout(() => setToastMsg(""), 2500)
    return () => clearTimeout(timer)
  }, [toastId])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastId(Date.now())
  }, [])

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l)
      showToast(`${translate(l, "Til")}: ${LANGS[l]}`)
    },
    [showToast]
  )

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t)
      showToast(`${translate(lang, "Mavzu")}: ${translate(lang, t === "dark" ? "Tunli" : "Yorug'")}`)
    },
    [showToast, lang]
  )

  const setAvatar = useCallback(
    (dataUrl: string | null) => {
      setAvatarState(dataUrl)
      if (!dataUrl) return
      showToast(translate(lang, "Avatar saqlandi"))
    },
    [showToast, lang]
  )

  const toast = useCallback((msg: string) => showToast(msg), [showToast])

  return (
    <AppSettingsContext.Provider
      value={{ lang, theme, avatar, setLang, setTheme, setAvatar, toast, tr }}
    >
      {children}
      {toastMsg && (
        <div
          key={toastId}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-gray-900/95 text-white text-[13px] font-semibold px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-premium-lg animate-fade-in"
        >
          <CheckCircle2 size={15} className="text-green-400" />
          {toastMsg}
        </div>
      )}
    </AppSettingsContext.Provider>
  )
}