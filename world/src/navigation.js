// Camera and tour choices are shared by the visible controls and simulation.
export const cameraViews={
  follow:{elevation:.30,distance:17,label:{en:'Follow',zh:'跟随'}},
  overlook:{elevation:1.18,distance:49,label:{en:'Bird’s eye',zh:'鸟瞰'}},
  low:{elevation:-.19,distance:19,label:{en:'Look up',zh:'仰视'}},
};

export const tourStops=[
  {id:'about',position:[54,52,62],title:{en:'Hello, I’m Yaxin.',zh:'你好，我是 Yaxin。'},description:{en:'A PhD student at MBZUAI. I work on multimodal design, multimodal agentic design, and recursive self-improvement.',zh:'我在 MBZUAI 攻读博士，研究多模态设计、多模态智能体设计与递归式自我改进。'}},
  {id:'publications',position:[-49,25,48],title:{en:'From ideas to papers.',zh:'从想法到论文。'},description:{en:'Explore work on agentic design, visual grounding, efficient multimodal learning, and evaluation.',zh:'这里收录了智能体设计、视觉定位、高效多模态学习和评估等方向的论文。'}},
  {id:'projects',position:[88,26,78],title:{en:'Things I’m building.',zh:'我在做的项目。'},description:{en:'AutoDesign explores how an agent can improve its own design harness through rollout feedback. Visit the atelier for this and other projects.',zh:'AutoDesign 探索智能体如何依据 rollout 反馈改进自己的设计 Harness。工坊中还有其他项目可以了解。'}},
  {id:'research',position:[-55,34,-40],title:{en:'A few open questions.',zh:'一些正在探索的问题。'},description:{en:'Understanding, generation, reasoning, planning, and action: how can a multimodal agent bring them together?',zh:'理解、生成、推理、规划与行动：多模态智能体如何将这些能力联系起来？'}},
  {id:'journey',position:[-18,22,98],title:{en:'The path so far.',zh:'一路走来。'},description:{en:'Education, research experiences, and the people and places that shaped my work.',zh:'我的求学经历、研究经历，以及一路上塑造研究方向的人与地方。'}},
  {id:'contact',position:[108,33,-30],title:{en:'Let’s keep in touch.',zh:'保持联系。'},description:{en:'Find my email, Google Scholar, GitHub, and CV. You can always switch to the traditional website.',zh:'这里有邮箱、Google Scholar、GitHub 和简历。你也可以随时切换至传统主页。'}},
];
