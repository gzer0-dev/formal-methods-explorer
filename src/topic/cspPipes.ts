// 名前の付け替え（renaming）でプロセスをつなぐパイプと、バッファの仕様（Roscoe TPC 3.2・4.1・5.1 の範囲。例は自作）。
// 1要素だけ溜めるセル COPY を、出口と入口の名前を同じ mid.* に付け替えて並べ、mid.* を隠すと、溜められる数が増える。
// produces: cellChain・linkedPair・bufferSpec・PIPE_ENV・PIPE_VALUES・SAMPLE_RUN ／ consumes: csp.ts の演算子。

import { type Env, type Proc, ext, hide, par, pre, ref, rename } from "./csp";

/** 流す値。0 と 1 の2つで足りる（どの値も同じに扱うので、値の数を増やしても結論は変わらない）。 */
export const PIPE_VALUES = [0, 1] as const;

const event = (channel: string, value: number) => `${channel}.${value}`;
const allOf = (channel: string) => PIPE_VALUES.map((value) => event(channel, value));

export const PIPE_ENV: Env = {
  // in.x を受け取り、out.x で渡してから、次を受け取る。溜められるのは1つ。
  COPY: () =>
    ext(
      ...PIPE_VALUES.map((x) => pre(event("in", x), pre(event("out", x), ref("COPY")))),
    ),
  // 溜めている値の並び（"0,1" のような文字列）と容量で状態を表す。
  BUFF: (queue: string, capacity: number) => {
    const items = queue === "" ? [] : queue.split(",").map(Number);
    const choices: Proc[] = [];
    if (items.length < capacity) {
      for (const x of PIPE_VALUES)
        choices.push(
          pre(event("in", x), ref("BUFF", [...items, x].join(","), capacity)),
        );
    }
    if (items.length > 0) {
      choices.push(
        pre(event("out", items[0]!), ref("BUFF", items.slice(1).join(","), capacity)),
      );
    }
    return ext(...choices);
  },
};

/** 容量 capacity のバッファの仕様: 受け取った順に渡し、溜まっている数が容量より少ない間は受け取りを断らない。 */
export function bufferSpec(capacity: number): Proc {
  return ref("BUFF", "", capacity);
}

/** k 番目と k+1 番目のセルの間をつなぐチャネルの名前。 */
function linkName(index: number): string {
  return `mid${index}`;
}

/** セル2つを mid1 でつないだが、mid1 をまだ隠していないもの（中の受け渡しを図で見せるのに使う）。 */
export function linkedPair(): Proc {
  return par(
    rename(
      ref("COPY"),
      PIPE_VALUES.map((x) => [event("out", x), event(linkName(1), x)]),
    ),
    allOf(linkName(1)),
    rename(
      ref("COPY"),
      PIPE_VALUES.map((x) => [event("in", x), event(linkName(1), x)]),
    ),
  );
}

/** 図で追う実行の例: 0 を入れ、隣へ送り、1 を入れ、先に入れた 0 が出る。2つ溜まる瞬間がある。 */
export const SAMPLE_RUN = ["in.0", `${linkName(1)}.0`, "in.1", "out.0"];

/**
 * セルを count 個つないだパイプ。i 番目のセルの out を mid_i に、i+1 番目の in を mid_i に付け替え、
 * mid_i で同期させてから隠す。外から見えるのは最初の in と最後の out だけになる。
 */
export function cellChain(count: number): Proc {
  let chain: Proc = ref("COPY");
  for (let index = 1; index < count; index += 1) {
    const link = linkName(index);
    const left = rename(
      chain,
      PIPE_VALUES.map((x) => [event("out", x), event(link, x)]),
    );
    const right = rename(
      ref("COPY"),
      PIPE_VALUES.map((x) => [event("in", x), event(link, x)]),
    );
    chain = hide(par(left, allOf(link), right), allOf(link));
  }
  return chain;
}
