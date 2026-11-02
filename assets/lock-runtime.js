// Private build, runs inside a decrypted page: decrypt images and the search index,
// register the service worker (offline / install), and the 🔒 menu (save all, lock).
;(function () {
  const base = window.SITE_BASE || ""
  const KEY = "study-wiki-key"
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" }

  let keyPromise = null
  function getKey() {
    if (!keyPromise) {
      let raw = null
      try {
        raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY)
      } catch (e) {}
      keyPromise = raw ? crypto.subtle.importKey("raw", b64(raw), "AES-GCM", false, ["decrypt"]) : Promise.reject(new Error("locked"))
    }
    return keyPromise
  }
  async function bytes(url) {
    const data = new Uint8Array(await fetch(url).then((r) => r.arrayBuffer()))
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, await getKey(), data.slice(12))
  }
  async function blobUrl(url) {
    const ext = (url.match(/\.(\w+)\.bin$/) || [])[1] || ""
    return URL.createObjectURL(new Blob([await bytes(url)], { type: MIME[ext.toLowerCase()] || "application/octet-stream" }))
  }
  window.studyLock = {
    json: async (url) => JSON.parse(new TextDecoder().decode(await bytes(url))),
  }

  function lock() {
    try {
      localStorage.removeItem(KEY)
      sessionStorage.removeItem(KEY)
    } catch (e) {}
    location.reload()
  }

  async function saveAll(out) {
    const reg = await navigator.serviceWorker?.ready
    if (!reg || !reg.active) return (out.textContent = "오프라인 저장은 https 주소(또는 내 PC)에서만 돼요.")
    out.textContent = "목록을 불러오는 중…"
    navigator.serviceWorker.onmessage = (e) => {
      if (e.data && e.data.type === "progress") out.textContent = `저장 중… ${e.data.done} / ${e.data.total}`
      if (e.data && e.data.type === "done") out.textContent = `저장 완료 (${e.data.total}개). 이제 인터넷 없이도 열 수 있어요.`
    }
    reg.active.postMessage({ type: "cache-all" })
  }

  function menu() {
    let box = document.querySelector(".private-menu")
    if (box) return (box.hidden = !box.hidden)
    box = document.createElement("div")
    box.className = "private-menu"
    box.innerHTML = `
      <p class="side-title">비공개 버전</p>
      <button class="btn btn-small" type="button" data-save-all>전체 오프라인 저장</button>
      <button class="btn btn-small btn-soft" type="button" data-lock>이 기기에서 잠그기</button>
      <p class="private-msg">휴대폰 홈 화면에 추가하면 앱처럼 열려요 (브라우저 메뉴 → 홈 화면에 추가).</p>`
    document.body.appendChild(box)
    box.querySelector("[data-lock]").addEventListener("click", lock)
    box.querySelector("[data-save-all]").addEventListener("click", () => saveAll(box.querySelector(".private-msg")))
  }

  // The page is written with document.write after unlocking, where DOMContentLoaded is not
  // reliable: run once the document is no longer loading.
  function whenReady(fn) {
    let done = false
    const go = () => {
      if (done || document.readyState === "loading") return
      done = true
      fn()
    }
    document.addEventListener("readystatechange", go)
    addEventListener("load", go)
    const t = setInterval(() => (go(), done && clearInterval(t)), 100)
  }

  whenReady(() => {
    document.querySelectorAll("img[data-enc-src]").forEach(async (img) => {
      try {
        img.src = await blobUrl(img.dataset.encSrc)
      } catch (e) {
        img.alt = "그림을 열지 못했어요"
      }
    })
    document.addEventListener("click", async (e) => {
      const a = e.target.closest("a[data-enc-href]")
      if (a) {
        e.preventDefault()
        window.open(await blobUrl(a.dataset.encHref), "_blank")
      }
      if (e.target.closest("[data-private-menu]")) menu()
    })
  })

  if ("serviceWorker" in navigator) navigator.serviceWorker.register(base + "/sw.js", { scope: base + "/" }).catch(() => {})
})()
