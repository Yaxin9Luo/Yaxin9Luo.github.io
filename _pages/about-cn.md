---
permalink: /zh/
title: "你好，我是 Yaxin Luo。"
author_profile: true
---

<div class="language-switch">
  <a href="{{ '/' | relative_url }}">English</a>
</div>

<div class="section-header">
关于我
</div>

<div class="blob-field">
<span class="sr-only">Decorative animated background</span>
<div class="about-me-content">
  <div class="intro-text">
    我是 Yaxin Luo，目前是 <a href="https://mbzuai.ac.ae/" class="institution-link">MBZUAI</a> 机器学习方向一年级博士生，导师是 <a href="https://zhiqiangshen.com/" class="advisor-link">Prof. Zhiqiang Shen</a>。我也与好友 <a href="https://xxfchen.github.io/XiaofuChen/" class="collaborator-link">Xiaofu Chen</a> 保持紧密合作。
    我的研究聚焦于<strong>多模态输入—多模态输出智能体系统（Multimodal-in and Multimodal-out Agentic Systems）</strong>和<strong>递归式自我改进智能体系统（Recursive Self-improvement Agentic Systems）</strong>这两个相互补充的方向：一方面构建统一多模态理解、生成、推理、规划与行动的模型和系统；另一方面探索如何基于 rollout experience，让模型参数与外围的智能体基础设施协同演化。
  </div>

  <div class="background-text">
    在攻读博士之前，我本科毕业于 <a href="https://www.dtu.dk/english/" class="institution-link">Technical University of Denmark</a>，曾受 <a href="https://dimipapa.github.io/" class="advisor-link">Prof. Dim P. Papadopoulos</a> 指导。本科期间，我也与 <a href="https://scholar.google.com/citations?user=EyZqU9gAAAAJ&hl=en" class="advisor-link">Dr. Gen Luo</a> 和 <a href="https://scholar.google.com/citations?user=lRSD7PQAAAAJ&hl=en" class="advisor-link">Prof. Rongrong Ji</a> 合作开展高效深度学习相关研究。这些经历让我持续关注高效、可扩展，并且能够服务真实世界任务的智能系统。
  </div>

  <div class="research-interests">
    <h4>我的研究兴趣主要集中在：</h4>
    <ul>
      <li>
        <strong>多模态输入—多模态输出智能体系统</strong>：我关注能够理解异构多模态输入并生成多模态输出的智能体系统，在统一框架中整合<strong>理解、生成、推理、规划与行动</strong>。我尤其关注能够支持长程交互以及结构化、可编辑内容生成的原生多模态基础模型。
      </li>
      <li>
        <strong>递归式自我改进智能体系统</strong>：我关注能够从 rollout trajectories 和 accumulated experience 中递归改进的智能体系统。在这类系统中，<strong>模型参数</strong>与外围的<strong>智能体基础设施</strong>——包括 harnesses、tools、memory、orchestration、evaluation 和 feedback loops——共同作为优化目标并协同演化，而不是将模型或其 scaffold 中的任何一方视为固定不变。
      </li>
    </ul>
  </div>

  <div class="current-focus">
    最近，我主要关注面向长程交互任务的多模态智能体基础模型与系统，尤其是 Agentic Design、Recursive Self-improvement Agentic Systems 和 Infrastructure Frameworks。
  </div>
</div>
</div>

<div class="section-header">
经历
</div>

