"use client";

/**
 * ApiKeysTable — API 키 목록 + 발급 폼 + 폐기 진입점.
 *
 * - 상단 발급 폼: 이름 입력 + 발급 버튼 → issueApiKeyAction.
 *   성공 시 RevealKeyDialog 로 평문을 1회 노출.
 * - 각 row: 이름 / keyPrefix / 생성일(JST) / 상태 배지 / 폐기 버튼(active 만).
 *   폐기: window.confirm 후 revokeApiKeyAction 호출.
 * - 모든 mutation 후 router.refresh() 로 서버 컴포넌트 재페치.
 *
 * 평문은 발급 응답에만 존재하며 목록/DB 어디에도 저장되지 않는다.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ApiKey } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatJstDateTime } from "@/lib/jst";

import { issueApiKeyAction, revokeApiKeyAction } from "../actions";
import { RevealKeyDialog } from "./RevealKeyDialog";

export interface ApiKeysTableProps {
  apiKeys: ApiKey[];
}

const REVOKE_CONFIRM_MESSAGE =
  "이 API 키를 폐기하시겠습니까? 폐기 후에는 이 키로 더 이상 인증할 수 없습니다.";

type Revealed = { name: string; plaintext: string };

export function ApiKeysTable({ apiKeys }: ApiKeysTableProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [topError, setTopError] = React.useState<string | null>(null);
  const [issuing, setIssuing] = React.useState(false);
  const [pendingRevokeId, setPendingRevokeId] = React.useState<number | null>(
    null
  );
  const [revealed, setRevealed] = React.useState<Revealed | null>(null);

  async function handleIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError(null);
    setTopError(null);

    setIssuing(true);
    try {
      const result = await issueApiKeyAction(name);
      if (result.ok) {
        setRevealed({ name: result.apiKey.name, plaintext: result.plaintext });
        setName("");
        router.refresh();
        return;
      }
      if (result.fieldErrors?.name?.[0]) {
        setNameError(result.fieldErrors.name[0]);
      }
      if (result.error) {
        setTopError(result.error);
      }
    } catch (err) {
      console.error("[ApiKeysTable] issue", err);
      setTopError("발급 중 오류가 발생했습니다.");
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(apiKey: ApiKey) {
    if (typeof window !== "undefined" && !window.confirm(REVOKE_CONFIRM_MESSAGE)) {
      return;
    }
    setTopError(null);
    setPendingRevokeId(apiKey.id);
    try {
      const result = await revokeApiKeyAction(apiKey.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result.error ?? "폐기에 실패했습니다.");
    } finally {
      setPendingRevokeId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleIssue}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="api-key-name">새 키 이름</Label>
          <Input
            id="api-key-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={issuing}
            autoComplete="off"
            placeholder="예: iCal importer"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "api-key-name-error" : undefined}
          />
          {nameError ? (
            <p
              id="api-key-name-error"
              role="alert"
              className="text-xs text-[color:var(--color-destructive)]"
            >
              {nameError}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={issuing}>
          {issuing ? "발급 중..." : "키 발급"}
        </Button>
      </form>

      {topError ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {topError}
        </p>
      ) : null}

      {apiKeys.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          발급된 API 키가 없습니다. 위 폼으로 첫 키를 발급해주세요.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead className="w-40">키 prefix</TableHead>
              <TableHead className="w-44">생성일 (JST)</TableHead>
              <TableHead className="w-28">상태</TableHead>
              <TableHead className="w-24 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key) => {
              const active = key.revokedAt === null;
              return (
                <TableRow key={key.id} data-testid={`api-key-row-${key.id}`}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
                    {key.keyPrefix}…
                  </TableCell>
                  <TableCell className="text-xs text-[color:var(--color-muted-foreground)]">
                    {formatJstDateTime(key.createdAt)}
                  </TableCell>
                  <TableCell>
                    {active ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Badge variant="secondary">revoked</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {active ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevoke(key)}
                        disabled={pendingRevokeId === key.id}
                        aria-label={`${key.name} 폐기`}
                      >
                        {pendingRevokeId === key.id ? "폐기 중..." : "폐기"}
                      </Button>
                    ) : (
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">
                        {formatJstDateTime(key.revokedAt)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <RevealKeyDialog
        open={revealed !== null}
        onOpenChange={(next) => {
          if (!next) setRevealed(null);
        }}
        name={revealed?.name ?? ""}
        plaintext={revealed?.plaintext ?? ""}
      />
    </div>
  );
}
