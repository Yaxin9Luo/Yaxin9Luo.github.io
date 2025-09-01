---
permalink: /cv/
author_profile: false
redirect_from:
  - /resume
---

{% include base_path %}

<!-- Artistic CV Header -->
<section class="cv-hero">
  <div class="cv-hero__inner">
    <div class="cv-hero__left">
      <h1 class="cv-title">Yaxin Luo</h1>
      <div class="cv-subtitle">Vision & Multimodal Foundation Models</div>
      <div class="cv-contact">
        <a href="mailto:Yaxin.Luo@mbzuai.ac.ae" class="cv-chip"><i class="fas fa-envelope"></i> Yaxin.Luo@mbzuai.ac.ae</a>
        <span class="cv-chip"><i class="fas fa-phone"></i> +971 585699266 (UAE) · +86 17882057622 (China)</span>
        <a href="https://yaxin9luo.github.io/" target="_blank" rel="noopener" class="cv-chip"><i class="fas fa-globe"></i> Website</a>
        <a href="https://scholar.google.com/citations?user=tEaSCzYAAAAJ&hl=en" target="_blank" rel="noopener" class="cv-chip"><i class="fas fa-graduation-cap"></i> Google Scholar</a>
      </div>
    </div>
    <div class="cv-hero__right">
      <a class="btn btn--large cv-download" href="{{ base_path }}/files/CV_YaxinLuo.pdf" target="_blank" rel="noopener">
        <i class="fas fa-file-pdf"></i> Download CV (PDF)
      </a>
    </div>
  </div>
  <div class="cv-hero__underline"></div>
  <div class="cv-hero__blobs">
    <div class="blob blob-a"></div>
    <div class="blob blob-b"></div>
  </div>
  <div class="cv-hero__note">Abu Dhabi, UAE · MBZUAI</div>
  
</section>

<div class="cv-grid">
  <!-- Left Column -->
  <section class="cv-section">
    <h2 class="cv-h2"><i class="fas fa-compass"></i> Research Interests</h2>
    <p>
      My long-term goal is to develop intelligent machines capable of perceiving, understanding, and creating multimodal content (e.g., videos). Interests include multimodal
      machine learning, vision foundation models, and efficient algorithms for foundation models. Recently, I am focusing on <strong>physical aware learning</strong> for vision models and <strong>analysis of pretrain data of LLM</strong>.
    </p>
  </section>

  <!-- Right Column -->
  <section class="cv-section">
    <h2 class="cv-h2"><i class="fas fa-graduation-cap"></i> Education</h2>
    <div class="cv-timeline">
      <div class="cv-item">
        <div class="cv-item__title">PhD in Machine Learning, MBZUAI</div>
        <div class="cv-item__meta">2025–2029 (expected Dec 2029)</div>
        <div class="cv-item__detail">PhD Advisor: <strong>Prof. Zhiqiang Shen</strong> & <strong>Prof. Ivan Laptev</strong></div>
      </div>
      <div class="cv-item">
        <div class="cv-item__title">BSc in General Engineering (Machine Learning), Technical University of Denmark</div>
        <div class="cv-item__meta">2021–2025</div>
        <div class="cv-item__detail">Bachelor thesis advisor: <strong>Prof. Dimitrios Papadopoulos</strong></div>
      </div>
      <div class="cv-item">
        <div class="cv-item__title">BSc in Mathematics, University of Edinburgh</div>
        <div class="cv-item__meta">2020–2021</div>
        <div class="cv-item__detail">Overall grade of taken courses: UK First-Class; withdrew 19 Mar 2021 (changed major and country)</div>
      </div>
    </div>
  </section>

  <section class="cv-section">
    <h2 class="cv-h2"><i class="fas fa-briefcase"></i> Working Experience</h2>
    <div class="cv-timeline">
      <div class="cv-item">
        <div class="cv-item__title">Research Assistant, MBZUAI</div>
        <div class="cv-item__meta">Jan 2025–Aug 2025</div>
        <ul class="cv-item__bullets">
          <li>Analyzing LLM generalization ability on pure vision tasks using only image data</li>
          <li>Exploring reasoning in MLLMs</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="cv-section">
    <h2 class="cv-h2"><i class="fas fa-book-open"></i> Publications (first author only)</h2>
    <div class="cv-cards">
      <div class="cv-card">
        <div class="cv-card__title"><strong>ICLR 2025</strong> — γ-MoD: Exploring Mixture-of-Depth Adaptation for Multimodal Large Language Models.</div>
        <div class="cv-card__body">γ-MoD is a plug-and-play approach that replaces redundant dense layers with Mixture-of-Depth (MoD) layers to reduce computation while maintaining performance.</div>
      </div>
      <div class="cv-card">
        <div class="cv-card__title"><strong>ECCV 2024</strong> — APL: Anchor-based Prompt Learning for One-stage Weakly Supervised Referring Expression Comprehension.</div>
        <div class="cv-card__body">Introduces an Anchor-based Prompt Encoder (APE) to fuse position, color, and category prompts into anchor features, improving weakly supervised vision–language alignment with auxiliary text reconstruction and visual alignment losses; achieves SOTA on RefCOCO and ReferIt.</div>
      </div>
    </div>
  </section>

  <section class="cv-section">
    <h2 class="cv-h2"><i class="fas fa-hands-helping"></i> Other Experience</h2>
    <div class="cv-cards cv-cards--compact">
      <div class="cv-card">
        <div class="cv-card__title">IEEE Cybermatics Congress 2024 — Conference Local Team Member (Aug 2024)</div>
        <div class="cv-card__body">Acted as a conference helper and session chair of the Smart Data workshop.</div>
      </div>
      <div class="cv-card">
        <div class="cv-card__title">SciSec 2024 — Conference Helper (Aug 2024)</div>
      </div>
      <div class="cv-card">
        <div class="cv-card__title">Institute of Social Science Survey, Peking University — Summer Internship (Jul 2019–Sep 2019)</div>
        <div class="cv-card__body">Internship in a public psychological healthcare project led by the Ministry of Civil Affairs, China.</div>
      </div>
    </div>
  </section>

  <section class="cv-section">
    <h2 class="cv-h2"><i class="fas fa-tools"></i> Other Skills</h2>
    <div class="cv-skill-badges">
      <span class="badge">HPC (Slurm)</span>
      <span class="badge">DeepSpeed</span>
      <span class="badge">Distributed Computing </span>
      <span class="badge">Embedded Systems (3 projects)</span>
      <span class="badge">Signal Processing & Acoustics</span>
      <span class="badge">Bioinformatics (DTU coursework)</span>
    </div>
  </section>
</div>

<section class="cv-section cv-section--wide">
  <h2 class="cv-h2"><i class="fas fa-eye"></i> PDF Preview</h2>
  <div class="cv-pdf">
    <iframe
      src="{{ base_path }}/files/CV_YaxinLuo.pdf#view=FitH"
      title="CV PDF preview"></iframe>
  </div>
  <p class="cv-note">If the PDF preview does not load, use the download button above.</p>
</section>
