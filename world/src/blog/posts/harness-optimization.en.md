---
title: "Harness Optimization Is Grader Design: Evaluation, and Knowing What Components to Iterate"
date: 2026-10-29
summary: Harness optimization is not RSI, but a part of RSI that must be done well. What matters most is designing the grader, getting evaluation right, and knowing which parts of the harness to iterate.
type: essay
tags: [harness, agents, evaluation]
placeholder: true
---

*Outline. The full post is being written section by section.*

## 1. Harness optimization is not RSI

- Harness optimization is important, but it is not RSI.
- It is a part of RSI that must be done well.
- RSI as I see it: from a strong starting point, tasks get harder; the harness, the model weights (through post-training), and the benchmarks, graders and evaluators all upgrade with them.

## 2. The setup

- A Meta Agent edits an executor's harness: instructions, skills and hooks.
- The executor builds web pages from briefs: an open-ended task with no reference answer.
- A grader scores each run; a frozen keep rule keeps or reverts each edit.

## 3. Can the grader be trusted?

- The grader swung from too lenient to too strict.

## 4. Does noise break keep decisions?

- Run-to-run noise is about the size of the keep bar.

## 5. How much of the grader should the optimizer see?

- Finer feedback gives larger early gains, and also rubric mirroring.

## 6. How does the grader get gamed?

- No hard cheating; gray-zone gaming instead.

## 7. Model ceiling or grader ceiling?

- Most kept edits are first edits; then lineages stall.

## 8. What to guard against

- Overfitting: gains on search tasks that do not carry to dev tasks.
- Rules: freeze the keep rule, set the bar from measured noise, hide dev and held-out tasks, never let the optimizer write what the grader reads.

## 9. What comes next

- Internalizing the harness into the model through post-training (next post).
