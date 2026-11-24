// 交互ビットプロトコル（Roscoe TPC 5.3 の範囲。古典の題材を自作のモデルで書いた。本の定義は写していない）。
// 送り手は値に0か1のビットを付け、同じビットの受け取りの知らせ（ack）が戻るまで送り直す。受け手は待っているビットのものだけを渡す。
// 通信路は値を落としたり重複させたりできる。全体の中の動きを隠すと、1要素のバッファ（受け取った順に1つずつ渡す）と比べられる。
// produces: abpSystem・abpWires・abpSpec・ABP_ENV・ABP_VALUES・LOSS_RUN・NO_BIT_RUN・Faults・HIDDEN_CHANNELS
// consumes: csp.ts の演算子、cspPipes.ts のバッファの仕様（bufferSpec・PIPE_ENV）。

import { type Env, type Proc, ext, hide, int, interleave, par, pre, ref } from "./csp";
import { bufferSpec, PIPE_ENV, PIPE_VALUES } from "./cspPipes";

/** 運ぶ値。バッファの仕様と同じ 0 と 1。 */
export const ABP_VALUES = PIPE_VALUES;
const BITS = [0, 1] as const;

/** 通信路がしてよい故障。 */
export interface Faults {
  canLose: boolean;
  canDuplicate: boolean;
}

/** 送り手→受け手の通信路に入る send.ビット.値 と、出る recv.ビット.値。受け手→送り手は ack.ビット と getack.ビット。 */
export const HIDDEN_CHANNELS = ["send", "recv", "ack", "getack"] as const;

const flag = (isOn: boolean) => (isOn ? 1 : 0);
const messages = ABP_VALUES.flatMap((x) => BITS.map((bit) => `${bit}.${x}`));
const acks = BITS.map(String);
const eventsOf = (channel: string, payloads: string[]) =>
  payloads.map((payload) => `${channel}.${payload}`);

export const ABP_ENV: Env = {
  ...PIPE_ENV,
  // 空の通信路: 入口のどの中身でも受け取る。payloads は "0.1,1.0" のような並び。
  MEDIUM: (entry: string, exit: string, payloads: string, lose: number, dup: number) =>
    ext(
      ...payloads
        .split(",")
        .map((payload) =>
          pre(
            `${entry}.${payload}`,
            ref("HOLDING", entry, exit, payloads, lose, dup, payload),
          ),
        ),
    ),
  // 1つ持っている通信路: 渡して空になる。故障が許されていれば、渡しても持ち続ける（重複）か、渡さずに捨てる（落とす）かを内部で選ぶ。
  HOLDING: (
    entry: string,
    exit: string,
    payloads: string,
    lose: number,
    dup: number,
    payload: string,
  ) => {
    const empty = ref("MEDIUM", entry, exit, payloads, lose, dup);
    const options: Proc[] = [pre(`${exit}.${payload}`, empty)];
    if (dup === 1)
      options.push(
        pre(
          `${exit}.${payload}`,
          ref("HOLDING", entry, exit, payloads, lose, dup, payload),
        ),
      );
    if (lose === 1) options.push(empty);
    return options.length === 1 ? options[0]! : int(...options);
  },
  // 送り手の待ち: 次の値を受け取る。遅れて届いた古い ack は捨てる。
  SENDER: (bit: number, useBit: number) =>
    ext(
      ...ABP_VALUES.map((x) => pre(`in.${x}`, ref("SENDING", bit, x, useBit))),
      ...BITS.map((ackBit) => pre(`getack.${ackBit}`, ref("SENDER", bit, useBit))),
    ),
  // 送り手の送信中: いつでも送り直せる（時間切れを、いつ起きてもよい選択として書いた）。同じビットの ack で次へ進む。
  SENDING: (bit: number, x: number, useBit: number) =>
    ext(
      pre(`send.${bit}.${x}`, ref("SENDING", bit, x, useBit)),
      ...BITS.map((ackBit) =>
        ackBit === bit
          ? pre(`getack.${ackBit}`, ref("SENDER", nextBit(bit, useBit), useBit))
          : pre(`getack.${ackBit}`, ref("SENDING", bit, x, useBit)),
      ),
    ),
  // 受け手: 待っているビットなら値を渡してから ack を返し、ビットを切り替える。違うビット（古い写し）なら ack だけ返す。
  RECEIVER: (expected: number, useBit: number) =>
    ext(
      ...messages.map((message) => {
        const [bit, x] = message.split(".").map(Number) as [number, number];
        return bit === expected
          ? pre(
              `recv.${message}`,
              pre(
                `out.${x}`,
                pre(`ack.${bit}`, ref("RECEIVER", nextBit(expected, useBit), useBit)),
              ),
            )
          : pre(
              `recv.${message}`,
              pre(`ack.${bit}`, ref("RECEIVER", expected, useBit)),
            );
      }),
    ),
};

/** ビットを使うなら次のビットに切り替える。使わないならビットはいつも同じ（0 のまま）。 */
function nextBit(bit: number, useBit: number): number {
  return useBit === 1 ? 1 - bit : bit;
}

/** 中の動き（send・recv・ack・getack）を隠す前の全体。図で中の受け渡しを見せるのに使う。 */
export function abpWires(faults: Faults, useBit: boolean): Proc {
  const lose = flag(faults.canLose);
  const dup = flag(faults.canDuplicate);
  const forward = ref("MEDIUM", "send", "recv", messages.join(","), lose, dup);
  const backward = ref("MEDIUM", "ack", "getack", acks.join(","), lose, dup);
  const senderSide = par(
    ref("SENDER", 0, flag(useBit)),
    [...eventsOf("send", messages), ...eventsOf("getack", acks)],
    interleave(forward, backward),
  );
  return par(
    senderSide,
    [...eventsOf("recv", messages), ...eventsOf("ack", acks)],
    ref("RECEIVER", 0, flag(useBit)),
  );
}

/** 外から見えるのは in と out だけにした全体。 */
export function abpSystem(faults: Faults, useBit: boolean): Proc {
  const payloadsOf = (channel: (typeof HIDDEN_CHANNELS)[number]) =>
    channel === "send" || channel === "recv" ? messages : acks;
  return hide(
    abpWires(faults, useBit),
    HIDDEN_CHANNELS.flatMap((channel) => eventsOf(channel, payloadsOf(channel))),
  );
}

/** 仕様: 1要素のバッファ。受け取った値を、次を受け取る前に渡す。 */
export function abpSpec(): Proc {
  return bufferSpec(1);
}

/** 図で追う実行: 最初の送信が通信路で落ち、送り直した写しが届く。2回目の send は、1回目が落ちていないと起こせない。 */
export const LOSS_RUN = [
  "in.0",
  "send.0.0",
  "send.0.0",
  "recv.0.0",
  "out.0",
  "ack.0",
  "getack.0",
];

/** ビットを使わないときに out.0 が2回出る実行: ack が送り手に届く前に送り直した写しを、受け手が新しい値として渡す。 */
export const NO_BIT_RUN = [
  "in.0",
  "send.0.0",
  "recv.0.0",
  "out.0",
  "ack.0",
  "send.0.0",
  "recv.0.0",
  "out.0",
];
