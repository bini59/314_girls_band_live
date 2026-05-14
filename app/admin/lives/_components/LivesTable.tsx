import Link from "next/link";
import type { Live } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatJstDateTime } from "@/lib/admin/format-jst";

import { StatusBadge } from "./StatusBadge";

/**
 * 어드민 라이브 목록 테이블.
 *
 * 본 사이클은 정렬/필터/페이지네이션 UI 없음 — 다음 사이클에서 추가.
 */
export function LivesTable({ lives }: { lives: Live[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead className="w-24">타입</TableHead>
          <TableHead className="w-32">상태</TableHead>
          <TableHead className="w-44">시작일 (JST)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lives.map((live) => (
          <TableRow key={live.id}>
            <TableCell className="font-medium">
              <Link
                href={`/admin/lives/${live.id}`}
                className="hover:underline"
              >
                {live.titleKo}
              </Link>
              <div className="text-xs text-[color:var(--color-muted-foreground)]">
                {live.titleJp}
              </div>
            </TableCell>
            <TableCell>{live.type}</TableCell>
            <TableCell>
              <StatusBadge status={live.status} />
            </TableCell>
            <TableCell>{formatJstDateTime(live.startAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
