---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Education
======
* B.S. in Mathematics, University of Edinburgh, 2020-2021
* B.S. in General Engineering, Technical University of Denmark, 2021-2024

Experience
======
* Summer 2019: Summer Internship
  * Chinese Institute of Social Science Survey,Peking University
  * Duties included: Conduct interviews & data collection
* 2023: Research Assistant
  * Collabrate with Xia Men University in weakly supervised referring expression comphrehension.
* 2024: Research Assistant
  * Collabrate with IDEA research institute in efficient scale up MLLM from depth and width(MOE).
  
Skills
======
* Machine Learning & Deep Learning (pytorch,tensorflow)
* Good skills in Python, Matlab
* HPC training(slurm usage), DeepSpeed and some theory knowledge in Distributed computing(like how to calculate how many memory needed for training a LLM)
* 4 Course Projects in Embedded System Programming and circuits
* Signal Processing
* Knowledge in acoustics

Publications
======
  <ul>{% for post in site.publications %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>

Projects
====== 
Few-shot text to video diffusion model (Course project):
Roles in charge:
  1. Search and find the papers which are using diffusion model for text to video generation and propose the one
  which is doable and trainable.
  2. Train the video from own videos.

Sentiment Analysis (Course project):
Roles in charge:
  1. Compare Word2Vec and BERT as embedding extraction methods.
  2. Implement 3 clustering algorithms KMeans, CURE, DBSCAN.

Weakly Supervised Referring Expression Comphrehension:
Roles in charge:
  1. Collect, read and analysis the paper from this research area and discuss advantages and disadvantages of each pathway to find novel ideas with supervisor
  2. Implement and improve the research ideas and conduct extensive experiments to prove it work.
  3. Write the first draft version of whole research paper and modify it based on the feedback from supervisor.