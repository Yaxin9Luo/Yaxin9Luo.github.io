// Factual portfolio content. Magical place names and game progress are fictional.
// Sources, translation choices, and resolved conflicts: docs/world-content-sources.md.
import openSourceSnapshot from '../../_data/open-source.json' with { type: 'json' };
const bilingual = (en, zh) => ({ en, zh });
const paper = (url) => ({ label: bilingual('Paper', '论文'), url });
const code = (url) => ({ label: bilingual('Code', '代码'), url });
const project = (url) => ({ label: bilingual('Project', '项目主页'), url });
const demo = (url) => ({ label: bilingual('Demo', '演示'), url });

export const profile = {
  name: bilingual(
    'Yaxin Luo',
    '罗亚鑫 · Yaxin Luo',
  ),
  role: bilingual('Machine Learning PhD Student', '机器学习博士生'),
  // One-line positioning and the author's own research statement (shared by the landing, About and _data/portfolio.json).
  positioning: bilingual(
    'Post-training agents for long-horizon expert work — the model and the harness around it, improved together.',
    '后训练面向长程专家级任务的智能体 —— 模型与它周围的 harness，一起进化。',
  ),
  intro: bilingual(
    'I work on one question: how do we get agents to do long, expert work (currently focusing on artifact design tasks), and how do we keep them getting better at it? My answer is to post-train the model and co-evolve its harness together.',
    '我只研究一个问题：如何让智能体完成长程的专家级工作（目前聚焦 artifact design 任务），并让它持续变得更好？我的答案是：后训练模型，同时让它的 harness 共同进化。',
  ),
  affiliation: bilingual('MBZUAI · VILA Lab', 'MBZUAI · VILA 实验室'),
  bio: bilingual(
    'I am a Machine Learning PhD student at MBZUAI, advised by Prof. Zhiqiang Shen. My long-term goal is to build agentic systems that can carry out arbitrary complex, long-horizon human expert work in digital environments, with a path toward real-world tasks. My current focus is production-grade models for agentic design and automated iteration systems for the long-horizon harnesses that support them.',
    '我是罗亚鑫，在 MBZUAI 攻读机器学习博士，导师是 Zhiqiang Shen 教授。我的长期目标是构建能够在数字世界中完成任意复杂、长程人类专家工作的智能体系统，并逐步探索扩展到真实世界任务。目前重点是让模型可靠完成生产级设计类 Agentic 任务，并构建支撑这些任务的长程 Harness 自动迭代系统。',
  ),
  portrait: '/images/Yaxin.JPG',
};

export const research = [
  {
    id: 'multimodal-agents',
    title: bilingual(
      'Artifact Design Post-Training',
      'Artifact Design 后训练',
    ),
    description: bilingual(
      'I build production-grade models for agentic design and study post-training methods for high-quality, structured, editable artifacts, including scientific figures, posters, presentations, and web experiences. AutoDesign provides a concrete setting for this work.',
      '我研究面向 Agentic Design 的模型与 post-training 方法，目标是生成高质量、结构化且可编辑的数字制品，包括科研绘图、海报、演示文稿和网页。AutoDesign 为这项工作提供了具体场景。',
    ),
  },
  {
    id: 'agentic-task-post-training',
    title: bilingual(
      'Long-Horizon Agentic Task Post-Training',
      '长程智能体任务后训练',
    ),
    description: bilingual(
      'I study post-training for long-horizon agentic tasks and build Agent Harnesses for multimodal design workflows. This includes reproducible execution, tool use, trajectory capture, automated evaluation, iterative optimization, and training pipelines informed by rollout evidence and evaluator feedback.',
      '我研究长程智能体任务的 post-training，并为多模态设计工作流构建 Agent Harness，将任务执行、工具调用、轨迹采集、自动评测与迭代优化整合为可复现流程；同时利用 rollout 证据与评测反馈改进系统并支持后续模型训练。',
    ),
  },
];

