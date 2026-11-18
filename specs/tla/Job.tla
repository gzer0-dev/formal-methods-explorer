------------------------------ MODULE Job ------------------------------
\* レッスン「いつか必ず終わるか」。src/topic/models.ts の jobModel と同じ。
\* Unlimited = TRUE なら何度でもやり直す（回数を数えない。数えると状態が無限に増える）。
EXTENDS Naturals

CONSTANTS MaxRetries, Unlimited
VARIABLES status, retries
vars == <<status, retries>>
CanRetry == Unlimited \/ retries < MaxRetries

Init == status = "waiting" /\ retries = 0

Start   == status = "waiting" /\ status' = "running" /\ UNCHANGED retries
Succeed == status = "running" /\ status' = "succeeded" /\ UNCHANGED retries
Fail    == status = "running" /\ CanRetry
           /\ status' = "waiting"
           /\ retries' = IF Unlimited THEN 0 ELSE retries + 1
GiveUp  == status = "running" /\ ~CanRetry /\ status' = "gaveup" /\ UNCHANGED retries
Finished == status \in {"succeeded", "gaveup"}
Final == Finished /\ UNCHANGED vars

Next == Start \/ Succeed \/ Fail \/ GiveUp \/ Final

\* 公平性の置き方を変えた 4 つの仕様
SpecNoFairness == Init /\ [][Next]_vars
SpecWF         == SpecNoFairness /\ WF_vars(Next)              \* 動ける限り止まらない
SpecWFSucceed  == SpecWF /\ WF_vars(Succeed)                    \* 成功できる状態が「続く」なら成功する
SpecSFSucceed  == SpecWF /\ SF_vars(Succeed)                    \* 成功できる状態を「繰り返し」訪れるなら成功する

EventuallyFinished == <>Finished
=============================================================================
