---
title: What the harness knows that the model doesn't
date: 2026-10-02
summary: A long-running agent is mostly scaffolding. Which parts of that scaffolding could a model learn to carry itself?
type: essay
tags: [harness, agents]
placeholder: true
---

Every agent that survives a multi-hour task is wrapped in something. A task list it keeps returning to. A rule that says *don't stop because a milestone felt like a good place to report*. A verifier that refuses to accept "done" without evidence. We call this the harness, and for hard tasks it often matters more than the model inside it.[^1]

That raises a question I keep coming back to: **how much of the harness is knowledge the model could hold itself?**

## Three kinds of scaffolding

Looking at the harnesses I've written over the past year, the pieces fall into roughly three groups, nested around the model like the layers of an onion.

![Harness layers](/blog/harness-layers.svg "Figure 1. The harness as nested layers around the model. Outer layers compensate for limits of the window; inner layers encode habits and taste.")

1. **Memory**: checklists, scratch files, summaries that survive a context reset. These compensate for a finite window.
2. **Discipline**: rules about when to stop, when to verify, when to ask. These compensate for habits the model learned elsewhere.
3. **Judgment**: routing a subtask to the right tool, deciding that a result is good enough. These encode taste.

> A harness rule is a correction written down once and paid for on every call.

Memory seems like infrastructure; it will probably always live outside the weights. Discipline is the interesting middle. Judgment is where it gets hard.

## Pricing a rule

One way to see why internalising matters: every rule in the prompt costs tokens on every call, and attention spent reading the rule is attention not spent on the task. If a harness has $k$ rules of average length $\ell$, and an episode makes $T$ calls, the overhead is roughly

$$
C_{\text{harness}} = T \cdot \sum_{i=1}^{k} \ell_i \;\approx\; T k \bar{\ell}
$$

For a long run ($T$ in the hundreds) that adds up fast. A rule the model has internalised costs nothing at inference time.

> [!NOTE]
> The cost is not only tokens. A rule competes for attention with the task itself, and long rule lists tend to be followed less reliably than short ones.[^2]

## What removal might look like

The experiment I want to run: start with a harness that works, delete one rule at a time, and measure how often a long task still finishes correctly, first for the base model and then for a model trained on trajectories from the full harness.

```chart
{
  "type": "line",
  "title": "Task success as harness rules are removed (illustrative)",
  "x": ["0", "1", "2", "3", "4", "5", "6"],
  "series": [
    {"name": "Base model", "values": [78, 71, 63, 52, 44, 35, 29]},
    {"name": "Trained on harness traces", "values": [80, 79, 76, 73, 69, 62, 55]}
  ],
  "y": {"label": "Success rate on long tasks, by number of rules removed", "unit": "%", "min": 0, "max": 100},
  "caption": "Made-up numbers to show the chart component. Hover or use the arrow keys to read values; the Data button shows the table."
}
```

If the trained curve stays flat while the base curve falls, the rules on the flat stretch have moved into the weights.

## A tiny example

The simplest discipline rule I use looks like this:

```python
def should_continue(turn, tasks, attempts):
    # A text-only end of turn is a report, not proof of completion.
    if turn.stop_reason == "end_turn" and tasks.open():
        return attempts < 3
    return False
```

It works. But it is also a sign that the model, left alone, believes it is finished before it is. If a model internalised this, the rule would become dead code.

## Which rules move first

```chart
{
  "type": "bar",
  "title": "Share of runs where removing the rule hurt (illustrative)",
  "x": ["Task list", "Stop rule", "Verify rule", "Tool routing"],
  "series": [
    {"name": "Base model", "values": [64, 48, 41, 22]},
    {"name": "Trained", "values": [61, 12, 15, 18]}
  ],
  "y": {"label": "Runs that got worse without the rule", "unit": "%", "min": 0},
  "caption": "Also made-up. The shape I expect: memory stays outside, discipline moves in."
}
```

| Scaffolding | Lives in | Could move to weights? |
| --- | --- | --- |
| Task list | files | unlikely |
| Stop / continue rules | prompt + loop | plausibly |
| Verification habits | prompt | plausibly |
| Tool routing | code | partly |

---

*This is a placeholder post written to preview the blog layout. Real writing will replace it.*

[^1]: "Harness" here means everything around the model call: the loop, the tools, the prompts, the files the agent reads and writes.
[^2]: An impression from my own runs, not a measured result.
