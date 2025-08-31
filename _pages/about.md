---
permalink: /
title: "Hi there! 👋 I am Yaxin Luo."
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

<div class="section-header">
About Me
</div>

<div class="about-me-content">
Hello! I am a First-Year Machine Learning PhD student at [MBZUAI](https://mbzuai.ac.ae/), advised by [Prof. Zhiqiang Shen](https://zhiqiangshen.com/), [Dr.Fabio Pizzati](https://fabvio.github.io/) and [Prof.Ivan Laptev](https://www.di.ens.fr/~laptev/) . I am also closely working with my friend [Xiaofu Chen](https://xxfchen.github.io/XiaofuChen/). Previously, I was a Research Assistant at MBZUAI and received my Bachelor's degree from [Technical University of Denmark](https://www.dtu.dk/english/) supervised by [Prof. Dim P. Papadopoulos](https://dimipapa.github.io/). Recently, I am focusing on **physical aware learning** for vision models and **analysis the pretrain data of LLM**. My research interests span in :
- **Multimodal Foundation Model / World Model**: Developing native multimodal foundation models which can perform  **understanding**, **reasoning**, **generation** tasks from video,language, speech. These models will serve as the core intelligence—the "brain"—for Embodied AI, Robotics, and many other applications. **(My Long-Term research interest and belief)**

- **Reinforcement Learning**: I study reinforcement learning on top of pretrained and SFT-initialized models to move beyond imitation—unlocking new capabilities in generative modeling and robotics, including training agents inside learned world-model environments.

- **Data-centric Machine Learning**: Analysis and Understanding the training data of the model, improve the data quality, compress the data for training efficiency, scalable and cheap data pipline for curating or synthesis high quality training data.
</div>


News
======

<div class="news-item">
🚀 <strong><a href="https://github.com/MetaAgentX/OpenCaptchaWorld">OpenCaptchaWorld</a></strong> released and expanded to double the dataset size!
</div>


Selected Publications
======
*( * indicate equal contribution)*

For full and up-to-date publication list, please refer to my [Google Scholar](https://scholar.google.com/citations?user=tEaSCzYAAAAJ&hl=en) page.

* <img src="./images/opencaptchaworld.png" width="400px" align="left" style="margin-right:10px" class="publication-image"> **OpenCaptchaWorld: AComprehensive Web-based Platform for Testing and Benchmarking Multimodal LLM Agents**
  * <span class="venue-badge arxiv">arXiv</span>
  * **Yaxin Luo** *, Zhaoyi Li *, Jiacheng Liu, Jiacheng Cui, Xiaohan Zhao, Zhiqiang Shen
  * <a href="https://arxiv.org/abs/2505.24878" class="enhanced-link paper-link">📄 Paper</a> <a href="https://github.com/MetaAgentX/OpenCaptchaWorld" class="enhanced-link code-link">💻 Code</a> <a href="https://huggingface.co/spaces/YaxinLuo/Open_CaptchaWorld" class="enhanced-link demo-link">🚀 Demo</a>

* <img src="./images/APL.png" width="400px" align="left" style="margin-right:10px" class="publication-image"> **APL: Anchor-Based Prompt Learning for One-Stage Weakly Supervised Referring Expression Comprehension**
  * <span class="venue-badge eccv">ECCV 2024</span>
  * **Yaxin Luo**,Jiayi Ji, Xiaofu Chen, Yuxin Zhang, Tianhe Ren, Gen Luo
  * <a href="https://link.springer.com/chapter/10.1007/978-3-031-72624-8_12" class="enhanced-link paper-link">📄 Paper</a> <a href="https://github.com/Yaxin9Luo/APL" class="enhanced-link code-link">💻 Code</a>

* <img src="./images/MoD.png" width="400px" align="left" style="margin-right:10px" class="publication-image"> **γ-MoD: Exploring Mixture-of-Depth Adaptation for Multimodal Large Language Models**
  * <span class="venue-badge iclr">ICLR 2025</span>
  * **Yaxin Luo**, Gen Luo, Jiayi Ji, Yiyi Zhou, Xiaoshuai Sun, Zhiqiang Shen, Rongrong Ji
  * <a href="https://arxiv.org/abs/2410.13859" class="enhanced-link paper-link">📄 Paper</a> <a href="https://github.com/Yaxin9Luo/gamma-MoD" class="enhanced-link code-link">💻 Code</a>

* <img src="./images/DViN.png" width="400px" align="left" style="margin-right:10px" class="publication-image"> **DViN: Dynamic Visual Routing Network for Weakly Supervised Referring Expression Comprehension**
  * <span class="venue-badge cvpr">CVPR 2025</span>
  * Xiaofu Chen, **Yaxin Luo**, Gen Luo, Jiayi Ji, Henghui Ding, Yiyi Zhou
  * <a href="https://openaccess.thecvf.com/content/CVPR2025/html/Chen_DViN_Dynamic_Visual_Routing_Network_for_Weakly_Supervised_Referring_Expression_CVPR_2025_paper.html" class="enhanced-link paper-link">📄 Paper</a> <a href="https://github.com/XxFChen/DViN" class="enhanced-link code-link">💻 Code</a>

<style>
/* Beautiful Conference Venue Badges */
.venue-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.9em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: white !important;
  margin: 4px 8px 4px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.venue-badge:before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s;
}

.venue-badge:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.venue-badge:hover:before {
  left: 100%;
}

/* Specific Conference Colors */
.venue-badge.cvpr {
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
}

.venue-badge.cvpr:hover {
  box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
}

.venue-badge.eccv {
  background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
}

.venue-badge.eccv:hover {
  box-shadow: 0 6px 20px rgba(155, 89, 182, 0.4);
}

.venue-badge.iclr {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
}

.venue-badge.iclr:hover {
  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
}

.venue-badge.arxiv {
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
}

.venue-badge.arxiv:hover {
  box-shadow: 0 6px 20px rgba(243, 156, 18, 0.4);
}

.venue-badge.nips,
.venue-badge.neurips {
  background: linear-gradient(135deg, #1abc9c 0%, #16a085 100%);
}

.venue-badge.nips:hover,
.venue-badge.neurips:hover {
  box-shadow: 0 6px 20px rgba(26, 188, 156, 0.4);
}

.venue-badge.icml {
  background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
}

.venue-badge.icml:hover {
  box-shadow: 0 6px 20px rgba(52, 73, 94, 0.4);
}

.venue-badge.aaai {
  background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
}

.venue-badge.aaai:hover {
  box-shadow: 0 6px 20px rgba(230, 126, 34, 0.4);
}

.venue-badge.ijcai {
  background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
}

.venue-badge.ijcai:hover {
  box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
}

/* News item enhanced styling */
.news-item {
  padding: 15px 20px;
  margin: 12px 0;
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(155, 89, 182, 0.1) 100%);
  border-radius: 12px;
  border-left: 4px solid #3498db;
  transition: all 0.3s ease;
}

.news-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.2);
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.15) 0%, rgba(155, 89, 182, 0.15) 100%);
}

