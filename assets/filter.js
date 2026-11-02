// Paper list filter by section.
(function () {
  const bar = document.querySelector("[data-filter]")
  const grid = document.querySelector("[data-filter-target]")
  if (!bar || !grid) return
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter-value]")
    if (!btn) return
    const v = btn.dataset.filterValue
    bar.querySelectorAll("[data-filter-value]").forEach((b) => b.classList.toggle("is-on", b === btn))
    grid.querySelectorAll(".paper-card").forEach((card) => {
      card.hidden = Boolean(v) && !card.dataset.sections.split("|").includes(v)
    })
  })
})()
