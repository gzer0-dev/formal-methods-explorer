----------------------------- MODULE Order -----------------------------
\* レッスン「状態と遷移で書く」「不変条件を書く」「遷移を全部通すテスト」の注文。
\* src/topic/models.ts の orderModel と同じ。TLA+ の文字列は ASCII にしている（日本語は使えない）。
CONSTANT ShipBug   \* TRUE なら「発送する」の前提条件（支払済み）を書き忘れている

VARIABLES status, paid
vars == <<status, paid>>

Init == status = "unpaid" /\ paid = FALSE

Pay    == status = "unpaid" /\ status' = "paid"     /\ paid' = TRUE
Ship   == (status = "paid" \/ (ShipBug /\ status = "unpaid"))
          /\ status' = "shipped" /\ UNCHANGED paid
Deliver == status = "shipped" /\ status' = "delivered" /\ UNCHANGED paid
Cancel == status = "unpaid" /\ status' = "cancelled" /\ UNCHANGED paid
Refund == status = "paid"   /\ status' = "refunded"  /\ paid' = FALSE

Final == status \in {"delivered", "cancelled", "refunded"} /\ UNCHANGED vars
Next == Pay \/ Ship \/ Deliver \/ Cancel \/ Refund \/ Final
Spec == Init /\ [][Next]_vars

\* 不変条件: 発送済み・配達済みなら支払済み
PaidBeforeShip == status \in {"shipped", "delivered"} => paid
=============================================================================