/* About Me section enhancement */
.section-header {
  font-size: 1.5em;
  font-weight: 700;
  color: #2c3e50;
  margin: 30px 0 15px 0;
  padding-bottom: 8px;
  border-bottom: 3px solid #3498db;
  position: relative;
}

.section-header:after {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 0;
  width: 50px;
  height: 3px;
  background: linear-gradient(90deg, #3498db, #9b59b6);
}

.about-me-content {
  padding: 20px;
  margin: 15px 0;
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(155, 89, 182, 0.1) 100%);
  border-radius: 12px;
  border-left: 4px solid #3498db;
  transition: all 0.3s ease;
  line-height: 1.6;
}

.about-me-content:hover {
  transform: translateX(3px);
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.1);
}

.about-me-content ul {
  margin: 15px 0;
  padding-left: 20px;
}

.about-me-content ul li {
  margin: 8px 0;
  padding: 8px 0;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.about-me-content ul li:hover {
  background: rgba(52, 152, 219, 0.1);
  padding-left: 10px;
}

.about-me-content strong {
  color: #3498db;
  font-weight: 600;
}

.about-me-content a {
  color: #3498db;
  text-decoration: none;
  transition: all 0.3s ease;
}

.about-me-content a:hover {
  color: #9b59b6;
  text-decoration: underline;
}

/* Responsive design for badges */
@media (max-width: 768px) {
  .venue-badge {
    padding: 4px 10px;
    font-size: 0.8em;
    margin: 2px 4px 2px 0;
  }
}

@media (max-width: 480px) {
  .venue-badge {
    padding: 3px 8px;
    font-size: 0.75em;
  }
}
</style>