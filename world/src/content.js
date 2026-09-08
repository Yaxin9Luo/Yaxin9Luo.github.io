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
  affiliation: bilingual('MBZUAI · VILA Lab', 'MBZUAI · VILA 实验室'),
  bio: bilingual(
    'I am a Machine Learning PhD student at MBZUAI, advised by Prof. Zhiqiang Shen. I build native multimodal AI systems that unify understanding, reasoning, generation, and sustained execution over complex tasks. My current focus is production-grade multimodal agentic design and automated iteration of long-horizon agent harnesses. At Meituan M17 LongCat, I connect execution, tool use, rollout traces, evaluation, and harness optimization to produce trajectories for subsequent model training. Welcome to my little world of ideas.',
    '我是罗亚鑫，在 MBZUAI 攻读机器学习博士，导师是 Zhiqiang Shen 教授。我研究统一理解、推理、生成与长程复杂任务执行的原生多模态 AI 系统，近期聚焦生产力级多模态智能体设计（multimodal agentic design）与长程 Agent Harness 的自动迭代。在美团 M17 龙猫实习期间，我将任务执行、工具调用、rollout 轨迹、评测与 Harness 优化连接起来，为后续模型训练准备轨迹。欢迎来到这个由想法构成的小小世界。',
  ),
  portrait: '/images/Yaxin.JPG',
};

export const research = [
  {
    id: 'multimodal-agents',
    title: bilingual(
      'Native Multimodal Systems',
      '原生多模态系统',
    ),
    description: bilingual(
      'I aim to build native multimodal AI systems that unify understanding, reasoning, generation, and sustained execution over complex tasks. My near-term focus is production-grade models for multimodal agentic design, with structured, editable outputs and long-horizon interaction.',
      '我希望构建统一理解、推理、生成与长程复杂任务执行的原生多模态 AI 系统，近期聚焦能够完成生产力级多模态设计任务的模型，让智能体通过长程交互产出结构化、可编辑的成果。',
    ),
  },
  {
    id: 'recursive-improvement',
    title: bilingual(
      'Agent Harnesses & Self-improvement',
      'Agent Harness 与自我改进',
    ),
    description: bilingual(
      'I research automated iteration of the harnesses around long-horizon agents. At a fixed model capability boundary, rollout evidence, evaluator feedback, component-level updates, and acceptance gates improve reusable infrastructure. Execution traces also provide a systems foundation for subsequent model training and model-and-harness iteration.',
      '我研究长程智能体外围 Harness 的自动迭代：在固定模型能力边界下，利用 rollout 证据、评测反馈、单组件更新与接受门控，改进可复用的智能体基础设施；同时积累可复现轨迹，为后续模型训练与模型—Harness 协同迭代提供系统基础。',
    ),
  },
  {
    id: 'agentic-design',
    title: bilingual('Long-Horizon Agentic Design', '长程智能体设计'),
    description: bilingual(
      'AutoDesign turns papers into editable posters, slides, webpages, and captioned videos using a model-agnostic DesignHarness. An inner Designer–Critic loop refines artifacts while outer Meta-Harness Optimization improves reusable infrastructure. FigMirror applies reference-driven, multi-round refinement to scientific figures and editable Matplotlib code.',
      'AutoDesign 通过模型无关的 DesignHarness，将论文转化为可编辑海报、幻灯片、网页与带字幕视频；内层 Designer–Critic 迭代产物，外层 Meta-Harness Optimization 改进可复用系统。FigMirror 则将参考图驱动的多轮 refinement 用于科研绘图与可编辑 Matplotlib 代码。',
    ),
  },
  {
    id: 'efficient-vision',
    title: bilingual('Efficient Vision and Language', '高效视觉与语言学习'),
    description: bilingual(
      'My earlier work studies visual grounding and efficient multimodal learning: anchor-based prompts in APL, dynamic visual routing in DViN, and mixture-of-depth adaptation in γ-MoD. Collaborative work also explores dynamic pyramid networks and speculative diffusion decoding with DARTree.',
      '早期工作围绕视觉定位与高效多模态学习展开，包括 APL 的锚点提示、DViN 的动态视觉路由与 γ-MoD 的混合深度适配。合作研究还涉及动态金字塔网络与 DARTree 的扩散推测解码。',
    ),
  },
  {
    id: 'evaluation-reliability',
    title: bilingual('Agent Evaluation and Reliable Knowledge', '智能体评估与可靠知识'),
    description: bilingual(
      'Open CaptchaWorld examines the abilities and limits of multimodal agents in interactive web tasks. Next-Gen CAPTCHAs studies defenses grounded in human–agent cognitive differences. DRAG explores evidence and knowledge-graph distillation for smaller language models.',
      'Open CaptchaWorld 通过交互式网页任务考察多模态智能体的能力与局限。Next-Gen CAPTCHAs 研究基于人与智能体认知差异的防御机制。DRAG 则探索面向小型语言模型的证据与知识图谱蒸馏。',
    ),
  },
  {
    id: 'data-and-transfer',
    title: bilingual('Training Data and Cross-Modal Transfer', '训练数据与跨模态迁移'),
    description: bilingual(
      'Related work investigates language-pretraining priors for vision, the domain composition of LLM training data in LLMSurgeon, and compact training sets through FADRM and committee voting. These projects ask how models can learn effectively from the information already available.',
      '相关工作研究语言预训练先验向视觉任务的迁移、LLMSurgeon 中的大模型训练数据领域配比，以及 FADRM 和委员会投票中的紧凑训练集。这些项目共同关注：如何让模型更有效地利用已有信息。',
    ),
  },
];

