--------------------------- MODULE Philosophers ---------------------------
\* レッスン「状態爆発」。src/topic/explosion.ts の philosopherTupleModel と同じ（全員が左から取る）。
\* pc: 0=左を待つ 1=右を待つ 2=両方持って食べている 3=右を置き、左を持っている。owner: フォークの持ち主（N は空き）
EXTENDS Naturals
CONSTANT N
VARIABLES pc, owner
vars == <<pc, owner>>
P == 0..(N - 1)
Free == N
Left(i) == i
Right(i) == (i + 1) % N

Init == pc = [i \in P |-> 0] /\ owner = [j \in P |-> Free]
TakeLeft(i) == pc[i] = 0 /\ owner[Left(i)] = Free /\ pc' = [pc EXCEPT ![i] = 1] /\ owner' = [owner EXCEPT ![Left(i)] = i]
TakeRight(i) == pc[i] = 1 /\ owner[Right(i)] = Free /\ pc' = [pc EXCEPT ![i] = 2] /\ owner' = [owner EXCEPT ![Right(i)] = i]
PutRight(i) == pc[i] = 2 /\ pc' = [pc EXCEPT ![i] = 3] /\ owner' = [owner EXCEPT ![Right(i)] = Free]
PutLeft(i) == pc[i] = 3 /\ pc' = [pc EXCEPT ![i] = 0] /\ owner' = [owner EXCEPT ![Left(i)] = Free]
Next == \E i \in P : TakeLeft(i) \/ TakeRight(i) \/ PutRight(i) \/ PutLeft(i)
Spec == Init /\ [][Next]_vars
=============================================================================