<div class="experience-timeline">
  <div class="experience-item">
    <div class="exp-logo">
      <img src="{{ '/images/logos/longcat.png' | relative_url }}" alt="Meituan LongCat Team logo" loading="lazy">
    </div>
    <div class="exp-body">
      <div class="experience-header">
        <div class="experience-title">
          <strong>Research Intern</strong>, <a href="https://longcat.ai/" class="institution-link">Meituan LongCat Team</a>
        </div>
        <div class="experience-meta">2026 年 4 月至今 · 北京，中国</div>
      </div>
      <div class="experience-detail">
        参与 <strong>Unified Multimodal Foundation Model Projects <a href="https://arxiv.org/abs/2603.27538" class="institution-link">（LongCat-Next Team）</a></strong>。
      </div>
      <ul class="experience-bullets">
        <li>面向统一多模态模型的长程多模态交互任务：<strong>Agentic Design System</strong>。</li>
        <li>面向理解与生成统一建模的离散视觉编码器。</li>
      </ul>
    </div>
  </div>

  <div class="experience-item">
    <div class="exp-logo">
      <img src="{{ '/images/logos/mbzuai.png' | relative_url }}" alt="MBZUAI logo" loading="lazy">
    </div>
    <div class="exp-body">
      <div class="experience-header">
        <div class="experience-title">
          <strong>Research Assistant</strong>, <a href="https://mbzuai.ac.ae/" class="institution-link">MBZUAI</a>
        </div>
        <div class="experience-meta">2025 年 1 月 - 2025 年 8 月 · 阿布扎比，阿联酋</div>
      </div>
      <div class="experience-detail">
        在 VILA Lab 由 <a href="https://zhiqiangshen.com/" class="advisor-link">Prof. Zhiqiang Shen</a> 指导。
      </div>
      <ul class="experience-bullets">
        <li>研究 <strong>language-pretraining-induced bias</strong> 如何作为通用视觉任务的强先验，展示 LLM 先验向纯视觉学习迁移的可能性，该工作发表于 <em>TMLR 2026</em>。</li>
        <li>探索多模态大语言模型（MLLMs）中的<strong>推理与智能体行为</strong>，主导 <em>OpenCaptchaWorld</em> benchmark（NeurIPS 2025）。</li>
      </ul>
    </div>
  </div>
</div>

<h1>最新动态</h1>

<div class="news-item">
[2026-08-13] <strong><a href="https://arxiv.org/abs/2608.13560">AutoDesign</a></strong> 已上线 arXiv。该工作提出面向长程智能体设计的 Meta-Harness Optimization 框架，并同步开放了<a href="https://github.com/Yaxin9Luo/AutoDesign">源代码</a>与<a href="https://designanything.ai/">在线演示</a>。
</div>

<div class="news-item">
[2026-02-10] <strong><a href="https://github.com/MetaAgentX/NextGen-CAPTCHAs">Next-Gen CAPTCHAs</a></strong> 已上线 arXiv。这是一套利用认知差异构建可扩展、多样化 GUI-Agent 防御任务的框架。
</div>

<div class="news-item">
[2025-09-18] <strong><a href="https://github.com/MetaAgentX/OpenCaptchaWorld">OpenCaptchaWorld</a></strong> 被 NeurIPS 2025 接收。
</div>

<div id="pub-strip-anchor"></div>

<h1>代表论文</h1>

<p><em>（* 表示共同一作）</em></p>

<p>完整且最新的论文列表请参考我的
<a href="https://scholar.google.com/citations?user=tEaSCzYAAAAJ&hl=en">Google Scholar</a> 主页。</p>

<div class="pub-entry">
  <div class="pub-image">
    <img src="{{ '/images/autodesign.webp' | relative_url }}" alt="AutoDesign 项目概览">
  </div>
  <div class="pub-text">
    <strong>AutoDesign: Meta-Harness Optimization for Long-Horizon Agentic Design</strong><br>
    <span class="venue-badge arxiv">arXiv 2026</span><br>
    <strong>Yaxin Luo</strong> *, Haobin Jiang *, Jialv Zou, Xu Huang, Wenhao Yan, Haodong Li, Zhengrong Yue, Jing Li, Xiaofu Chen, Xiaohan Zhao, Jiacheng Liu, Jiacheng Cui, Zhiqiang Shen, Xiaotong Li<br>
    <a href="https://arxiv.org/abs/2608.13560" class="enhanced-link paper-link">论文</a> <a href="https://github.com/Yaxin9Luo/AutoDesign" class="enhanced-link code-link">代码</a> <a href="https://designanything.ai/" class="enhanced-link demo-link">演示</a> <a href="https://autodesign.designanything.ai/" class="enhanced-link demo-link">项目主页</a>
  </div>
