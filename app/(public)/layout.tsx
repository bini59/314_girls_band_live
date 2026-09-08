import { getWorksForNav } from "@/lib/public/queries";

import { SiteShell } from "@/components/site/site-shell";

/** 작품(+밴드) 트리는 여기서 SSR 로 가져와 사이드바 네비에 넘긴다. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const works = await getWorksForNav();
  return <SiteShell works={works}>{children}</SiteShell>;
}
