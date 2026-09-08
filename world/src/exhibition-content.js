import {publications} from './content.js';

const bi=(en,zh)=>({en,zh});
export const projectIds=['autodesign','opencaptchaworld','nextgen-captchas','gamma-mod','apl','dvin','llmsurgeon'];
const sourceRoot='https://github.com/Yaxin9Luo/AutoDesign/blob/bd635851ef8a2ae257e2bf4c8cd4e984ea3fff1e/';
const autoMedia=(file,title,caption,kind='output',path='demo')=>({
  src:`/media/exhibitions/autodesign-${file}.webp`,title,caption,kind,
  source:`${sourceRoot}assets/readme/${path}/${file}.webp`,sourceLabel:bi('AutoDesign · public repository','AutoDesign · 公开仓库'),
});
const details={
  autodesign:{shortTitle:bi('AutoDesign','AutoDesign'),category:bi('Agentic design','智能体设计'),
    question:bi('How can a design agent improve the reusable system around it, beyond revising one artifact?','设计智能体如何超越单次改稿，改进可以重复使用的设计系统？'),
    approach:bi('A meta-harness optimizer uses rollout feedback to revise the design harness around a fixed model. PosterBench evaluates academic-paper-to-poster generation.','Meta-Harness 优化器利用 rollout 反馈改进固定模型周围的设计 Harness。PosterBench 评估从学术论文到海报的生成。'),
    output:bi('Editable academic posters are the evaluated output. The public repository also presents pilot slide decks, webpages and videos; these formats are not validated by PosterBench.','可编辑学术海报是已评估的产物。公开仓库还展示幻灯片、网页和视频的试点案例；这些形式不属于 PosterBench 的验证范围。'),
    media:[
      autoMedia('poster-autodesign',bi('AutoDesign for AutoDesign','AutoDesign 为自己制作的海报'),bi('An actual academic poster generated from the AutoDesign paper, published as Figure 2 and in the project repository.','依据 AutoDesign 论文生成的真实学术海报，公开于论文图 2 与项目仓库。')),
      autoMedia('poster-underwater-sam-claude',bi('Paper → academic poster','论文 → 学术海报'),bi('A public AutoDesign output for the Underwater SAM paper. This is a design-system example; the underlying underwater-vision research belongs to its listed authors.','AutoDesign 为 Underwater SAM 论文制作的公开海报。这是设计系统的产物示例，原始水下视觉研究属于海报所列作者。')),
      autoMedia('slides-autodesign-formal-academic',bi('A conference talk, in slides','会议报告幻灯片'),bi('Selected slides from the public 24-slide AutoDesign talk. A pilot output in another medium, not an additional PosterBench result.','公开的 24 页 AutoDesign 会议报告中的部分页面。这是另一种媒介的试点产物，不是额外的 PosterBench 评测结果。')),
      autoMedia('webpage-autodesign',bi('A paper as a webpage','论文变成网页'),bi('Preview of the public research webpage generated from the AutoDesign paper. The editable artifact is linked from the source repository.','依据 AutoDesign 论文生成的公开研究网页预览。来源仓库提供可编辑的网页产物。')),
      autoMedia('qualitative-trajectory',bi('From draft to revision','从草稿到修订'),bi('The paper’s selected attempts from one poster-generation trajectory. This figure documents the revision process.','论文展示的一次海报生成轨迹中的若干尝试。这张图记录的是修订过程。'),'process','research'),
    ],
  },
  opencaptchaworld:{shortTitle:bi('Open CaptchaWorld','Open CaptchaWorld'),category:bi('Interactive evaluation','交互式评估'),question:bi('What do multimodal agents miss when understanding must lead to an action?','当理解必须转化为行动时，多模态智能体还缺少哪些能力？'),approach:bi('Web-based CAPTCHA-style tasks combine perception, reasoning and interaction in one benchmark.','通过网页验证码式任务，在同一个评测平台上结合感知、推理与交互。'),output:bi('A public web benchmark and interactive environments, with the paper and implementation available from the original sources.','公开的网页评测平台与交互环境，论文和实现均提供原始来源链接。')},
  'nextgen-captchas':{shortTitle:bi('Next-Gen CAPTCHAs','Next-Gen CAPTCHAs'),category:bi('GUI-agent defense','GUI 智能体防御'),question:bi('Where does the cognitive gap between people and GUI agents remain useful for defense?','人与 GUI 智能体之间的哪些认知差异仍有助于构建防御？'),approach:bi('Dynamic interactive tasks examine perception, memory, decision-making and action.','用动态交互任务研究感知、记忆、决策和行动。'),output:bi('An interactive defense framework, its paper and public source code.','一套交互式防御框架，以及论文与公开源代码。')},
  'gamma-mod':{shortTitle:bi('γ-MoD','γ-MoD'),category:bi('Efficient multimodal models','高效多模态模型'),question:bi('Can a multimodal model decide which computation each token needs?','多模态模型能否选择每个 token 真正需要的计算？'),approach:bi('Attention-map rank, shared vision–language routing and masked routing learning adapt dense models to selective depth.','通过注意力图的秩、视觉语言共享路由与掩码路由学习，把稠密模型适配为选择性深度计算。'),output:bi('A mixture-of-depth adaptation method and an open implementation.','混合深度适配方法与开源实现。')},
  apl:{shortTitle:bi('APL','APL'),category:bi('Visual grounding','视觉定位'),question:bi('How can referring expressions locate objects without instance-level grounding labels?','没有实例级定位标签时，如何通过指代表达定位目标？'),approach:bi('Position, color and category prompts enrich anchor features, with text reconstruction and visual alignment objectives.','用位置、颜色与类别提示增强锚点特征，并结合文本重建与视觉对齐目标。'),output:bi('An anchor-based prompt-learning method for weakly supervised referring expression comprehension.','面向弱监督指代表达理解的锚点提示学习方法。')},
  dvin:{shortTitle:bi('DViN','DViN'),category:bi('Dynamic visual routing','动态视觉路由'),question:bi('How can multiple visual encoders be combined for fine-grained grounding?','如何组合多个视觉编码器以实现细粒度视觉定位？'),approach:bi('Sparse dynamic routing combines visual encoders and aligns visual features with language under weak supervision.','通过稀疏动态路由组合视觉编码器，并在弱监督条件下对齐视觉特征与语言。'),output:bi('A dynamic visual routing network, with a CVPR paper and public code.','动态视觉路由网络，以及 CVPR 论文和公开代码。')},
  llmsurgeon:{shortTitle:bi('LLMSurgeon','LLMSurgeon'),category:bi('Training-data diagnosis','训练数据诊断'),question:bi('What can generated text reveal about a model’s pretraining-domain mixture?','生成文本能揭示多少模型预训练数据的领域配比信息？'),approach:bi('A calibrated inverse problem estimates the mixture under a predefined domain taxonomy and label-shift assumption.','在预定义领域分类与标签偏移假设下，通过校准后的逆问题估计数据配比。'),output:bi('The LLMSurgeon method and LLMScan evaluation suite. The source paper provides the full evidence and limitations.','LLMSurgeon 方法与 LLMScan 评估套件。完整证据与限制见来源论文。')},
};

/** This is an authorship label, never a claim of project leadership. */
export function publicationRole(paper){
  if(paper.authors.includes('Yaxin Luo*'))return bi('Co-first author','共同一作');
  return paper.authors.startsWith('Yaxin Luo,')?bi('First author','第一作者'):bi('Co-author','共同作者');
}
export const selectedProjects=projectIds.map(id=>{
  const paper=publications.find(p=>p.id===id),detail=details[id];
  const method=paper.image?{src:paper.image,title:bi('Research overview','研究概览'),caption:bi(`${detail.shortTitle.en} — the original research figure from this portfolio’s source collection.`,`本网站原始资料中 ${detail.shortTitle.zh} 对应的研究图。`),kind:'method',source:paper.links[0].url,sourceLabel:bi('Original paper','原始论文')}:null;
  return {...paper,...detail,role:publicationRole(paper),media:[...(detail.media||[]),...(method?[method]:[])]};
});
export const getProject=id=>selectedProjects.find(project=>project.id===id)||null;
export const getProjectMedia=(id,index=0)=>{const p=getProject(id);return p?.media[Math.max(0,Math.min(p.media.length-1,Number(index)||0))]||null;};
