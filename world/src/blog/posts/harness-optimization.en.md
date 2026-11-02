---
title: "The Grader Is the Optimizer"
date: 2026-11-01
summary: We let an AI agent improve another agent's harness. Then a stricter grader re-scored the same pages, and every measured gain shrank by a third to 70%. On open-ended tasks, what an optimizer learns depends on the grader, and is often about it.
type: essay
tags: [harness, agents, evaluation]
---

We let one AI agent rewrite another agent's harness, edit after edit. We kept each edit whose score gain cleared a bar set from measured noise. Then we swapped in a stricter grader and re-scored the same pages. **Every harness lost between a third and 70% of its measured gain**. The best one lost about half: +0.176 (90% interval +0.12 to +0.23) became +0.086 (+0.02 to +0.15). The pages had not changed; only the judge had.[^rerun]

```embed
{"src": "/blog/harness-optimization/interactive/hero.html", "height": 560, "autosize": true, "title": "Same pages, swap the grader", "caption": "The pre-gate gain of each optimized harness on 8 held-out tasks the optimizer never saw, under the lenient grader we optimized with and under a stricter one. Bars are gains over the starting harness (90% intervals); dots are the 72 pages behind them."}
```

Which number is right? We can't tell, and that is the finding: neither grader has been validated at differences this small. On open-ended tasks, "how much did the harness improve?" has no answer that is independent of the grader.

<div class="stats">
<div class="stat"><b>−51%</b><span>pre-gate gain of the best harness, once a stricter grader re-scored the same pages</span></div>
<div class="stat"><b>≈ 1.6 σ</b><span>how far the keep bar sat above the noise of a six-task comparison: near-misses are coin flips</span></div>
<div class="stat"><b>8 of 9</b><span>harness versions kept after seeing failed rubric items had copied rubric text</span></div>
<div class="stat"><b>9 of 11</b><span>accepted improvements were edits of the starting harness</span></div>
</div>

> [!TIP]
> **Watch the optimization happen.** Every run in this post is open as a live dashboard: each edit the Meta Agent tried, its hypothesis, the pages it built, and the keep rule's verdict. [Open one lineage ↗](/blog/harness-optimization/dashboards/stage2/pi-f2-loop-l1/index.html), or browse all twelve: [batch 1–2](/blog/harness-optimization/dashboards/batch/index.html) and [stage 2](/blog/harness-optimization/dashboards/stage2/index.html). How to read one is [further down](#watch-the-loop-the-dashboard).

This is not only about web pages. If your team picks prompts, skills or workflows by an AI judge's score, the same effects apply. That could be campaign copy scored against a brand rubric, support answers against a QA checklist, or clinical notes against a documentation standard. The gain you measure belongs partly to the judge, small wins are mostly noise, and anything you show the optimizer about the rubric will be copied.

## How the loop works

We built an optimization loop around a coding agent that builds interactive web pages from short briefs. The task is open-ended on purpose: there is no single right page, which is where graders are least reliable. Step through it below; every term the rest of the post uses is defined here.

```embed
{"src": "/blog/harness-optimization/interactive/loop.html", "height": 560, "autosize": true, "title": "How the loop works", "caption": "The optimization loop, step by step: the harness, the Meta Agent that edits it, the coding agent, the grader, the keep rule and the feedback setting we varied."}
```

Here is a sample of what the coding agent built on its dev tasks, from print-workshop proposals to medical-statistics explainers:

![A wall of pages the agent built](/blog/harness-optimization/figs/page-wall.jpg "Fifteen dev-task pages the coding agent built during the study. Each was scored by the grader, and each score fed a keep-or-revert decision.")

## Change the grader, and the gain shrinks by a third to 70%

At the end we took the first kept version of four lineages, one per feedback setting. We graded their held-out pages twice: with the lenient grader we had optimized with, and with the strict grader that replaced it. On the same pre-gate metric, every gain shrank:

- by 33% for outcome only;
- by 70% for failed items;
- by about half for the two full-feedback harnesses.

