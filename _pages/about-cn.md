---
permalink: /zh/
title: "你好，我是罗亚鑫 · Yaxin Luo。"
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
    {{ site.data.portfolio.profile.bio.zh }}
  </div>

  <div class="background-text">
    在攻读博士之前，我本科毕业于 <a href="https://www.dtu.dk/english/" class="institution-link">Technical University of Denmark</a>，曾受 <a href="https://dimipapa.github.io/" class="advisor-link">Prof. Dim P. Papadopoulos</a> 指导。本科期间，我也与 <a href="https://scholar.google.com/citations?user=EyZqU9gAAAAJ&hl=en" class="advisor-link">Dr. Gen Luo</a> 和 <a href="https://scholar.google.com/citations?user=lRSD7PQAAAAJ&hl=en" class="advisor-link">Prof. Rongrong Ji</a> 合作开展高效深度学习相关研究。这些经历让我持续关注高效、可扩展，并且能够服务真实世界任务的智能系统。
  </div>

  <div class="research-interests">
    <h4>我的研究兴趣主要集中在：</h4>
    <ul>{% for direction in site.data.portfolio.research limit:3 %}<li><strong>{{ direction.title.zh }}</strong>: {{ direction.description.zh }}</li>{% endfor %}</ul>
  </div>

  <div class="current-focus">
    近期聚焦生产力级多模态智能体设计，以及支撑长程任务的 Agent Harness 自动迭代。
  </div>
</div>
</div>

<div class="section-header">
经历
</div>

{% include resume-experience.html lang='zh' %}

{% include open-source-projects.html lang='zh' %}

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

{% assign added_papers = 'llmsurgeon|language-bias' | split: '|' %}
{% for id in added_papers %}{% assign paper = site.data.portfolio.publications | where: 'id', id | first %}
<div class="pub-entry"><div class="pub-text"><strong><a href="{{ paper.links.first.url }}">{{ paper.title.zh }}</a></strong><br><span class="venue-badge">{{ paper.venue }} {{ paper.year }}</span><p>{{ paper.authors }}</p><p>{{ paper.summary.zh }}</p></div></div>
{% endfor %}

<div class="pub-entry">
  <div class="pub-image">
    <img src="{{ '/images/nextgen-captchas.png' | relative_url }}" alt="Next-Gen CAPTCHAs project figure">
  </div>
  <div class="pub-text">
    <strong>Next-Gen CAPTCHAs: Leveraging the Cognitive Gap for Scalable and Diverse GUI-Agent Defense</strong><br>
    <span class="venue-badge icml">ICML 2026</span><br>
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
