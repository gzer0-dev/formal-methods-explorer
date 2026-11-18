---------------------------- MODULE Counter ----------------------------
\* レッスン「テストが見逃すバグ」「状態を全部たどる」「反例を読む」のカウンタ。
\* src/topic/models.ts の counterModel と同じ状態（各プロセスの pc・手元の値・count）を持つ。
EXTENDS Integers

CONSTANTS N, Atomic          \* プロセスの数と、足し算を 1 手でやるか
None == -1                    \* 手元の値が無いことを表す（models.ts の null）
Procs == 1..N

VARIABLES pc, tmp, count
vars == <<pc, tmp, count>>

Init == /\ pc = [p \in Procs |-> "read"]
        /\ tmp = [p \in Procs |-> None]
        /\ count = 0

Read(p)  == /\ ~Atomic /\ pc[p] = "read"
            /\ pc' = [pc EXCEPT ![p] = "write"]
            /\ tmp' = [tmp EXCEPT ![p] = count]
            /\ UNCHANGED count
Write(p) == /\ pc[p] = "write"
            /\ count' = tmp[p] + 1
            /\ pc' = [pc EXCEPT ![p] = "done"]
            /\ tmp' = [tmp EXCEPT ![p] = None]
Add(p)   == /\ Atomic /\ pc[p] = "read"
            /\ count' = count + 1
            /\ pc' = [pc EXCEPT ![p] = "done"]
            /\ UNCHANGED tmp

AllDone == \A p \in Procs : pc[p] = "done"
Next == \E p \in Procs : Read(p) \/ Write(p) \/ Add(p)
Spec == Init /\ [][Next]_vars

\* 不変条件: 全員が終わったら count は N
Correct == AllDone => count = N
=============================================================================
