# 02 — Prompt Library

> Day-specific prompts live in `01-curriculum-30-days.md`. These are the **reusable** ones —
> the seven you'll run hundreds of times, on this build and every one after it.
>
> They work in Astra, Claude Code, Codex, Cursor, or any agent. None of them depend on a
> particular tool, because the leverage isn't in the tool. It's in the structure.

---

## The master template

Every serious prompt has these slots. Leave one out and the agent fills it with an assumption
you didn't make.

```
ROLE:              Who is doing this work, and at what seniority
OBJECTIVE:         The single outcome. One sentence. If you need "and", split the task.
CONTEXT:           What exists now — paste real files, real schema, real constraints
REQUIREMENTS:      What it must do
CONSTRAINTS:       What it must NEVER do  ← the most valuable section, and the one people skip
ARCHITECTURE:      The stack and the pattern, so it doesn't invent its own
TASK:              The specific slice for THIS run
SUCCESS CRITERIA:  How we know it worked
TESTS:             The exact cases that must pass, including the nasty ones
FAILURE CONDITIONS: "Do not claim completion until ___"
OUTPUT FORMAT:     Files changed, tests run, failures found, what's left
```

**The two lines that change your results more than anything else:**

1. `CONSTRAINTS:` — an agent with no constraints optimizes for *looking done*. Constraints are
   where you encode the things that cost money when they're wrong: *never trust a client-sent
   price, never expose another tenant's data, never send to an opted-out contact.*
2. `FAILURE CONDITIONS: Do not claim completion until the concurrency test output is shown.` —
   this single line converts "I've implemented the booking system!" into evidence you can check.

---

## 1. The Audit prompt — *use before touching anything*

```
ROLE: Staff engineer conducting a read-only audit.
OBJECTIVE: Identify the 5 highest-risk problems in this codebase.
CONTEXT: [repo tree + the files that matter]
TASK: For each finding: evidence (file:line), severity, what breaks in production,
      the recommended fix, and effort in hours.
CONSTRAINTS: Modify NOTHING. No style or formatting opinions. Rank by
             (likelihood × cost of failure), not by how easy it is to fix.
OUTPUT: A table. Then name the single one you'd fix first and why.
```

Then, always as a **separate** run: `Fix finding #1 only. Do not modify unrelated files. Run the test suite. Show me the diff and the test output.`

One finding per run. An agent given five fixes at once will do three well, one badly, and one it invented.

---

## 2. The Break-It prompt — *run this every single day*

```
ROLE: QA engineer paid a bounty for every bug that reaches production.
OBJECTIVE: Break this. Do not fix anything.
CONTEXT: [the feature's code + its intended behavior]
TASK: Find every way this produces a wrong outcome — bad inputs, races, timing,
      state-machine paths, boundary values, and hostile users. Focus on:
        - money charged incorrectly
        - data exposed across tenants
        - the same action happening twice
        - an object stuck in an impossible state
      For each: reproduction steps, impact, severity.
CONSTRAINTS: Report only. Assume the user reads your API in devtools, replays your
             requests, and edits every value before sending it.
OUTPUT: Findings ranked by (likelihood × cost). Then name the single worst one.
```

**The mindset shift this encodes:** stop asking *"does it work?"* — an agent will always tell
you yes. Ask *"how do I make it lie?"*

---

## 3. The Concurrency prompt — *any time two users can touch one thing*

```
ROLE: Distributed systems engineer.
OBJECTIVE: Prove this is safe under concurrent access, or show me where it isn't.
CONTEXT: [the write path]
TASK: 1. Where can two simultaneous requests produce a wrong result?
      2. For each: what's the database-level guarantee that prevents it?
         (a constraint, a transaction isolation level, an atomic claim —
          NOT an application-level check)
      3. Write a test that actually runs N requests concurrently and proves it.
CONSTRAINTS: "Check then write" is never an answer. Neither is a global lock.
             The guarantee must live in Postgres.
FAILURE: Do not claim safety without showing real concurrent test output.
OUTPUT: The vulnerability list, the fix, the test, and the raw test output.
```

---

## 4. The Security prompt — *weekly, and before every launch*