</div>

<div class="pub-entry">
  <div class="pub-image">
    <img src="{{ '/images/nextgen-captchas.png' | relative_url }}" alt="Next-Gen CAPTCHAs project figure">
  </div>
  <div class="pub-text">
    <strong>Next-Gen CAPTCHAs: Leveraging the Cognitive Gap for Scalable and Diverse GUI-Agent Defense</strong><br>
    <span class="venue-badge arxiv">arXiv 2026</span><br>
    Jiacheng Liu *, <strong>Yaxin Luo</strong> *, Jiacheng Cui, Xinyi Shang, Xiaohan Zhao, Zhiqiang Shen<br>
    <a href="https://arxiv.org/abs/2602.09012" class="enhanced-link paper-link">论文</a> <a href="https://github.com/MetaAgentX/NextGen-CAPTCHAs" class="enhanced-link code-link">代码</a> <a href="https://huggingface.co/spaces/zcahjl3/NextGen-CAPTCHAs" class="enhanced-link demo-link">演示</a> <a href="https://greenoso.github.io/NextGen-CAPTCHAs_webpage/" class="enhanced-link demo-link">项目主页</a>
  </div>
</div>

<div class="pub-entry">
  <div class="pub-image">
    <img src="{{ '/images/opencaptchaworld.png' | relative_url }}" alt="OpenCaptchaWorld project figure">
  </div>
  <div class="pub-text">
    <strong>OpenCaptchaWorld: A Comprehensive Web-based Platform for Testing and Benchmarking Multimodal LLM Agents</strong><br>
    <span class="venue-badge neurips">NeurIPS 2025</span><br>
    <strong>Yaxin Luo</strong> *, Zhaoyi Li *, Jiacheng Liu, Jiacheng Cui, Xiaohan Zhao, Zhiqiang Shen<br>
    <a href="https://arxiv.org/abs/2505.24878" class="enhanced-link paper-link">论文</a> <a href="https://github.com/MetaAgentX/OpenCaptchaWorld" class="enhanced-link code-link">代码</a> <a href="https://huggingface.co/spaces/YaxinLuo/Open_CaptchaWorld" class="enhanced-link demo-link">演示</a>
  </div>
</div>

<div class="pub-entry">
  <div class="pub-image">
    <img src="{{ '/images/APL.png' | relative_url }}" alt="APL paper figure">
  </div>
  <div class="pub-text">
    <strong>APL: Anchor-Based Prompt Learning for One-Stage Weakly Supervised Referring Expression Comprehension</strong><br>
    <span class="venue-badge eccv">ECCV 2024</span><br>
    <strong>Yaxin Luo</strong>, Jiayi Ji, Xiaofu Chen, Yuxin Zhang, Tianhe Ren, Gen Luo<br>
    <a href="https://link.springer.com/chapter/10.1007/978-3-031-72624-8_12" class="enhanced-link paper-link">论文</a> <a href="https://github.com/Yaxin9Luo/APL" class="enhanced-link code-link">代码</a>
  </div>
</div>

<div class="pub-entry">
  <div class="pub-image">
    <img src="{{ '/images/MoD.png' | relative_url }}" alt="gamma-MoD paper figure">
  </div>
  <div class="pub-text">
    <strong>γ-MoD: Exploring Mixture-of-Depth Adaptation for Multimodal Large Language Models</strong><br>
    <span class="venue-badge iclr">ICLR 2025</span><br>
    <strong>Yaxin Luo</strong>, Gen Luo, Jiayi Ji, Yiyi Zhou, Xiaoshuai Sun, Zhiqiang Shen, Rongrong Ji<br>
    <a href="https://arxiv.org/abs/2410.13859" class="enhanced-link paper-link">论文</a> <a href="https://github.com/Yaxin9Luo/gamma-MoD" class="enhanced-link code-link">代码</a>
  </div>
</div>