export const publications = [
  {
    id: 'videococo',
    title: bilingual('VideoCoCo: Code-as-CoT for Physically-Consistent Video Generation via an Agentic Dual-Engine System', 'VideoCoCo：通过智能体双引擎系统与代码思维链生成物理一致视频'),
    venue: 'arXiv', year: 2026,
    authors: 'Haodong Li, Tianfei Ren, Xiaoxiao Ma, Chunmei Qing, Zhen Fang, Sipeng He, Ziyu Guo, Haoyu Wu, Juanxi Tian, Yihang Zou, Ruichuan An, Dongzhi Jiang, Boxue Yang, Ji Xie, Xu Huang, Wenhao Yan, Jialv Zou, Zhengrong Yue, Yaxin Luo, Xiaotong Li, Yuzhu Wang, Junyan Ye, Jinjing Zhao, Zehui Chen, Lin Chen, Renye Yan, Feng Zhao, Pheng-Ann Heng',
    summary: bilingual(
      'Uses executable Blender code as an intermediate representation of a scene and its evolution. Simulation drafts guide a generative video engine toward physically consistent output.',
      '以可执行 Blender 代码表示场景及其动态过程，通过仿真草稿引导生成视频引擎，提升视频的物理一致性。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2607.27380')],
  },
  {
    id: 'autodesign',
    title: bilingual('AutoDesign: Meta-Harness Optimization for Long-Horizon Agentic Design', 'AutoDesign：面向长程智能体设计的 Meta-Harness 优化'),
    venue: 'arXiv', year: 2026,
    authors: 'Yaxin Luo*, Haobin Jiang*, Jialv Zou, Xu Huang, Wenhao Yan, Haodong Li, Zhengrong Yue, Jing Li, Xiaofu Chen, Xiaohan Zhao, Jiacheng Liu, Jiacheng Cui, Zhiqiang Shen, Xiaotong Li',
    summary: bilingual(
      'Meta-Harness Optimization improves a reusable DesignHarness through rollout evidence, evaluation, and acceptance gates. On the 100-paper PosterBench, the reported best score is 78.32, 7.45 points above Claude Design under the matched configuration; gains across seven matched configurations range from 5.01 to 19.56 points.',
      'AutoDesign 使用可复用的 DesignHarness、rollout 证据、评测与接受门控研究长程智能体设计。在 100 篇论文的 PosterBench 上，公开结果最高为 78.32 分，较同配置 Claude Design 高 7.45 分；7 组匹配配置的增益为 5.01–19.56 分。',
    ),
    image: '/images/autodesign.webp',
    links: [paper('https://arxiv.org/abs/2608.13560'), code('https://github.com/Yaxin9Luo/AutoDesign'), project('https://autodesign.designanything.ai/'), demo('https://designanything.ai/')],
  },
  {
    id: 'nextgen-captchas',
    title: bilingual('Next-Gen CAPTCHAs: Leveraging the Cognitive Gap for Scalable and Diverse GUI-Agent Defense', 'Next-Gen CAPTCHAs：利用认知差异构建可扩展、多样化的 GUI 智能体防御'),
    venue: 'ICML', year: 2026,
    authors: 'Jiacheng Liu*, Yaxin Luo*, Jiacheng Cui, Xinyi Shang, Xiaohan Zhao, Zhiqiang Shen',
    summary: bilingual(
      'An interactive CAPTCHA defense framework that examines human–agent differences in perception, memory, decision-making, and action. Its dynamic tasks explore where human intuition and current GUI-agent capabilities diverge.',
      '一套交互式验证码防御框架，研究人与智能体在感知、记忆、决策和行动上的差异，通过动态任务探索人类直觉与当前 GUI 智能体能力之间的差距。',
    ),
    image: '/images/nextgen-captchas.png',
    links: [paper('https://arxiv.org/abs/2602.09012'), code('https://github.com/MetaAgentX/NextGen-CAPTCHAs'), project('https://greenoso.github.io/NextGen-CAPTCHAs_webpage/'), demo('https://huggingface.co/spaces/zcahjl3/NextGen-CAPTCHAs')],
  },
  {
    id: 'opencaptchaworld',
    title: bilingual('Open CaptchaWorld: A Comprehensive Web-based Platform for Testing and Benchmarking Multimodal LLM Agents', 'Open CaptchaWorld：用于测试与评估多模态大模型智能体的综合网页平台'),
    venue: 'NeurIPS', year: 2025,
    authors: 'Yaxin Luo*, Zhaoyi Li*, Jiacheng Liu, Jiacheng Cui, Xiaohan Zhao, Zhiqiang Shen',
    summary: bilingual(
      'A dynamic web CAPTCHA benchmark spanning 20 categories and 225 tasks, with the CAPTCHA Reasoning Depth metric. The reported human success rate is 93.3%, compared with 40.0% for the strongest evaluated agent, exposing gaps in perception, reasoning, and sustained interaction.',
      '动态网页 CAPTCHA 基准，覆盖 20 类、225 个任务，并提出 CAPTCHA Reasoning Depth 指标。论文报告人类成功率为 93.3%，最佳受测智能体为 40.0%，揭示感知、推理与长程交互能力之间的差距。',
    ),
    image: '/images/opencaptchaworld.png',
    links: [paper('https://arxiv.org/abs/2505.24878'), code('https://github.com/MetaAgentX/OpenCaptchaWorld'), demo('https://huggingface.co/spaces/YaxinLuo/Open_CaptchaWorld')],
  },
  {
    id: 'drag',
    title: bilingual('DRAG: Distilling RAG for SLMs from LLMs to Transfer Knowledge and Mitigate Hallucination via Evidence and Graph-based Distillation', 'DRAG：通过证据与图谱蒸馏，将大模型的检索增强生成知识迁移到小模型并缓解幻觉'),
    venue: 'ACL', year: 2025,
    authors: 'Jennifer Chen, Aidar Myrzakhan, Yaxin Luo, Hassaan Muhammad Khan, Sondos Mahmoud Bsharat, Zhiqiang Shen',
    summary: bilingual(
      'Distills retrieval-augmented knowledge from larger to smaller language models using ranked evidence and knowledge graphs. The framework studies factual consistency and practical retrieval-assisted generation with smaller models.',
      '借助排序后的证据与知识图谱，把检索增强知识从大语言模型蒸馏到小模型，研究小模型的事实一致性及实用的检索辅助生成。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2506.01954'), code('https://github.com/VILA-Lab/DRAG')],
  },
  {
    id: 'dvin',
    title: bilingual('DViN: Dynamic Visual Routing Network for Weakly Supervised Referring Expression Comprehension', 'DViN：用于弱监督指代表达理解的动态视觉路由网络'),
    venue: 'CVPR', year: 2025,
    authors: 'Xiaofu Chen, Yaxin Luo, Gen Luo, Jiayi Ji, Henghui Ding, Yiyi Zhou',
    summary: bilingual(
      'Dynamically combines multiple visual encoders with sparse routing for fine-grained visual grounding. Routing-based feature alignment connects visual features and language under weak supervision.',
      '通过稀疏路由动态组合多个视觉编码器，增强细粒度视觉定位能力，并利用基于路由的特征对齐，在弱监督条件下连接视觉特征与语言。',
    ),
    image: '/images/DViN.png',
    links: [paper('https://openaccess.thecvf.com/content/CVPR2025/html/Chen_DViN_Dynamic_Visual_Routing_Network_for_Weakly_Supervised_Referring_Expression_CVPR_2025_paper.html'), code('https://github.com/XxFChen/DViN')],
  },
  {
    id: 'gamma-mod',
    title: bilingual('γ-MoD: Exploring Mixture-of-Depth Adaptation for Multimodal Large Language Models', 'γ-MoD：探索多模态大语言模型的混合深度适配'),
    venue: 'ICLR', year: 2025,
    authors: 'Yaxin Luo, Gen Luo, Jiayi Ji, Yiyi Zhou, Xiaoshuai Sun, Zhiqiang Shen, Rongrong Ji',
    summary: bilingual(
      'Adapts dense multimodal models to selective computation. Attention-map rank identifies candidate layers, while shared vision–language routing and masked routing learning help tokens skip unnecessary computation.',
      '将稠密多模态模型适配为选择性计算模型：利用注意力图的秩识别候选层，再结合视觉语言共享路由与掩码路由学习，让 token 跳过不必要的计算。',
    ),
    image: '/images/MoD.png',
    links: [paper('https://arxiv.org/abs/2410.13859'), code('https://github.com/Yaxin9Luo/gamma-MoD')],
  },
  {
    id: 'apl',
    title: bilingual('APL: Anchor-Based Prompt Learning for One-Stage Weakly Supervised Referring Expression Comprehension', 'APL：用于单阶段弱监督指代表达理解的锚点提示学习'),
    venue: 'ECCV', year: 2024,
    authors: 'Yaxin Luo, Jiayi Ji, Xiaofu Chen, Yuxin Zhang, Tianhe Ren, Gen Luo',
    summary: bilingual(
      'Position, color, and category prompts enrich anchor features for weakly supervised visual grounding. Text reconstruction and visual alignment achieve state-of-the-art results on four REC benchmarks, with a reported 6.44% improvement over RefCLIP on RefCOCO.',
      '通过位置、颜色与类别提示增强锚点特征，结合文本重建与视觉对齐目标，在四个 REC 基准上达到 SOTA；论文报告 RefCOCO 相对 RefCLIP 提升 6.44%。',
    ),
    image: '/images/APL.png',
    links: [paper('https://link.springer.com/chapter/10.1007/978-3-031-72624-8_12'), code('https://github.com/Yaxin9Luo/APL')],
  },
];

