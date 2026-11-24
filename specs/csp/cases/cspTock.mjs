// csp-tock の照合（期待値は src/topic/cspTock.test.ts と同じ）。
const file = "cases/cspTock.csp";

export default ({ runProb, succeeded, failed }) => [
  {
    name: "tock: 2 tock で応答するサーバーは「3 tock 以内」を ⊑T で満たす",
    run: () => runProb(["-cspref", "TockSpec", "[T=", "OnTime"], file),
    expect: succeeded,
  },
  {
    name: "tock: 4 tock かかるサーバーは [request, tock×4] で期限を破る",
    run: () => runProb(["-cspref", "TockSpec", "[T=", "Slow"], file),
    expect: failed,
    trace: ["request", "tock", "tock", "tock", "tock"],
  },
  {
    name: "tock: 時間を止めるサーバーは期限の仕様を空虚に満たす",
    run: () => runProb(["-cspref", "TockSpec", "[T=", "Stuck"], file),
    expect: succeeded,
  },
  {
    name: "tock: 正しいサーバーは、tock 以外を隠すと TICKING を ⊑FD で満たす（時間が止まらない）",
    run: () => runProb(["-cspref", "TICKING", "[FD=", "OnTimeClock"], file),
    expect: succeeded,
  },
  {
    name: "tock: 遅いだけのサーバーも時間は止めない",
    run: () => runProb(["-cspref", "TICKING", "[FD=", "SlowClock"], file),
    expect: succeeded,
  },
  {
    name: "tock: 時間を止めるサーバーは TICKING ⊑FD で破れる（tock×3 の後、仕様は tock をするのに実装は断る）",
    run: () => runProb(["-cspref", "TICKING", "[FD=", "StuckClock"], file),
    expect: failed,
    trace: ["tock", "tock", "tock"],
    contains: "specification_can_do_one_of:,tock",
  },
  {
    name: "tock: 0 tock で応答するサーバーは隠すと発散する（時間の進まない輪）",
    run: () => runProb(["-cspref", "TICKING", "[FD=", "ZenoClock"], file),
    expect: failed,
  },
  {
    name: "tock: 0 tock で応答するサーバーは隠すと発散する（発散の検査）",
    run: () => runProb(["-csplivelock", "ZenoClock"], file),
    expect: failed,
  },
  {
    name: "tock: 2 tock で応答するサーバーは隠しても発散しない",
    run: () => runProb(["-csplivelock", "OnTimeClock"], file),
    expect: succeeded,
  },
];
