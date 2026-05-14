/**
 * 다크 모드 FOUC 방지 인라인 스크립트.
 *
 * 하이드레이션 전에 `<html>`에 .dark 클래스를 적용해 깜빡임을 방지한다.
 * localStorage.theme 값을 신뢰하되, 없거나 'system'이면 prefers-color-scheme 사용.
 */
export const THEME_STORAGE_KEY = "theme";

const SCRIPT = `(() => {
  try {
    var k = ${JSON.stringify(THEME_STORAGE_KEY)};
    var stored = localStorage.getItem(k);
    var theme = stored === "light" || stored === "dark" ? stored : "system";
    var resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    var root = document.documentElement;
    if (resolved === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = resolved;
  } catch (e) {}
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