// Public-facing publications follow the author's contribution and research-fit criteria.
// Keep the full source collection above for project detail pages and cross-links.
export const selectedPublications = publications.filter(({ id }) => [
  'autodesign',
  'nextgen-captchas',
  'opencaptchaworld',
  'gamma-mod',
  'apl',
].includes(id));

export const experience = [
  {
    id: 'longcat-talent-program',
    role: bilingual('Research Intern · Northern Dipper Talent Program', '北斗计划研究实习生'),
    organization: bilingual(
      'Meituan · M17 LongCat',
      '美团 · M17 龙猫',
    ),
    period: bilingual('Sep 2026 – Present · Beijing, China', '2026 年 9 月至今 · 中国北京'),
    description: bilingual(
      'Research and build Agent Harnesses for long-horizon multimodal design tasks, integrating execution, tool use, trace capture, automated evaluation, and iterative optimization into a reproducible pipeline. Investigate harness automation and meta-optimization using rollout evidence, evaluator feedback, and component-level updates. Contribute to the full LongCat 2.5 post-training workflow for Agentic Design, from post-training harness design and training-oriented trajectory collection to Mid-Training, SFT, and RFT, studying how to internalize behaviors from harness trajectories in the model.',
      '面向多模态长程设计任务研究并构建 Agent Harness，将任务执行、工具调用、轨迹记录、自动评测与迭代优化整合为可复现流程。探索 Harness 自动化与元优化，利用 rollout 证据、评测反馈和组件级更新提升长程任务的稳定交付能力。参与 LongCat 2.5 Agentic Design 任务后训练全流程，涵盖后训练 Harness 设计、面向训练的轨迹采集、Mid-Training、SFT 与 RFT，研究如何将 Harness 轨迹中的行为内化到模型中。',
    ),
  },
  {
    id: 'longcat-research-intern',
    role: bilingual('Research Intern', '研究实习生'),
    organization: bilingual('Meituan · M17 LongCat', '美团 · M17 龙猫'),
    period: bilingual('Apr 2026 – Sep 2026 · Beijing, China', '2026 年 4 月至 9 月 · 中国北京'),
    description: bilingual(
      'Focused on AutoDesign and long-horizon design agents, developing reusable DesignHarnesses, evaluation protocols, and workflows around real deliverables.',
      '聚焦 AutoDesign 与长程设计智能体，围绕真实交付物构建可复用的 DesignHarness、评测协议与工作流。',
    ),
  },
  {
    id: 'mbzuai-ra',
    role: bilingual('Research Assistant', '研究助理'),
    organization: bilingual('MBZUAI · VILA Lab', 'MBZUAI · VILA 实验室'),
    period: bilingual('Jan 2025 – Aug 2025 · Abu Dhabi, UAE', '2025 年 1 月至 8 月 · 阿联酋阿布扎比'),
    description: bilingual(
      'Advised by Prof. Zhiqiang Shen. Studied transfer of language-pretrained parameters to vision using label-free random-label bridge training. Built Open CaptchaWorld, an interactive multimodal browser-agent benchmark with 20 categories and 225 dynamic CAPTCHAs, accepted at NeurIPS 2025.',
      '由 Zhiqiang Shen 教授指导，研究语言预训练参数向纯视觉任务的迁移，提出无需人工标注的随机标签桥接训练。构建 Open CaptchaWorld 多模态浏览器智能体交互基准，覆盖 20 类、225 个动态 CAPTCHA，被 NeurIPS 2025 接收。',
    ),
  },
  {
    id: 'cybermatics-service',
    role: bilingual('Conference Local Team Member', '会议本地工作组成员'),
    organization: bilingual('IEEE Cybermatics Congress 2024', 'IEEE Cybermatics Congress 2024'),
    period: bilingual('Aug 2024', '2024 年 8 月'),
    description: bilingual('Conference helper and session chair for the Smart Data workshop.', '协助会议事务，并担任 Smart Data 研讨会的分会场主持。'),
  },
  {
    id: 'scisec-service',
    role: bilingual('Conference Helper', '会议志愿协助'),
    organization: bilingual('SciSec 2024', 'SciSec 2024'),
    period: bilingual('Aug 2024', '2024 年 8 月'),
    description: bilingual('Supported the SciSec 2024 conference.', '协助 SciSec 2024 会议工作。'),
  },
  {
    id: 'pku-intern',
    role: bilingual('Summer Intern', '暑期实习生'),
    organization: bilingual('Institute of Social Science Survey, Peking University', '北京大学中国社会科学调查中心'),
    period: bilingual('Jul 2019 – Sep 2019', '2019 年 7 月至 9 月'),
    description: bilingual('Contributed to a public psychological healthcare project led by China’s Ministry of Civil Affairs.', '参与由中国民政部牵头的公共心理健康项目。'),
  },
];

