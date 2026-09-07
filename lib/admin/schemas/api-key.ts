/**
 * ApiKey 발급 입력 검증 (Zod).
 *
 * - name: 앞뒤 공백 제거 후 1..100자. 빈/공백 문자열 거부.
 *
 * 모든 에러 메시지는 한국어.
 */
import { z } from "zod";

export const apiKeyIssueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "필수 입력 항목입니다.")
    .max(100, "100자 이하로 입력해주세요."),
});

export type ApiKeyIssueInput = z.infer<typeof apiKeyIssueSchema>;
