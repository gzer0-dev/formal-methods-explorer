// データ独立性（Roscoe TPC 15.3 の範囲。例は自作）。
// 値を運ぶだけで、値どうしを比べもしないプロセスは、値の種類を増やしても振る舞いの形が変わらない（本の定義は等しいかどうかの比較を許すが、
// 値2つで足りるという結果は比較の無いプロセスについてのもの）。だから値を2つにして調べた結論が、値を3つ（それ以上）にしても同じになる。
// 値を比べる重複よけ（直近 k 個を覚え、覚えている値なら捨てる）では、値2つでは足りない。
// produces: DATA_ENV・valuesOf・fifoSpec・fifoPair・stackBuffer・dedupFilter・uniqueSpec・collapseTopValue・CAPACITY・FILTER_MEMORY
// consumes: csp.ts の演算子。

import { type Env, type Proc, ext, hide, int, par, pre, ref, rename } from "./csp";

/** 溜められる数。 */
export const CAPACITY = 2;
/** 重複よけが覚えておく値の数（レッスンの既定）。 */
export const FILTER_MEMORY = 2;

/** 値の種類が count 個のときの値（0, 1, …）。 */
export function valuesOf(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

const parseList = (text: string) => (text === "" ? [] : text.split(",").map(Number));

export const DATA_ENV: Env = {
  // 受け取った順に渡す仕様（容量 capacity のキュー）。
  FIFO: (queue: string, capacity: number, count: number) => {
    const items = parseList(queue);
    const choices: Proc[] = [];
    if (items.length < capacity)
      for (const x of valuesOf(count))
        choices.push(
          pre(`in.${x}`, ref("FIFO", [...items, x].join(","), capacity, count)),
        );
    if (items.length > 0)
      choices.push(
        pre(`out.${items[0]}`, ref("FIFO", items.slice(1).join(","), capacity, count)),
      );
    return ext(...choices);
  },
  // 後に入れたものを先に出す（スタック）。値を比べないのは FIFO と同じで、出す順だけが違う。
  STACK: (stack: string, capacity: number, count: number) => {
    const items = parseList(stack);
    const choices: Proc[] = [];
    if (items.length < capacity)
      for (const x of valuesOf(count))
        choices.push(
          pre(`in.${x}`, ref("STACK", [...items, x].join(","), capacity, count)),
        );
    if (items.length > 0)
      choices.push(
        pre(
          `out.${items.at(-1)}`,
          ref("STACK", items.slice(0, -1).join(","), capacity, count),
        ),
      );
    return ext(...choices);
  },
  // 1つだけ溜めるセル。入口と出口の名前を引数で受け、2つをつなぐ。
  CELL: (entry: string, exit: string, count: number) =>
    ext(
      ...valuesOf(count).map((x) =>
        pre(`${entry}.${x}`, pre(`${exit}.${x}`, ref("CELL", entry, exit, count))),
      ),
    ),
  // 重複よけ: 直近に渡した値を memory 個まで覚え、覚えている値が来たら捨てる。新しい値は渡して覚え、あふれたら最も古いものを忘れる。
  DEDUP: (remembered: string, memory: number, count: number) => {
    const items = parseList(remembered);
    return ext(
      ...valuesOf(count).map((x) =>
        items.includes(x)
          ? pre(`in.${x}`, ref("DEDUP", remembered, memory, count))
          : pre(
              `in.${x}`,
              pre(
                `out.${x}`,
                ref("DEDUP", [...items, x].slice(-memory).join(","), memory, count),
              ),
            ),
      ),
    );
  },
  // 仕様: どの値も高々1回しか渡さない。初めての値は渡しても渡さなくてもよい（内部で選ぶ）。一度渡した値は捨てる。
  UNIQUE: (passed: string, count: number) => {
    const items = parseList(passed);
    return ext(
      ...valuesOf(count).map((x) =>
        items.includes(x)
          ? pre(`in.${x}`, ref("UNIQUE", passed, count))
          : pre(
              `in.${x}`,
              int(
                pre(`out.${x}`, ref("UNIQUE", [...items, x].sort().join(","), count)),
                ref("UNIQUE", passed, count),
              ),
            ),
      ),
    );
  },
};

/** 仕様: 容量 CAPACITY で、受け取った順に渡す。 */
export function fifoSpec(count: number): Proc {
  return ref("FIFO", "", CAPACITY, count);
}

/** 1つだけ溜めるセルを2つ mid でつなぎ、mid を隠したもの（受け取った順に渡す）。 */
export function fifoPair(count: number): Proc {
  const link = valuesOf(count).map((x) => `mid.${x}`);
  return hide(
    par(ref("CELL", "in", "mid", count), link, ref("CELL", "mid", "out", count)),
    link,
  );
}

/** 容量 CAPACITY のスタック（後に入れたものを先に出す）。 */
export function stackBuffer(count: number): Proc {
  return ref("STACK", "", CAPACITY, count);
}

/** 直近 memory 個を覚える重複よけ。 */
export function dedupFilter(memory: number, count: number): Proc {
  return ref("DEDUP", "", memory, count);
}

/** 仕様: どの値も高々1回しか渡さない。 */
export function uniqueSpec(count: number): Proc {
  return ref("UNIQUE", "", count);
}

/**
 * いちばん大きい値（count-1）を、その1つ下の値の名前に付け替える（in と out の両方）。
 * 値を比べないプロセスなら、付け替えた後も値が1つ少ないプロセスと同じ振る舞いになる。比べるプロセスでは違いが残る。
 */
export function collapseTopValue(process: Proc, count: number): Proc {
  const top = count - 1;
  return rename(
    process,
    ["in", "out"].map((channel) => [`${channel}.${top}`, `${channel}.${top - 1}`]),
  );
}
