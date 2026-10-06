---
title: Notes on native multimodal models
date: 2026-08-30
summary: Why "one model, many modalities" changes what a design agent can do, in three short notes.
type: note
tags: [multimodal]
placeholder: true
---

Short notes while reading about models that are trained on images and text together from the start, rather than stitched together afterwards.

## 1. Shared tokens, shared mistakes

When image and text share one token space, the model's errors in layout look like its errors in prose. That is good news: the same training signals can fix both.

## 2. Generation is a reading test

A model that can generate a layout has to have read thousands of them. Generation quality is a cheap probe of perception quality.

## 3. Evaluation is the bottleneck

For design tasks there is rarely a single right answer. Most of the work is building judges that agree with people.

*Placeholder post for the blog layout.*
