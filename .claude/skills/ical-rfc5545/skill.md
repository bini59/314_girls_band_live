---
name: ical-rfc5545
description: iCal(RFC 5545) 피드 작성 규칙과 한국 사용자 친화 표시 가이드. VEVENT 작성, 텍스트 이스케이프, 줄 폴딩, UID 안정성, 캘린더 클라이언트 호환성(Apple/Google/Outlook). iCal/ICS/캘린더 구독 작업 시 트리거.
---

# ical-rfc5545 — iCal 피드 작성 규칙

본 프로젝트는 라이브와 티켓 라운드를 iCal 피드로 제공한다. 사용자는 캘린더 앱에 URL을 구독해 자동 갱신을 받는다. **잘못된 iCal은 캘린더 앱에서 조용히 깨지므로** 규격 준수가 필수다.

## 최소 구조

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//girls-band-live//Live Calendar//KO
METHOD:PUBLISH
X-WR-CALNAME:걸즈밴드 라이브 (전체)
X-WR-TIMEZONE:Asia/Tokyo
BEGIN:VEVENT
UID:live-101@girls-band-live.app
DTSTAMP:20260413T120000Z
DTSTART:20260815T100000Z
DTEND:20260815T130000Z
SUMMARY:MyGO!!!!! ZEPP TOUR (도쿄 가든시어터)
LOCATION:도쿄 가든시어터
URL:https://girls-band-live.app/live/mygo-2026-08-15
END:VEVENT
END:VCALENDAR
```

## 줄 종료 규칙 — CRLF

모든 줄은 `\r\n`으로 끝낸다. `\n`만 쓰면 일부 클라이언트(특히 Outlook)에서 깨진다.

## 줄 폴딩 — 75 옥텟

긴 줄(특히 DESCRIPTION)은 **75 옥텟** 후 `\r\n ` (CRLF + 공백 또는 탭)으로 폴딩한다. UTF-8이므로 옥텟 수 ≠ 문자 수 — 한글은 보통 3옥텟. 다음 줄은 공백 또는 탭으로 시작.

언폴딩 시 CRLF+공백을 빈 문자열로 치환.

## 텍스트 이스케이프

VALUE 텍스트(SUMMARY, DESCRIPTION, LOCATION 등)에서 다음을 이스케이프:

| 문자 | 이스케이프 |
|---|---|
| `\` | `\\` |
| `;` | `\;` |
| `,` | `\,` |
| 개행(`\n`) | `\n` (리터럴 두 문자) |

순서: 백슬래시를 가장 먼저 (다른 이스케이프와 충돌 방지)

## 시각 포맷

UTC 시각: `YYYYMMDDTHHMMSSZ` (예: `20260815T100000Z`)

원칙: DB가 UTC이므로 그대로 사용. 캘린더 클라이언트가 사용자 로컬 시각으로 표시함. 단 `X-WR-TIMEZONE:Asia/Tokyo`로 힌트 제공.

DTSTAMP는 "이 이벤트 레코드를 생성/갱신한 시각" — 보통 현재 시각.

## UID — 영구 안정

UID는 이벤트의 영구 식별자. **재발행 시 같은 UID = 같은 이벤트**로 인식되어 캘린더에서 업데이트되고, 다른 UID = 새 이벤트로 추가된다.

규칙:
- 도메인 PK에서 유도: `live-{id}@girls-band-live.app`
- 절대 변경하지 말 것 (변경 시 사용자 캘린더에 중복 이벤트 생김)
- 같은 ID 재사용 금지 (Live 삭제 후 ID 재사용되면 충돌)

## SUMMARY 작성 (한국 사용자 친화)

### Live (실황) VEVENT

```
SUMMARY:{title} ({venue 약식})
```

예: `MyGO!!!!! ZEPP TOUR 「迷星叫」 (도쿄 가든시어터)`

- 일본어 원문 유지 (사용자가 검색·매칭 시 일본어 단서 필요)
- venue는 약식 (도쿄도 코토구 ... → 도쿄 가든시어터)
- 페스/대반은 출연 밴드 첫 1~2개만 표기

### TicketSale VEVENT

```
SUMMARY:[티켓팅] {live title} - {라운드 라벨}
```

예: `[티켓팅] MyGO!!!!! ZEPP TOUR - FC 선행 마감`

- `[티켓팅]` 프리픽스로 라이브 본 이벤트와 구분
- 추첨이면 "마감", 선착이면 "발매"로 후미 통일

## DESCRIPTION 작성

여러 줄로 부가 정보. **개행은 리터럴 `\n`**.

Live:
```
DESCRIPTION:출연: MyGO!!!!!\n개장 18:00 / 개연 19:00 (JST)\n공식: https://...\n티켓 정보: https://girls-band-live.app/live/...
```

TicketSale (추첨):
```
DESCRIPTION:방식: 추첨\n판매처: e+\n신청: 2026-04-10 12:00 ~ 04-17 23:59 (JST)\n발표: 2026-04-22 15:00\n입금기한: 2026-04-25 23:00\nURL: https://eplus.jp/...
```

## DTEND 결정

| 케이스 | DTEND |
|---|---|
| Live.end_at 있음 | 그대로 |
| Live.end_at 없음 | DTSTART + 3시간 (라이브 통상) |
| TicketSale (LOTTERY 마감 알림) | ends_at, DTSTART = ends_at - 1h |
| TicketSale (FIRST_COME 발매 알림) | starts_at + 30분, DTSTART = starts_at |

## 스코프별 피드 URL 설계

```
/api/calendar/all.ics                       — 전체 (모든 공개 라이브)
/api/calendar/series/{slug}.ics             — 시리즈별
/api/calendar/work/{slug}.ics               — 작품별
/api/calendar/band/{slug}.ics               — 밴드별
```

쿼리스트링 옵션:
- `?include_sales=1` — 티켓 라운드 VEVENT 포함 (기본 0)
- `?formats=LIVE_VENUE,LIVE_VIEWING` — 포맷 필터 (기본 LIVE_VENUE만)
- `?past=1` — 지난 공연 포함 (기본 미래만)

## HTTP 응답 헤더

```
Content-Type: text/calendar; charset=utf-8
Content-Disposition: inline; filename="girls-band-live.ics"
Cache-Control: public, max-age=3600
```

`max-age`는 1시간 — 일정 자주 갱신되므로 더 길지 않게. 캘린더 앱 대부분이 별도 폴링 주기(보통 24h)를 갖지만 이건 클라이언트 책임.

## 빈 결과 처리

이벤트 0건이어도 VCALENDAR 래핑 그대로 반환. 4xx/5xx로 응답 금지.

## 알아둘 함정

1. **\r\n 누락**: 텍스트 에디터로 작성하면 LF만 들어가기 쉬움. 코드로 명시적으로 `\r\n` 사용.
2. **75옥텟 한글 폴딩**: UTF-8 한글이 3옥텟이라 12자 안팎에서 폴딩 발생. 다바이트 문자 중간을 자르지 말 것.
3. **METHOD 오용**: PUBLISH는 일방향 발행. REQUEST/REPLY는 초대(우리 케이스 아님).
4. **DTSTAMP 누락**: 일부 클라이언트는 PARSE 실패. 항상 포함.
5. **VEVENT 안에 BEGIN:VTIMEZONE 누락**: UTC만 쓰면 VTIMEZONE 불필요. JST 로컬 시각으로 표기하면 VTIMEZONE 정의 필요.

## 라이브러리 사용 vs 직접 작성

- 단순함과 정확한 제어가 중요 → **직접 작성** (작은 헬퍼 함수로)
- 외부 라이브러리 `ics` (npm)는 일부 기능에 제한 있음 (커스텀 X- 헤더 등)
- 본 프로젝트는 직접 작성 권장. 줄 폴딩과 이스케이프 헬퍼 함수만 별도로.

## 검증

`ical-engineer`가 작성 후 다음 도구로 검증:
- https://icalendar.org/validator.html (수동)
- Apple Calendar / Google Calendar에 실제 구독 (필수)
- 단위 테스트로 줄 폴딩/이스케이프/UID 안정성 검증
