---
title: How I read a long agent trace
date: 2026-09-18
summary: A six-hour run leaves thousands of steps behind. Four passes that get me from "it failed" to the step where it went wrong.
tags: [Agents, Notes]
placeholder: true
---

A long agent run is easy to start and hard to read afterwards. These are the passes I make, in order.

## Pass one: the ending

Read the last twenty steps first. Did the agent stop because it finished, because it gave up, or because it *believed* it finished? The third case is the most common and the most useful.

## Pass two: the task list

If the harness keeps a checklist, diff it over time. Items that were ticked and later unticked are where the agent found out it was wrong.

## Pass three: the first wrong turn

Binary-search the trace for the first step whose output you would reject. Everything after it is usually a consequence.

> [!TIP]
> Searching for the first tool error is a good starting point, but the first *wrong* step is often a successful tool call with a bad argument.

## Pass four: what it never looked at

List the files and docs the agent could have read and didn't. Missing context explains more failures than bad reasoning.

*Placeholder post for the blog layout.*
