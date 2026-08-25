export default defineNuxtPlugin(() => {
  const applyStoredTheme = () => {
    const isDark = localStorage.getItem("taiko_theme") === "dark";
    document.body.classList.toggle("theme-dark", isDark);
  };

  applyStoredTheme();
  window.addEventListener("storage", applyStoredTheme);
});
