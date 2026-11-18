------------------------------ MODULE Door ------------------------------
\* レッスン「時相論理を扉で読む」。src/topic/ltl.ts の doorModel と同じ。
\* 呼ぶ（Press）と待つ（足踏み）は利用者の動きで、しなくてもよい。扉の動きは、できる限り止まらない（弱い公平性）。
CONSTANT HasBug
VARIABLES door, requested
vars == <<door, requested>>

Init == door = "closed" /\ requested = FALSE
Press == ~requested /\ door # "open" /\ requested' = TRUE /\ UNCHANGED door
StartOpen == door = "closed" /\ requested /\ door' = "opening" /\ UNCHANGED requested
Opened == door = "opening" /\ door' = "open" /\ requested' = FALSE
StartClose == door = "open" /\ door' = "closing" /\ UNCHANGED requested
Closed == door = "closing" /\ door' = "closed" /\ requested' = IF HasBug THEN FALSE ELSE requested

Next == Press \/ StartOpen \/ Opened \/ StartClose \/ Closed
Spec == Init /\ [][Next]_vars
        /\ WF_vars(StartOpen) /\ WF_vars(Opened) /\ WF_vars(StartClose) /\ WF_vars(Closed)

LeadsToOpen == requested ~> (door = "open")
InfinitelyOftenClosed == []<>(door = "closed")
EventuallyAlwaysOpen == <>[](door = "open")
Safe == [](door = "open" => ~requested)
=============================================================================
