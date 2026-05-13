// Vitest 전역 setup.
// integration 테스트가 도입되면 여기서 DB reset/connection 관리.

// 시각 컨벤션: 모든 테스트는 JST 기준 동작이 정상인지 확인.
process.env.TZ = "Asia/Tokyo";
