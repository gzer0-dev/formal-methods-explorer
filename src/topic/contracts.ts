// 事前条件・事後条件を、小さな範囲の入力すべてで確かめる（Dafny などは証明で全入力を扱う。ここでは範囲を区切って総当たり）。

export interface WithdrawCase {
  balance: number;
  amount: number;
  after: number;
}

export interface WithdrawCheck {
  /** 事前条件を満たした入力の数。事後条件を確かめたのはこれだけ。 */
  checked: number;
  counterexample: WithdrawCase | null;
}

export interface WithdrawOptions {
  maxBalance: number;
  maxAmount: number;
  /** 事前条件に「金額 ≦ 残高」を入れるか。 */
  requireEnough: boolean;
}

/** 調べる実装: 残高から金額を引くだけ。 */
export function withdraw(balance: number, amount: number): number {
  return balance - amount;
}

export function checkWithdraw(options: WithdrawOptions): WithdrawCheck {
  let checked = 0;
  let counterexample: WithdrawCase | null = null;
  for (let balance = 0; balance <= options.maxBalance; balance += 1) {
    for (let amount = 0; amount <= options.maxAmount; amount += 1) {
      const meetsPre = amount > 0 && (!options.requireEnough || amount <= balance);
      if (!meetsPre) continue;
      checked += 1;
      const after = withdraw(balance, amount);
      const meetsPost = after >= 0 && after === balance - amount;
      if (!meetsPost) counterexample ??= { balance, amount, after };
    }
  }
  return { checked, counterexample };
}