export const publications = [
  {
    id: 'dartree',
    title: bilingual('DARTree: Speculative Diffusion Decoding with Autoregressive Draft Trees', 'DARTree：使用自回归草稿树的扩散推测解码'),
    venue: 'arXiv', year: 2026,
    authors: 'Tianyi Li, Yaxin Luo, Xinyi Shang, Zhiqiang Shen',
    summary: bilingual(
      'A training-free method that combines diffusion drafting with autoregressive correction over candidate trees for efficient language-model inference.',
      '将扩散草稿生成与候选树上的自回归校正结合，用于高效语言模型推理，无需额外训练。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2608.13524')],
  },
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
    id: 'detail-targeting',
    title: bilingual('Pushing the Frontier of Black-Box LVLM Attacks via Fine-Grained Detail Targeting', '通过细粒度细节研究黑盒视觉语言模型的鲁棒性边界'),
    venue: 'arXiv', year: 2026,
    authors: 'Xiaohan Zhao, Zhaoyi Li, Yaxin Luo, Jiacheng Cui, Zhiqiang Shen',
    summary: bilingual(
      'Collaborative research on the robustness of large vision-language models, examining their sensitivity to fine-grained visual detail under black-box evaluation.',
      '围绕大视觉语言模型鲁棒性的合作研究，考察模型在黑盒评估中对细粒度视觉信息的敏感性。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2602.17645')],
  },
  {
    id: 'dynamic-pyramid',
    title: bilingual('Dynamic Pyramid Network for Efficient Multimodal Large Language Model', '用于高效多模态大语言模型的动态金字塔网络'),
    venue: 'arXiv', year: 2025,
    authors: 'Hao Ai, Kunyi Wang, Zezhou Wang, Hao Lu, Jin Tian, Yaxin Luo, Peng Xing, Jen-Yuan Huang, Huaxia Li, Gen Luo',
    summary: bilingual(
      'Explores dynamic pyramid representations for efficient multimodal large language models, adapting visual processing to reduce unnecessary computation.',
      '研究面向高效多模态大语言模型的动态金字塔表征，通过自适应视觉处理减少不必要的计算。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2503.20322')],
  },
  {
    id: 'autodesign',
    title: bilingual('AutoDesign: Meta-Harness Optimization for Long-Horizon Agentic Design', 'AutoDesign：面向长程智能体设计的 Meta-Harness 优化'),
    venue: 'arXiv', year: 2026,
    authors: 'Yaxin Luo*, Haobin Jiang*, Jialv Zou, Xu Huang, Wenhao Yan, Haodong Li, Zhengrong Yue, Jing Li, Xiaofu Chen, Xiaohan Zhao, Jiacheng Liu, Jiacheng Cui, Zhiqiang Shen, Xiaotong Li',
    summary: bilingual(
      'Meta-Harness Optimization improves a reusable DesignHarness through rollout evidence, evaluation, and acceptance gates. On the 100-paper PosterBench, the reported best score is 78.32, 7.45 points above Claude Design under the matched configuration; gains across seven matched configurations range from 5.01 to 19.56 points.',
      'Meta-Harness Optimization 通过 rollout 证据、评测与接受门控改进可复用的 DesignHarness。在 100 篇论文的 PosterBench 上，公开结果最高为 78.32 分，较同配置 Claude Design 高 7.45 分；7 组匹配配置的增益为 5.01–19.56 分。',
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
    id: 'llmsurgeon',
    title: bilingual('LLMSurgeon: Diagnosing Data Mixture of Large Language Models', 'LLMSurgeon：诊断大语言模型的训练数据配比'),
    venue: 'ACL', year: 2026,
    authors: 'Yaxin Luo*, Jiacheng Cui*, Xiaohan Zhao, Xinyi Shang, Jiacheng Liu, Xinyue Bi, Zhaoyi Li, Zhiqiang Shen',
    summary: bilingual(
      'Studies how generated text can help estimate an LLM’s pretraining-domain mixture under a predefined taxonomy and label-shift assumption. LLMSurgeon formulates a calibrated inverse problem and introduces the LLMScan evaluation suite.',
      '研究在预定义领域分类与标签偏移假设下，如何利用生成文本估计大模型预训练数据的领域配比。LLMSurgeon 将其建模为校准后的逆问题，并提出 LLMScan 评估套件。',
    ),
    image: '',
    links: [paper('https://aclanthology.org/2026.acl-long.1964/'), code('https://github.com/Yaxin9Luo/LLMSurgeon')],
  },
  {
    id: 'language-bias',
    title: bilingual('Language-Pretraining-Induced Bias: A Strong Foundation for General Vision Tasks', '语言预训练诱导的偏置：通用视觉任务的有力基础'),
    venue: 'TMLR', year: 2026,
    authors: 'Yaxin Luo, Zhiqiang Shen',
    summary: bilingual(
      'Random-label bridge training adapts language-pretrained parameters to vision without manual labels during the bridge stage. The reported language-induced prior accelerates convergence and improves CIFAR-100 test accuracy by 2.4 percentage points.',
      '通过无需人工标注的随机标签桥接训练，将语言预训练参数适配到视觉任务。论文报告语言诱导偏置可加速视觉任务收敛，并在 CIFAR-100 上带来 2.4 个百分点的测试准确率提升。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2604.01833'), { label: bilingual('OpenReview', '评审与论文'), url: 'https://openreview.net/forum?id=N7DSUbnzYo' }],
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
    id: 'fadrm',
    title: bilingual('FADRM: Fast and Accurate Data Residual Matching for Dataset Distillation', 'FADRM：用于数据集蒸馏的快速、准确的数据残差匹配'),
    venue: 'NeurIPS', year: 2025,
    authors: 'Jiacheng Cui, Xinyue Bi, Yaxin Luo, Xiaohan Zhao, Jiacheng Liu, Zhiqiang Shen',
    summary: bilingual(
      'Brings residual connections into dataset distillation at the data level. Data residual matching balances optimized synthetic information with useful structure from original data to build compact training sets efficiently.',
      '将残差连接的思想引入数据集蒸馏的数据层面。数据残差匹配平衡合成数据优化与原始数据中的有效结构，以更高效地构建紧凑训练集。',
    ),
    image: '',
    links: [paper('https://papers.neurips.cc/paper_files/paper/2025/hash/5a733c79d35a9738dd52a22610baa2d0-Abstract-Conference.html'), code('https://github.com/Jiacheng8/FADRM')],
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
    id: 'committee-voting',
    title: bilingual('Dataset Distillation via Committee Voting', '通过委员会投票进行数据集蒸馏'),
    venue: 'arXiv', year: 2025,
    authors: 'Jiacheng Cui, Zhaoyi Li, Xiaochen Ma, Xinyue Bi, Yaxin Luo, Zhiqiang Shen',
    summary: bilingual(
      'Combines predictions from a committee of models to create compact distilled datasets and soft labels. The approach studies how model diversity can reduce individual-model bias and improve generalization.',
      '汇集多个模型组成的委员会的预测，构建紧凑的蒸馏数据集与软标签，研究如何利用模型多样性减轻单一模型的偏差并改善泛化。',
    ),
    image: '',
    links: [paper('https://arxiv.org/abs/2501.07575'), code('https://github.com/Jiacheng8/CV-DD')],
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

export const experience = [
  {
    id: 'longcat-intern',
    role: bilingual('Research Intern', '研究实习生'),
    organization: bilingual(
      'Meituan · M17 LongCat',
      '美团 · M17 龙猫',
    ),
    period: bilingual('Apr 2026 – Present · Beijing, China', '2026 年 4 月至今 · 中国北京'),
    description: bilingual(
      'Researching agent harnesses for long-horizon multimodal design, connecting execution, tool use, trace capture, automated evaluation, and iterative optimization into a reproducible pipeline for subsequent model training. Investigating harness self-evolution through rollout evidence and component-level updates at a fixed model boundary. AutoDesign is Phase I of this long-term project, connecting design agents, reusable DesignHarnesses, evaluation protocols, and real deliverables.',
      '面向多模态长程设计任务研究 Agent Harness，将任务执行、工具调用、轨迹记录、自动评测与迭代优化组织为可复现链路，为后续模型训练准备轨迹。在固定模型能力边界下，利用 rollout 证据和单组件更新探索 Harness 自进化。以 AutoDesign 作为长期项目第一阶段，连接设计智能体、可复用 DesignHarness、评测协议与真实交付物。',
    ),
  },
  {
    id: 'mbzuai-ra',
    role: bilingual('Research Assistant', '研究助理'),
    organization: bilingual('MBZUAI · VILA Lab', 'MBZUAI · VILA 实验室'),
    period: bilingual('Jan 2025 – Aug 2025 · Abu Dhabi, UAE', '2025 年 1 月至 8 月 · 阿联酋阿布扎比'),
    description: bilingual(
      'Advised by Prof. Zhiqiang Shen. Studied transfer of language-pretrained parameters to vision using label-free random-label bridge training, published at TMLR 2026. Built Open CaptchaWorld, an interactive multimodal browser-agent benchmark with 20 categories and 225 dynamic CAPTCHAs, accepted at NeurIPS 2025.',
      '由 Zhiqiang Shen 教授指导，研究语言预训练参数向纯视觉任务的迁移，提出无需人工标注的随机标签桥接训练，相关工作发表于 TMLR 2026。构建 Open CaptchaWorld 多模态浏览器智能体交互基准，覆盖 20 类、225 个动态 CAPTCHA，被 NeurIPS 2025 接收。',
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
    description: bilingual('Advised by Prof. Zhiqiang Shen. Exploring native multimodal foundation models, agentic systems, and recursive self-improvement.', '导师为 Zhiqiang Shen 教授，探索原生多模态基础模型、智能体系统与递归式自我改进。'),
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