export const journey = [
  {
    id: 'phd',
    role: bilingual('PhD in Machine Learning', '机器学习博士研究'),
    organization: bilingual('MBZUAI', '穆罕默德·本·扎耶德人工智能大学（MBZUAI）'),
    period: bilingual(
      'Aug 2025 – Present',
      '2025 年 8 月至今',
    ),
    description: bilingual('Advised by Prof. Zhiqiang Shen. Researching post-training for artifact design and long-horizon agentic tasks, with the long-term goal of enabling agents to carry out complex expert work in digital environments.', '导师为 Zhiqiang Shen 教授，主要研究 artifact design 与长程智能体任务的 post-training，长期目标是让智能体能够在数字世界中完成复杂专家工作。'),
  },
  {
    id: 'dtu',
    role: bilingual('Bachelor of General Engineering · Machine Learning', '通用工程学士 · 机器学习方向'),
    organization: bilingual('Technical University of Denmark', '丹麦技术大学'),
    period: bilingual(
      'Sep 2021 – Apr 2025',
      '2021 年 9 月至 2025 年 4 月',
    ),
    description: bilingual(
      'Bachelor thesis advised by Prof. Dimitrios Papadopoulos. Collaborated with Dr. Gen Luo and Prof. Rongrong Ji on efficient deep learning during my undergraduate studies.',
      '本科论文导师为 Dimitrios Papadopoulos 教授；本科期间也与 Gen Luo 博士和 Rongrong Ji 教授合作开展高效深度学习研究。',
    ),
  },
  {
    id: 'edinburgh',
    role: bilingual('Mathematics and Physics Studies', '数学与物理学习'),
    organization: bilingual('University of Edinburgh', '爱丁堡大学'),
    period: bilingual(
      'Sep 2020 – Apr 2021 · Undergraduate studies',
      '2020 年 9 月至 2021 年 4 月 · 本科学习经历',
    ),
    description: bilingual(
      'Studied pure mathematics and physics, with an early fascination for string theory. My tutor Prof. Ana Rita Pires helped turn that curiosity into a commitment to research. I later changed major and country; no Edinburgh degree was completed.',
      '学习纯数学与物理，曾对弦理论充满好奇。导师 Ana Rita Pires 教授的鼓励与支持，让这份好奇逐渐转化为科研志向。之后我更换专业与国家，未在爱丁堡完成学位。',
    ),
  },
  {
    id: 'brisbane',
    role: bilingual('Biomedicine and an Early Business Chapter', '生物医学与早期商业经历'),
    organization: bilingual('University of Queensland · Brisbane', '昆士兰大学 · 布里斯班'),
    period: bilingual('Before Edinburgh · Dates not recorded', '爱丁堡之前 · 原站未记录日期'),
    description: bilingual(
      'I enrolled in biomedicine and prepared for medical-school admission while managing a multi-brand boutique in Brisbane’s South Bank. That early business-focused chapter preceded the shift toward science and research in Edinburgh.',
      '我曾就读生物医学并准备医学院入学，同时在布里斯班南岸经营一家多品牌服装精品店。这段更关注商业的早期经历，发生在爱丁堡的学习让我转向科学研究之前。',
    ),
  },
];

