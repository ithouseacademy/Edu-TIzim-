import { useEffect, useState } from "react"
import { api } from "./api"
import type { MessagingSettings } from "./types"

let cached: MessagingSettings | null = null
let inflight: Promise<MessagingSettings> | null = null

export function useMessagingSettings(): MessagingSettings | null {
  const [settings, setSettings] = useState<MessagingSettings | null>(cached)

  useEffect(() => {
    if (!inflight) {
      inflight = api
        .messagingSettings()
        .then((s) => {
          cached = s
          return s
        })
        .catch(() => {
          cached = { enabled: true, private_chats: true, group_chats: true, teachers_in_group_chats: true, role: "student" }
          return cached
        })
    }
    let alive = true
    inflight.then((s) => {
      if (alive) setSettings(s)
    })
    return () => {
      alive = false
    }
  }, [])

  return settings
}