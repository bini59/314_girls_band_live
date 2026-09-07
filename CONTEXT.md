# CONTEXT — girls_band_live

프로젝트의 유비쿼터스 언어(도메인 용어) 시드. 핵심 용어만 담는다. 새 용어가 확정될 때마다 추가하고, 애매하면 비워둔다. 상세 스키마는 `prisma/schema.prisma`, 개발 가이드는 `AGENTS.md`.

## 엔티티 계층

- **Series** — 시리즈/IP. 여러 Work를 묶는 상위 개념 (optional). 예) 러브라이브, 아이마스.
- **Work** — 작품. 하나의 Series 아래. 예) 러브라이브!, 뱅드림, 걸즈밴드크라이.
- **Band** — 밴드. 하나의 Work 아래. 예) μ's, MyGO!!!!!, 토게토게.
- **Live** — 라이브(공연) 1회. 실황 이벤트의 중심.
- **LiveBand** — Live ↔ Band N:M 조인. 한 Live에 복수 Band 출연.
- **LiveFormat** — 관람 형태. 실황(Venue) / 라이브뷰잉(LV) / 배포(Streaming).
- **TicketTier** — 좌석/권종 등급. LiveFormat에 속함.
- **TicketSale** — 티켓 판매 라운드(선행/일반/추첨/선착 등 1회 판매 회차).
- **TicketSaleTier** — TicketSale ↔ TicketTier N:M 조인.
- **Vendor** — 티켓 판매처(FC / 플레이가이드 / 공식 선행 등).

## 판매 라운드 용어 (일본 티켓팅)

- **Sale Type** — 라운드 유형: FC선행 / 플레이가이드선행 / 공식선행 / 일반.
- **Sale Method** — 판매 방식: `LOTTERY`(추첨) vs `FIRST_COME`(선착).

## 불변 컨벤션

- **UTC 저장 / JST 표시** — DB는 UTC, 어드민 입력은 JST datetime-local(서버에서 UTC 변환), UI 표시는 항상 `Asia/Tokyo`. 한국 시각으로 표시 금지(마감 혼동 방지).
- **어드민 인증** — `321_auth` SSO(`admin` role). SSO 미설정 로컬은 password/JWT.
