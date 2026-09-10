self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }
  const title = data.title || "Bildirishnoma"
  const options = {
    body: data.body || "",
    data: { url: data.url || "/#tasks" },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  let target = "/#tasks"
  try {
    target = new URL(event.notification.data.url || "/#tasks", self.registration.scope).href
  } catch (e) {
    target = new URL("/#tasks", self.registration.scope).href
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.registration.scope)) {
          if ("focus" in client) return client.focus()
        }
      }
      return clients.openWindow(target)
    })
  )
})

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})