```
ROLE: Application security engineer performing a pre-launch review.
CONTEXT: [routes, policies, server actions, auth flow]
TASK: Find every vulnerability. Prioritize: broken access control, tenant isolation,
      injection, secrets exposure, missing rate limits, insecure direct object
      references, webhook forgery, and anything letting a user pay less than they owe.
      Each finding: severity, exploit path, proof, fix.
CONSTRAINTS: Report only. Assume an attacker with devtools, my page source, my API
             responses, and unlimited patience.
OUTPUT: Ranked findings with reproduction steps. Then: the 3 to fix before launch.
```

---

## 5. The Self-Review prompt — *after the agent finishes, before you merge*

```
ROLE: Senior engineer reviewing a pull request from someone you don't yet trust.
CONTEXT: [the diff you just generated]
TASK: 1. What did this change that it wasn't asked to change?
      2. What did it claim to do that it didn't actually do?
      3. What's the bug a reviewer would catch in 30 seconds?
      4. What's now duplicated that should be shared?
      5. What breaks if this runs twice?
CONSTRAINTS: Be adversarial. "Looks good" is a failed review.
OUTPUT: Ranked comments. Then: approve, or request changes with specifics.
```

Running this on the agent's own output catches a startling amount. Different framing, different
attention — a model asked to *review* notices what a model asked to *build* glossed over.

---

## 6. The Decomposition prompt — *when you don't know where to start*

```
ROLE: Technical architect.
OBJECTIVE: Break "[the big scary thing]" into buildable pieces.
CONTEXT: [what exists, my skill level, my time budget]
TASK: 1. Decompose into components that can be built and TESTED independently
      2. Order them by dependency, then by "what proves the risky assumption soonest"
      3. For each: the outcome, the hard part, and how I'd know it works
      4. Name the ONE piece most likely to be harder than it looks, and why
CONSTRAINTS: No piece larger than one working session. If a piece needs
             "and then", split it. No code yet.
OUTPUT: Ordered list with dependencies. Then: what to build first, and what to
        deliberately skip in v1.
```

That last line — *what to deliberately skip* — is where most of the value is. Scope you never
took on is scope you never have to maintain.

---

## 7. The Bottleneck prompt — *weekly, forever*

```
ROLE: Growth analyst.
CONTEXT: My real funnel numbers for the last 30 days:
  [views, form submits, bookings, deposits paid, showed up, revenue, rebooked]
  Traffic sources: [...]. Average ticket: [...]. Costs: [...]
TASK: 1. Which step is the bottleneck? Show the arithmetic.
      2. What's a realistic target for that step in this industry?
      3. What are the 3 cheapest experiments to move it?
      4. What would each be worth in dollars per month if it worked?
CONSTRAINTS: Do not recommend new features. Work only with what I have.
             If the data is too thin to conclude anything, say so instead of
             inventing a recommendation.
OUTPUT: The bottleneck, the arithmetic, 3 ranked experiments with expected value.
```

---

## The daily rituals

**Morning (2 min), before you write anything:**
```
Read [today's day in the curriculum]. Before we build: what are the 3 decisions
in this task that are expensive to change later? Ask me about them now.
Do not write code yet.
```

**Evening (2 min), before you commit:**
```
Review today's diff as a senior engineer who will maintain this for two years.
What did we do that we'll regret? What's the one thing to clean up before I commit?
```

---

## Five rules for working with agents

1. **One job per run.** "Fix the bug and refactor the module and add tests" gets you a
   half-done refactor with a new bug. Three runs, three jobs.
2. **Never accept "done" without evidence.** `FAILURE CONDITIONS: do not claim completion
   until the test output is shown.` Then read the output yourself.
3. **Paste real context, not descriptions of context.** Real schema, real error, real file.
   An agent guessing at your codebase writes code for a codebase that doesn't exist.
4. **Constraints are worth more than requirements.** Requirements say what you want.
   Constraints prevent the class of mistake that costs you a customer.
5. **You own everything it writes.** Not "the AI wrote a security hole" — you shipped a
   security hole. This is why Day 4 and Day 6 exist, and why BREAK IT is never optional.
