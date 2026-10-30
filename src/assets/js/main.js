// Mobile Navigation und Header-Schatten beim Scrollen
(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const header = document.querySelector("[data-header]");

  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
  };

  toggle?.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
  document.querySelectorAll("[data-nav] a").forEach((a) => a.addEventListener("click", () => setOpen(false)));

  const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();
