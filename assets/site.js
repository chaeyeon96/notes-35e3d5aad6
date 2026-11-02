// Theme toggle and site-wide search.
(function () {
  const root = document.documentElement

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const dark =
        root.dataset.theme === "dark" ||
        (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches)
      root.dataset.theme = dark ? "light" : "dark"
      try {
        localStorage.setItem("theme", root.dataset.theme)
      } catch (e) {}
    }),
  )

  const modal = document.querySelector("[data-search-modal]")
  const input = document.querySelector("[data-search-input]")
  const list = document.querySelector("[data-search-results]")
  let index = null
  let active = 0

  async function loadIndex() {
    if (index) return index
    const base = window.SITE_BASE || ""
    index = window.studyLock
      ? await window.studyLock.json(base + "/search-index.bin")
      : await fetch(base + "/search-index.json").then((r) => r.json())
    return index
  }

  function open() {
    modal.hidden = false
    input.value = ""
    render([])
    input.focus()
    loadIndex()
  }
  function close() {
    modal.hidden = true
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

  function snippet(text, q) {
    const i = text.toLowerCase().indexOf(q)
    if (i < 0) return text.slice(0, 110)
    const start = Math.max(0, i - 40)
    const s = text.slice(start, i + q.length + 70)
    return (start > 0 ? "…" : "") + s
  }

  function score(item, q) {
    const t = item.t.toLowerCase()
    const n = item.n.toLowerCase()
    if (t === q || n === q) return 100
    if (t.startsWith(q) || n.startsWith(q)) return 80
    if (t.includes(q) || n.includes(q)) return 60
    if (item.a.some((a) => a.toLowerCase().includes(q))) return 50
    if (item.s.toLowerCase().includes(q)) return 30
    if (item.b.toLowerCase().includes(q)) return 10
    return 0
  }

  function render(items, q = "") {
    active = 0
    if (!q) {
      list.innerHTML = `<li class="search-hint">검색어를 입력하세요. ↑↓ 이동, Enter 열기, Esc 닫기</li>`
      return
    }
    if (!items.length) {
      list.innerHTML = `<li class="search-hint">"${esc(q)}"에 맞는 페이지가 없어요.</li>`
      return
    }
    list.innerHTML = items
      .map(
        (it, i) => `<li><a href="${it.u}" class="search-item${i === 0 ? " is-active" : ""}">
          <span class="search-kind">${it.k}</span>
          <span class="search-title">${esc(it.t)}</span>
          <span class="search-snippet">${esc(snippet(it.s || it.b, q))}</span></a></li>`,
      )
      .join("")
  }

  input &&
    input.addEventListener("input", async () => {
      const q = input.value.trim().toLowerCase()
      if (!q) return render([])
      const idx = await loadIndex()
      const hits = idx
        .map((it) => [score(it, q), it])
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 8)
        .map(([, it]) => it)
      render(hits, q)
    })

  input &&
    input.addEventListener("keydown", (e) => {
      const items = [...list.querySelectorAll(".search-item")]
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        if (!items.length) return
        items[active].classList.remove("is-active")
        active = (active + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length
        items[active].classList.add("is-active")
        items[active].scrollIntoView({ block: "nearest" })
      } else if (e.key === "Enter" && items[active]) {
        location.href = items[active].getAttribute("href")
      }
    })

  document.querySelectorAll("[data-open-search]").forEach((b) => b.addEventListener("click", open))
  modal && modal.addEventListener("click", (e) => e.target === modal && close())
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName)
    if (e.key === "/" && !typing) {
      e.preventDefault()
      open()
    } else if (e.key === "Escape" && !modal.hidden) close()
  })
})()
