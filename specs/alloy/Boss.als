// レッスン「小さな範囲で全部調べる」の上司の関係。src/topic/smallScope.ts と同じ。
// 3人（A・B・C）それぞれの上司は「なし」か3人のうち誰か1人。
abstract sig Person { boss: lone Person }
one sig A, B, C extends Person {}

// 制約
pred NoSelf { no p: Person | p in p.boss }          // 自分を上司にしない
pred NoCycle { no p: Person | p in p.^boss }        // 上司をたどって自分に戻る輪を作らない

// 確かめたい性質「誰も自分の上司筋ではない」が破れている形。
// some p: ... と書くと、Alloy は p を変数に置き換え（スコーレム化）て列挙するので、
// 同じ形でも「どの人が自分の上司筋か」ごとに別の解として数えてしまう。集合の内包で書いて形だけを数える。
fun ownAncestors: set Person { { p: Person | p in p.^boss } }
pred OwnAncestor { some ownAncestors }

// 形を全部数える（exec -r 0 -y 0 で全列挙する）
run AllShapes {} for 3
run NoSelfShapes { NoSelf } for 3
run BothShapes { NoSelf and NoCycle } for 3
// 反例を全部数える
run CounterNoFacts { OwnAncestor } for 3
run CounterNoSelf { NoSelf and OwnAncestor } for 3
run CounterBoth { NoSelf and NoCycle and OwnAncestor } for 3

// Alloy でふつうに書く形: 制約を事実として置き、性質を assert して check する
assert NoOneIsOwnAncestor { not OwnAncestor }
check NoFacts { not OwnAncestor } for 3
check WithNoSelf { NoSelf implies not OwnAncestor } for 3
check WithBoth { (NoSelf and NoCycle) implies not OwnAncestor } for 3
