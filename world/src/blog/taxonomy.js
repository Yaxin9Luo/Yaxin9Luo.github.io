// Shared vocabulary for blog posts: types, tags and the papers / projects a post can be about.
// Front matter only ever holds the keys below; labels come from here, so the EN and 中 views agree.
import {publications} from '../content.js';

export const TYPES = {
  essay: {en: 'Essay', zh: '长文'},
  note: {en: 'Note', zh: '笔记'},
  explainer: {en: 'Explainer', zh: '解读'},
  log: {en: 'Log', zh: '日志'},
};

export const TAGS = {
  harness: {en: 'Harness', zh: 'Harness'},
  agents: {en: 'Agents', zh: '智能体'},
  evaluation: {en: 'Evaluation', zh: '评测'},
  rl: {en: 'RL', zh: '强化学习'},
  sft: {en: 'SFT', zh: 'SFT'},
  design: {en: 'Design', zh: '设计'},
  multimodal: {en: 'Multimodal', zh: '多模态'},
  reading: {en: 'Reading', zh: '读论文'},
  tools: {en: 'Tools', zh: '工具'},
  'research-life': {en: 'Research life', zh: '研究日常'},
};

// The three phases of the homepage research map. A post's phase comes only from the work it is about.
export const PHASES = {
  multimodal: {n: '01', years: '2024–25', en: 'Multimodal', zh: '多模态'},
  eval: {n: '02', years: '2025–26', en: 'Eval', zh: '评测'},
  'post-training': {n: '03', years: '2026 →', en: 'Post-training', zh: '后训练'},
};
export const OFF_MAP = {n: '—', en: 'Off the map', zh: '地图之外'};

// Nodes on the homepage research map (same ids as content.js / exhibition-content.js), with their phase.
const MAP = {
  apl: 'multimodal', 'gamma-mod': 'multimodal', dvin: 'multimodal',
  opencaptchaworld: 'eval', figmirror: 'eval', 'nextgen-captchas': 'eval',
  autodesign: 'post-training', 'longcat-2.5': 'post-training',
};
const EXTRA = {
  figmirror: {title: {en: 'FigMirror: Reference-Driven Scientific Figure Agent', zh: 'FigMirror：参考图驱动的科研绘图智能体'}, short: 'FigMirror', venue: 'open source', year: 2026, href: '/#project/figmirror', links: [{label: 'code', url: 'https://github.com/VILA-Lab/FigMirror'}]},
  'longcat-2.5': {title: {en: 'LongCat-2.5 post-training (Meituan)', zh: 'LongCat-2.5 后训练（美团）'}, short: 'LongCat-2.5', venue: 'Meituan', year: 2026, href: '/#section/research', links: []},
};

const shortName = title => title.en.split(/[:：]/)[0].trim();
/** Every id a post may list under `work`, with what the end panel and the homepage need to show it. */
export const WORKS = Object.fromEntries([
  ...publications.map(p => [p.id, {
    id: p.id, title: p.title, short: shortName(p.title), venue: p.venue, year: p.year, href: `/#paper/${p.id}`,
    links: p.links.filter(l => /^(Paper|Code)$/.test(l.label.en)).map(l => ({label: l.label.en.toLowerCase(), url: l.url})),
  }]),
  ...Object.entries(EXTRA).map(([id, w]) => [id, {id, ...w}]),
].map(([id, w]) => [id, {...w, phase: MAP[id] || null}]));

/** The phase a post sits in: the latest phase among its works that are on the map, or null (off the map). */
export function phaseOf(work = []) {
  const order = Object.keys(PHASES);
  const found = work.map(id => WORKS[id]?.phase).filter(Boolean).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return found.at(-1) || null;
}