Gate deductions change the ranking too. Count them, and under the strict grader the outcome-only harness ranks first, at +0.090 against +0.070 for the best full-feedback harness. It did not build better pages. The starting harness lost points to gates in 4 of 16 runs, and the outcome-only harness lost none.

![One task, two graders](/blog/harness-optimization/figs/example-page.png "One dev task: the page from the starting harness (left) and from a kept harness (right). Compared with the lenient grader, the strict grader scores the starting page higher (0.74 vs 0.70) and the kept page lower (0.88 vs 0.99). The kept page is 0.14 ahead instead of 0.30.")

So which grader is right? We checked an earlier version of our grader against a separate AI labeler that followed a written protocol; we have no human agreement data. On page pairs that differed clearly, they agreed 6 times out of 6. On pairs that differed slightly, they agreed 16 times out of 32, a coin flip, though from a small sample. This study's held-out gains of 0.03 to 0.18 appear to sit in that slight regime, where no grader we tested is validated. Explore it below. The pages built by harnesses that saw failed rubric items lose the most under the stricter grader.

```embed
{"src": "/blog/harness-optimization/interactive/rq1.html", "height": 520, "autosize": true, "title": "Which grader is right?", "caption": "Left: agreement between an earlier grader version and protocol-guided AI labels on page pairs, by how different the pages are (90% intervals). Right: each held-out page under both graders; 56 of 72 sit below the diagonal."}
```

The lenient grader also saturated at the top. It put 12 of 31 strong pages at 0.9 or above; a reference AI judge put only 5 there.

My takeaway: **a gain without its grader is not a result.** Report every gain under at least two graders, and regrade selected checkpoints whenever the grader changes. It took us nine grader versions to learn this, and every fix removed one failure and exposed another:

- The first grader passed 60 of 100 judge claims no matter what the page did.
- Later versions zeroed correct pages for a 4–5 px overflow.
- The version that fixed both saturated at the top.

## Run-to-run noise is as large as your keep bar

Run the same harness on the same task twice, and its score moves with a standard deviation of 0.05 to 0.07. Re-grading the same page moves it by only about 0.02, so most of the noise comes from the agent's runs, not from the grader.

The keep rule averages over six dev tasks, which helps, but not enough. Our bar of 0.0514 sat only about 1.6 standard deviations above the noise of a six-task comparison. In a simple model with these numbers:
- an edit that truly adds 0.05 everywhere is kept about half the time;
- an edit that adds nothing is kept about 7% of the time.

Try it:

```embed
{"src": "/blog/harness-optimization/interactive/keep-sim.html", "height": 600, "autosize": true, "title": "How often is a real gain kept?", "caption": "An illustrative model, not a measurement: normal run-to-run noise with the study's per-task standard deviation, paired comparisons over the dev tasks, and a fixed bar. Move the sliders, then run 40 evaluations of the same edit."}
```

We tried to be clever. We moved the bar to the logit scale, which is fairer near the top of the score range, and priced in cost and unstable runs. Then we re-decided the 12 edits that the original rule had reverted. Under the lenient grader, the new rule would have kept four of them. Under the strict grader it keeps **none**. In our data, you could not tune a selection rule apart from the grader it reads.

## Show the optimizer failed rubric items, and it copies them

Think of a student who sees the marking sheet before the exam: soon their notes read like the marking sheet. The Meta Agents that saw failed items or full feedback never saw the rubric as a whole, only the text of the items a page had failed. They made the largest dev gains. Then we read the diffs:

- **8 of 9** versions kept under those settings had rubric text in the harness, as item ids or near-verbatim lines. Our count is a lower bound.
- Across all of their candidates, 29 of 37 did.
- None of the 11 outcome-only candidates did.

On held-out tasks, the rubric-fed harnesses showed no reliable advantage over the outcome-only ones, and the strict grader marked their pages down the most.

The optimizer's own notes say what it was doing. In stage 2, the first kept edit of the control-loop lineage starts with this hypothesis, which you can read in the records below: *"Make one verification pass catch what the grader checks."* That is not a bug in the optimizer. It is a rational response to what it was shown. **Feedback visibility is information leakage**, and it should be treated that way.