export const news = [
  {
    date: '2026-08-13',
    title: bilingual('AutoDesign is on arXiv, with open-source code and a project website.', 'AutoDesign 已上线 arXiv，并公开源代码与项目主页。'),
    url: 'https://arxiv.org/abs/2608.13560',
  },
  {
    date: '2026-02-10',
    title: bilingual('Next-Gen CAPTCHAs announced: cognitive-gap defenses for GUI agents.', 'Next-Gen CAPTCHAs 发布：利用认知差异构建 GUI 智能体防御。'),
    url: 'https://arxiv.org/abs/2602.09012',
  },
  {
    date: '2025-09-18',
    title: bilingual('Open CaptchaWorld accepted at NeurIPS 2025.', 'Open CaptchaWorld 被 NeurIPS 2025 接收。'),
    url: 'https://github.com/MetaAgentX/OpenCaptchaWorld',
  },
];

export const links = {
  scholar: 'https://scholar.google.com/citations?user=tEaSCzYAAAAJ&hl=en',
  github: 'https://github.com/Yaxin9Luo',
  email: 'mailto:Yaxin.Luo@mbzuai.ac.ae',
  linkedin: 'https://www.linkedin.com/in/yaxin-luo-a76037219',
  twitter: 'https://twitter.com/YaxinLuo999999',
  cv: '/files/CV_YaxinLuo.pdf',
  cvZh: '/files/CV_YaxinLuo_zh.pdf',
};

export const cvForLanguage = (lang = 'en') => lang === 'zh' ? links.cvZh : links.cv;
export const openSource = openSourceSnapshot;
