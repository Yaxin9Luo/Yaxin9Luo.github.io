---
title: "Harness, and How to Internalize Harness into Model's Own Behaviors"
date: 2026-10-09
summary: What a harness is, why the harness built for inference-time performance and the harness built for post-training are completely different, and how harness behavior gets internalized into the model.
type: essay
tags: [harness, agents]
placeholder: true
---

*Outline. The full post is being written section by section.*

## 1. What a harness is

- What a harness is, and what it does.
- Why it matters for a coding agent.

## 2. Two harnesses with different purposes

- The inference-time performance-optimization harness vs. the harness designed for post-training.
- The two are completely different.
- The inference-time harness exists purely to finish the current task well.

## 3. Internalization and co-evolution

- How the model and the harness train together: model parameters plus the harness, in some form of co-evolution.
- The focus is internalization.
- Why an inference-time-optimized harness is bad for internalization.
- Why, and how, to design a separate harness for post-training.

## 4. Training trajectories and rewriting

- How the harness should constrain the model's behavior and trajectory, so that the model gets better post-training trajectories.
- How the collected trajectories should be rewritten.