![Feedback level and gains](/blog/harness-optimization/figs/fig-rq3.png "Any feedback that shows failed rubric items leads to rubric copying. The larger dev gains do not carry over: on held-out tasks under the strict grader, the feedback levels are not separable.")

## Reward hacking happened, just not as cheating

We built two traps for hard cheating:
- a gate that zeroes any page that addresses instructions to the judge;
- a **canary**: a planted scoring loophole that no brief mentions.

The canary can fire: it appeared in 6 of 354 dev runs, 2 of them from the unmodified starting harness, so a single hit proves little. But no held-out page took it under the strict grader (0 of 174). The injection gate never fired in 473 search and dev runs. We did not plant a known injection to test it, so read that zero as "not observed", not "impossible".

Reward hacking still happened, as **grader fitting**:
- Harnesses copied rubric text into their instructions.
- In 11 of 48 candidates, they hard-coded the facts and selectors of specific tasks.
- They modelled what the judges can see. One Meta Agent's notes plan around "the grader's never-scrolling full-page screenshot".

Each of these passes a check without the property the check stands for.

![Rubric copied into a harness, and the cheating counts](/blog/harness-optimization/figs/rubric-copy.png "Top: a kept harness's instructions repeat a rubric item of the grader word for word (highlighted). Bottom: rubric copying by feedback level, and the two cheating traps under the strict grader, both at zero.")

There is an uncomfortable twist: deciding whether an edit is hacking or skill needs a grader too. A contrast check written into the harness is skill if readers care about contrast, and hacking if only this grader does. In this study, at the pressure of harness search, the grader's blind spots and its calibration errors moved the results far more than cheating did. We expect cheating risk to grow as optimization pressure grows.

## Almost all the gain is the first edit

**9 of 11** accepted improvements were edits of the starting harness, 8 of them in the very first iteration. After that, most lineages stalled. One full-feedback lineage kept a second step. The control-loop lineage improved again in stage 2: +0.043 before gates, which is not distinguishable from zero after them. Children of kept versions beat their parents by +0.009 on average over 24 tries, and the best-on-dev candidates did no better than their parents on held-out tasks.

![Dev score of each lineage across edits](/blog/harness-optimization/figs/fig-rq5.png "Dev score of each lineage's kept version across edits under the lenient grader: nearly all of the gain comes from the first edit.")

Pick any lineage below and click through its edits. Each one comes with the Meta Agent's own hypothesis and the keep rule's verdict, straight from the records.

```embed
{"src": "/blog/harness-optimization/interactive/lineages.html", "height": 560, "autosize": true, "title": "Every edit, in the optimizer's words", "caption": "Every lineage of the main study, with each candidate's hypothesis and the keep rule's comparison, from the published run records."}
```

The first edit is real, though. On dev, the versions that saw failed items or full feedback beat letting the grader pick the best of 8 runs of the starting harness; the outcome-only versions did not clear that bar. A final harness also costs a fraction of that resampling per task, so it pays for itself after two to four tasks.

Why does it stall? The obvious suspect, grader saturation, does not explain it: re-decided under the strict grader, none of the reverted candidates becomes a keep. My guess is that a strong model with a reasonable harness has some easy headroom, and one careful edit captures it. Later gains are then smaller than this grader and keep rule can resolve. A stronger optimizer or a bigger budget might find more.

## Watch the loop: the dashboard

None of this was visible from a final number. We saw it on a dashboard: one static page per optimization lineage, exported read-only from the run records. The exporter never writes into a run, and every value on the page is that run's own record under its own rule. Here is how to read one page:

![Anatomy of a dashboard page](/blog/harness-optimization/figs/dashboard-anatomy.png "One lineage's page (stage 2, full feedback, control-loop scope). Top: every candidate against its parent, with its keep bar. Bottom: each edit's hypothesis, its search and dev gains, and the keep rule's own numbers: the adjusted gain against the bar, and the unstable-run counts.")

