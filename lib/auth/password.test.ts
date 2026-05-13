import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "./password";

describe("verifyPassword", () => {
  it("평문과 일치하는 bcrypt 해시를 받으면 true 를 반환한다", async () => {
    const plain = "correct-horse-battery-staple";
    const hash = await bcrypt.hash(plain, 4); // 테스트 속도를 위해 round 낮춤

    const result = await verifyPassword(plain, hash);
    expect(result).toBe(true);
  });

  it("평문과 일치하지 않는 bcrypt 해시를 받으면 false 를 반환한다", async () => {
    const hash = await bcrypt.hash("correct-password", 4);

    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  it("빈 평문은 항상 false (해시는 비어있지 않다고 가정)", async () => {
    const hash = await bcrypt.hash("non-empty", 4);

    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });

  it("해시가 비정상 문자열일 때 throw 하지 않고 false 를 반환한다", async () => {
    const result = await verifyPassword("anything", "not-a-bcrypt-hash");
    expect(result).toBe(false);
  });

  it("해시가 빈 문자열일 때 throw 하지 않고 false 를 반환한다", async () => {
    const result = await verifyPassword("anything", "");
    expect(result).toBe(false);
  });
});
