----------------------------- MODULE Locks -----------------------------
\* レッスン「デッドロックを見つける」。src/topic/models.ts の lockModel と同じ。
\* T1 は L1 → L2、T2 は SameOrder なら L1 → L2、そうでなければ L2 → L1 の順で取る。
EXTENDS Naturals

CONSTANT SameOrder
Threads == {"T1", "T2"}
Order == [t \in Threads |-> IF t = "T1" \/ SameOrder THEN <<"L1", "L2">> ELSE <<"L2", "L1">>]

VARIABLES pc, owner     \* pc: 0=1つ目待ち 1=2つ目待ち 2=両方持っている 3=終わり
vars == <<pc, owner>>

Init == pc = [t \in Threads |-> 0] /\ owner = [l \in {"L1", "L2"} |-> "none"]

Take(t) == LET lock == Order[t][pc[t] + 1] IN
           /\ pc[t] \in {0, 1}
           /\ owner[lock] = "none"
           /\ owner' = [owner EXCEPT ![lock] = t]
           /\ pc' = [pc EXCEPT ![t] = pc[t] + 1]
Release(t) == /\ pc[t] = 2
              /\ owner' = [l \in {"L1", "L2"} |-> "none"]
              /\ pc' = [pc EXCEPT ![t] = 3]

\* 正しく終わった状態では何も変えずに足踏みする（TLC がデッドロックと報告しないように）。
Finished == /\ \A t \in Threads : pc[t] = 3
            /\ UNCHANGED vars

Next == (\E t \in Threads : Take(t) \/ Release(t)) \/ Finished
Spec == Init /\ [][Next]_vars
=============================================================================
