// csp-security-protocol と演習 exercise-security-protocol の照合（期待値は src/topic/cspSecurityProtocol.test.ts と同じ）。
// ProB では running.A.B と commit.B.A 以外を隠して比べる（サイトの checkAuthenticationHidden と同じ比べ方）。
const file = "cases/cspSecurityProtocol.csp";

export default ({ runProb, succeeded, failed }) => [
  {
    name: "NS: 元の版は認証を破り、隠した反例は [commit.B.A]（Lowe の攻撃）",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSOriginal"], file),
    expect: failed,
    trace: ["commit.B.A"],
  },
  {
    name: "NS: Lowe の直しでは攻撃が無い",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSLowe"], file),
    expect: succeeded,
  },
  {
    name: "NS: 直した版でも running.A.B → commit.B.A まで正直に通る（空虚に成り立っていない）",
    run: () => runProb(["-cspref", "NSLowe", "[T=", "AuthSpec"], file),
    expect: succeeded,
  },
  {
    name: "NS: 侵入者が暗号文を送り直せないなら、元の版でも攻撃は無い（演習の正解）",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSNoReplay"], file),
    expect: succeeded,
  },
  {
    name: "NS: A が B としか話さないなら、元の版でも攻撃は無い",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSOnlyB"], file),
    expect: succeeded,
  },
];
