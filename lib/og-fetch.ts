/**
 * URL 의 Open Graph / 메타데이터를 서버에서 가져온다.
 * - Next.js fetch 캐시(1일)
 * - 5초 타임아웃 / 실패 시 graceful fallback
 * - 외부 라이브러리 없이 정규식 파서로 처리
 */

export type OgData = {
  url: string;
  host: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function googleFavicon(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, key: string): string | null {
  // og:title, twitter:title 양쪽 다 지원
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*?content\\s*=\\s*["']([^"']*?)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*?)["'][^>]*?(?:property|name)\\s*=\\s*["']${key}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function pageTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (m && m[1]) return decodeEntities(m[1].trim());
  return null;
}

function iconHref(html: string): string | null {
  // <link rel="icon" href=...> / shortcut icon / apple-touch-icon
  const patterns = [
    /<link[^>]+rel\s*=\s*["'](?:apple-touch-icon[^"']*|icon|shortcut icon)["'][^>]*?href\s*=\s*["']([^"']+)["']/i,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*?rel\s*=\s*["'](?:apple-touch-icon[^"']*|icon|shortcut icon)["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function resolveUrl(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function fetchOg(url: string): Promise<OgData> {
  const host = safeHost(url);
  const fallbackFavicon = googleFavicon(host);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.8,ko;q=0.6",
      },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = (await res.text()).slice(0, 200_000); // head 만 보면 충분

    const title =
      metaContent(html, "og:title") ??
      metaContent(html, "twitter:title") ??
      pageTitle(html);
    const description =
      metaContent(html, "og:description") ??
      metaContent(html, "twitter:description") ??
      metaContent(html, "description");
    const ogImage =
      metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
    const siteName = metaContent(html, "og:site_name");
    const icon = iconHref(html);

    return {
      url,
      host,
      title,
      description,
      image: resolveUrl(ogImage, url),
      siteName,
      favicon: resolveUrl(icon, url) ?? fallbackFavicon,
    };
  } catch {
    return {
      url,
      host,
      title: null,
      description: null,
      image: null,
      siteName: null,
      favicon: fallbackFavicon,
    };
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