**[Open this lineage's live dashboard ↗](/blog/harness-optimization/dashboards/stage2/pi-f2-loop-l1/index.html)**. Click any iteration for:
- its diffs;
- its runs, and the page it built for every task;
- the Meta Agent's full notes and session;
- its cost and the integrity monitors.

Stage 2 uses its bar on the logit scale (0.2241). At this lineage's scores that is 0.022 to 0.035 on the 0–1 scale, shrinking as the parent's score rises.

Below are the pages behind the scores. Drag the handle to compare the starting harness's page with a later one.

```embed
{"src": "/blog/harness-optimization/interactive/pages.html", "height": 700, "autosize": true, "title": "Before and after: the pages", "caption": "Real dev-task pages from one lineage under the strict grader: drag to compare two revisions on the same task, or pick another task or revision."}
```

Almost every change we made to the study started from something a dashboard showed. These are records of how the study was run, so you can check where each decision came from:

| The dashboard showed | So we |
|---|---|
| One lineage hit 0.958 after a single edit, then every later edit was reverted | Regraded its pages with a reference judge, found the grader saturating, and built the strict grader |
| The same revision, measured again under the strict grader, fell from 0.960 to 0.792 | Treated scores across a grader change as incomparable, and said so on the page |
| Edits with dev gains were reverted by a fixed bar near the top of the score scale | Moved to a bar on the logit scale with a cost term |
| A first edit gained 0.172 but was vetoed for two extra unstable runs | Priced unstable runs instead of vetoing them |
| Hypotheses and diffs named the grader's checks | Coded every candidate for copied rubric text and task-specific details |
| The control-loop lineage's kept versions changed only instructions and skills | Noted that no loop-code edit was ever kept |
| A keep came from 27% cheaper runs, not from a higher score | Read cost-aware keeps with the cost term in view |

We surveyed public optimization tools, including the OpenEvolve and ShinkaEvolve viewers, GEPA visualizers, LangSmith and Braintrust. They show scores and diffs, and some mark accepted versus rejected candidates. None we found puts the keep rule's terms next to the measured noise, the integrity monitors and the stage changes on one page. For a loop that decides on its own what to keep, that view is what tells a human when to step in.

**Browse every optimization run of the main study:** [batch 1 and 2](/blog/harness-optimization/dashboards/batch/index.html) (eight lineages under the lenient grader) and [stage 2](/blog/harness-optimization/dashboards/stage2/index.html) (four lineages chained to their first stage). The published copies leave out local paths, internal infrastructure names, the identity of the canary and the held-out evaluation, because the canary and the held-out tasks are still in use.

## If someone tells you their agent improves itself

Ask for three things:

1. **A rescore under a second grader.** If the gain halves when the judge changes, it was partly the judge.
2. **The held-out curve after the first edit.** If later edits only win on the tasks they were selected on, the loop is tuning to noise.
3. **The diffs.** Rubric copying and hard-coded task details are invisible in a score and obvious in text.

## What I would tell someone building this loop

1. **Name the grader with every number.** Report gains under two graders, and regrade selected checkpoints when the grader changes.
2. **Set the keep bar from clean run-to-run noise** measured before the first candidate, and freeze it.
3. **Treat feedback as leakage.** Rubric text you show the optimizer tends to end up in the harness.
4. **Read the diffs.** Grader fitting is invisible in scores and obvious in text.
5. **Count observability gaps as grader bugs.** If the judge can't see it, the optimizer will learn that.
6. **Expect the first edit to be most of it**, and spend the rest of your budget on the grader.

On dev, one good edit beat brute-force resampling, and the result is cheap to run. In our study, what limited harness optimization on an open-ended task was neither the optimizer's cleverness nor its honesty. It was the grader. Engineer that first.

*The models: the Meta Agent is Claude Code driving kimi-k3, the coding agent is the Pi agent on kimi-k3, and the judges are AI models. The full report, with methods, intervals and every caveat, is coming soon.*

[^rerun]: Six held-out runs had timed out. They were rerun for the strict regrade, so those six pages are new; the other 72 are identical.
