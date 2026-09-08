import { getWorksForNav } from "@/lib/public/queries";

import { SiteShell } from "@/components/site/site-shell";

// 빌드 시 prerender 금지 — 이 레이아웃이 사이드바 네비용 작품 목록을 DB 에서 읽는다.
// 레이아웃이 await 하므로 정적 생성 시도 단계에서 DB 에 붙어 빌드가 깨진다
// (이전 헤더는 자식 컴포넌트라 dynamic bailout 이 먼저 일어나 우연히 통과했다).
// 공개 페이지는 전부 이미 동적 렌더링이므로 잃는 것은 없다.
export const dynamic = "force-dynamic";

/** 작품(+밴드) 트리는 여기서 SSR 로 가져와 사이드바 네비에 넘긴다. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const works = await getWorksForNav();
  return <SiteShell works={works}>{children}</SiteShell>;
}
