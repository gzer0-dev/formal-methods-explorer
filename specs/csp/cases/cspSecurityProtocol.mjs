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
    name: "NS: Lowe の修正では攻撃が無い",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSLowe"], file),
    expect: succeeded,
  },
  {
    name: "NS: 修正版でも running.A.B → commit.B.A まで正直に通る（空虚に成り立っていない）",
    run: () => runProb(["-cspref", "NSLowe", "[T=", "AuthSpec"], file),
    expect: succeeded,
  },
  {
    name: "NS: 侵入者が暗号文を元の送り手・宛先のまま中継するしかないなら、元の版でも攻撃は無い（演習の正解）",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSNoRedirect"], file),
    expect: succeeded,
  },
  {
    name: "NS: 中継しかできない侵入者でも、正直な running.A.B → commit.B.A は通る（演習の答えが空虚でない）",
    run: () => runProb(["-cspref", "NSNoRedirect", "[T=", "AuthSpec"], file),
    expect: succeeded,
  },
  {
    name: "NS: A が B としか話さないなら、元の版でも攻撃は無い",
    run: () => runProb(["-cspref", "AuthSpec", "[T=", "NSOnlyB"], file),
    expect: succeeded,
  },
];
