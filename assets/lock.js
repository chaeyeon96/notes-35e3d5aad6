// Private build: unlock screen + decrypt the current page (AES-GCM, key from PBKDF2).
;(async function () {
  const base = window.SITE_BASE || ""
  const KEY = "study-wiki-key"
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))

  async function importRaw(raw) {
    return crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["decrypt"])
  }
  async function decrypt(key, bytes) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  }
  function storedKey() {
    try {
      return sessionStorage.getItem(KEY) || localStorage.getItem(KEY)
    } catch (e) {
      return null
    }
  }

  async function openPage(key) {
    const html = new TextDecoder().decode(await decrypt(key, b64(document.getElementById("payload").textContent.trim())))
    // Replace the whole shell only after it has finished loading; writing earlier would append instead.
    if (document.readyState !== "complete") await new Promise((r) => addEventListener("load", r, { once: true }))
    document.open()
    document.write(html)
    document.close()
  }

  const saved = storedKey()
  if (saved) {
    try {
      return await openPage(await importRaw(b64(saved)))
    } catch (e) {
      // Password changed since the key was saved: ask again.
      try {
        localStorage.removeItem(KEY)
        sessionStorage.removeItem(KEY)
      } catch (err) {}
    }
  }

  const screen = document.querySelector(".lock-screen")
  const form = screen.querySelector("form")
  const msg = screen.querySelector(".lock-msg")
  screen.hidden = false
  form.password.focus()

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    msg.textContent = "여는 중…"
    try {
      const lock = await fetch(base + "/lock.json", { cache: "no-cache" }).then((r) => r.json())
      const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(form.password.value), "PBKDF2", false, ["deriveBits"])
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: b64(lock.salt), iterations: lock.iter },
        material,
        256,
      )
      const key = await importRaw(bits)
      await decrypt(key, b64(lock.check)) // throws if the password is wrong
      try {
        ;(form.remember.checked ? localStorage : sessionStorage).setItem(KEY, toB64(bits))
      } catch (err) {}
      await openPage(key)
    } catch (err) {
      msg.textContent = "비밀번호가 맞지 않아요."
      form.password.select()
    }
  })
})()
