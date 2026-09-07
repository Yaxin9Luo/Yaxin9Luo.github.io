import { profile, research, publications, experience, journey, news, links } from './content.js';

const escape = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const local = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
const copy = (lang, en, zh) => lang === 'zh' ? zh : en;
const safeURL = (url) => /^(https?:\/\/|mailto:|\/(?!\/))/.test(String(url)) ? url : '#';

function icon(name) {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
    book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1ZM12 6v14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8ZM14 3v5h5M8 12h8M8 16h6"/>',
    orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><path d="m8 2 1 3m6 14 1 3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6ZM12 1v2M12 21v2M1 12h2M21 12h2"/>',
    spark: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>',
  };
  return `<svg class="journal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

function anchor(url, label, className = 'journal-link', symbol = 'external') {
  const destination = safeURL(url);
  const external = destination !== '#' && !destination.startsWith('mailto:');
  return `<a class="${escape(className)}" href="${escape(destination)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(label)}${icon(symbol)}</a>`;
}

function sectionButton(section, label, className = 'journal-button') {
  return `<button type="button" class="${escape(className)}" data-action="section" data-id="${escape(section)}">${escape(label)}${icon('arrow')}</button>`;
}

function head(eyebrow, title, description, lang) {
  return `<header class="journal-heading"><p class="journal-eyebrow">${escape(eyebrow)}</p><h2>${escape(title)}</h2>${description ? `<p class="journal-intro">${escape(description)}</p>` : ''}</header>`;
}

function sourceLinks(item, lang) {
  return `<div class="paper-links">${item.links.map((link) => anchor(link.url, local(link.label, lang), 'paper-link')).join('')}</div>`;
}

function venue(item) {
  return `<span class="paper-venue${item.venue === 'arXiv' ? ' paper-venue-preprint' : ''}">${escape(item.venue)} <span>${escape(item.year)}</span></span>`;
}

function authorList(item, lang) {
  return `<details class="paper-authors"><summary>${escape(copy(lang, 'Authors', '作者'))}<span aria-hidden="true">+</span></summary><p>${escape(item.authors).replace(/Yaxin Luo/g, '<strong>Yaxin Luo</strong>')}</p></details>`;
}

function timeline(items, lang, full = false) {
  return `<ol class="journal-timeline${full ? ' journal-timeline-full' : ''}">${items.map((item) => `<li class="journal-timeline-item"><div class="journal-timeline-marker" aria-hidden="true"></div><p class="journal-date">${escape(local(item.period, lang))}</p><h3>${escape(local(item.role, lang))}</h3><p class="journal-organization">${escape(local(item.organization, lang))}</p><p class="journal-description">${escape(local(item.description, lang))}</p></li>`).join('')}</ol>`;
}

function primaryLinks(lang) {
  return `<div class="journal-actions">${anchor(links.cv, copy(lang, 'Read my CV', '阅读简历'), 'journal-button journal-button-primary', 'file')}${anchor(links.scholar, 'Google Scholar', 'journal-button journal-button-outline', 'book')}${anchor(links.github, 'GitHub', 'journal-button journal-button-outline')}</div>`;
}

function about(lang) {
  return `<section class="journal-profile">
    <div class="journal-profile-main"><p class="journal-eyebrow">${escape(copy(lang, 'A RESEARCHER’S NOTEBOOK', '研究者的笔记'))}</p><h2 class="journal-name">${escape(local(profile.name, lang))}<span class="journal-name-dot" aria-hidden="true">.</span></h2><p class="journal-role">${escape(local(profile.role, lang))}</p><p class="journal-affiliation">${escape(local(profile.affiliation, lang))}</p><div class="journal-profile-rule" aria-hidden="true"></div><p class="journal-profile-tagline">${escape(copy(lang, 'Understanding. Creating. Learning to improve.', '理解世界，创造作品，在探索中持续进步。'))}</p></div>
    <figure class="journal-portrait"><img src="${escape(profile.portrait)}" alt="${escape(local(profile.name, lang))}" width="180" height="226"><figcaption>${escape(copy(lang, 'Curiosity, across disciplines.', '好奇心，不分学科。'))}</figcaption></figure>
  </section>
  ${primaryLinks(lang)}
  <section class="journal-section journal-bio"><p>${escape(local(profile.bio, lang))}</p></section>
  <section class="journal-section"><div class="journal-section-top"><div><p class="journal-eyebrow">${escape(copy(lang, 'WHAT I AM EXPLORING', '我正在探索'))}</p><h2>${escape(copy(lang, 'Two connected questions', '两个相互连接的问题'))}</h2></div>${sectionButton('research', copy(lang, 'Research directions', '研究方向'), 'journal-text-button')}</div><div class="journal-highlights">${research.slice(0, 2).map((item, index) => `<article class="journal-highlight"><span class="journal-highlight-symbol" aria-hidden="true">${icon(index === 0 ? 'orbit' : 'spark')}</span><h3>${escape(local(item.title, lang))}</h3><p>${escape(local(item.description, lang))}</p></article>`).join('')}</div></section>
  <section class="journal-section"><div class="journal-section-top"><div><p class="journal-eyebrow">${escape(copy(lang, 'RESEARCH & SERVICE', '研究与服务'))}</p><h2>${escape(copy(lang, 'Experience', '经历'))}</h2></div>${sectionButton('journey', copy(lang, 'Education & my story', '教育与我的故事'), 'journal-text-button')}</div>${timeline(experience, lang)}</section>
  <section class="journal-section"><div class="journal-section-top"><div><p class="journal-eyebrow">${escape(copy(lang, 'FROM THE NOTEBOOK', '笔记更新'))}</p><h2>${escape(copy(lang, 'Recent notes', '近期动态'))}</h2></div></div><ol class="journal-news">${news.map((item) => `<li><time datetime="${escape(item.date)}">${escape(item.date)}</time>${anchor(item.url, local(item.title, lang), 'journal-news-link')}</li>`).join('')}</ol></section>
  <div class="journal-next"><div><span class="journal-eyebrow">${escape(copy(lang, 'CONTINUE READING', '继续阅读'))}</span><p>${escape(copy(lang, 'Ideas take shape in papers and projects.', '在论文与项目中，认识这些想法。'))}</p></div>${sectionButton('publications', copy(lang, 'Browse publications', '浏览论文'))}</div>`;
}

function publicationView(lang) {
  const years = [...new Set(publications.map((item) => item.year))].sort((a, b) => b - a);
  return `${head(copy(lang, 'THE RESEARCH COLLECTION', '研究作品集'), copy(lang, 'Publications', '论文'), copy(lang, 'Papers on multimodal agents, efficient learning, and the information that shapes intelligent systems.', '关于多模态智能体、高效学习，以及塑造智能系统的信息的研究论文。'), lang)}
  <div class="journal-reading-tools"><p class="journal-caption">${escape(copy(lang, `${publications.length} works in this collection · * Equal contribution`, `本作品集收录 ${publications.length} 项研究 · * 表示共同一作`))}</p>${anchor(links.scholar, copy(lang, 'View Google Scholar', '查看 Google Scholar'), 'journal-text-link')}</div>
  ${years.map((year) => `<section class="journal-section paper-year-section"><div class="paper-year-heading"><h3>${year}</h3><span aria-hidden="true"></span></div><div class="paper-list">${publications.filter((item) => item.year === year).map((item) => `<article class="paper-entry${item.image ? ' paper-entry-illustrated' : ''}" id="paper-${escape(item.id)}">${item.image ? `<figure class="paper-thumbnail"><img src="${escape(item.image)}" alt="${escape(copy(lang, `${local(item.title, lang)} — project figure`, `${local(item.title, lang)}——项目配图`))}" loading="lazy" decoding="async"></figure>` : ''}<div class="paper-body">${venue(item)}<h3>${escape(local(item.title, lang))}</h3>${lang === 'zh' ? `<p class="paper-original-title" lang="en">${escape(item.title.en)}</p>` : ''}<p class="paper-summary">${escape(local(item.summary, lang))}</p>${authorList(item, lang)}${sourceLinks(item, lang)}</div></article>`).join('')}</div></section>`).join('')}
  <div class="journal-next"><div><p>${escape(copy(lang, 'Want to see the work in action?', '想看看研究如何变成可用的作品？'))}</p></div>${sectionButton('projects', copy(lang, 'Explore projects', '探索项目'))}</div>`;
}

function projectView(lang) {
  const selectedIDs = ['autodesign', 'opencaptchaworld', 'nextgen-captchas', 'gamma-mod', 'apl', 'dvin', 'llmsurgeon'];
  const selected = selectedIDs.map((id) => publications.find((item) => item.id === id)).filter(Boolean);
  const labels = {
    autodesign: { en: 'Agentic design', zh: '智能体设计' },
    opencaptchaworld: { en: 'Interactive evaluation', zh: '交互式评估' },
    'nextgen-captchas': { en: 'GUI-agent defense', zh: 'GUI 智能体防御' },
    'gamma-mod': { en: 'Efficient multimodal models', zh: '高效多模态模型' },
    apl: { en: 'Visual grounding', zh: '视觉定位' },
    dvin: { en: 'Dynamic visual routing', zh: '动态视觉路由' },
    llmsurgeon: { en: 'Training-data diagnosis', zh: '训练数据诊断' },
  };
  return `${head(copy(lang, 'FROM QUESTIONS TO SYSTEMS', '从问题到系统'), copy(lang, 'Selected projects', '精选项目'), copy(lang, 'Open the papers, inspect the code, and follow the projects beyond this world.', '阅读论文、查看代码，沿着项目链接继续探索。'), lang)}
  <div class="folio-grid">${selected.map((item, index) => `<article class="folio-project${index === 0 ? ' folio-project-featured' : ''}">${item.image ? `<figure class="folio-image"><img src="${escape(item.image)}" alt="${escape(local(item.title, lang))}" loading="lazy" decoding="async"></figure>` : ''}<div class="folio-body"><div class="folio-meta"><span class="journal-eyebrow">${escape(local(labels[item.id], lang))}</span>${venue(item)}</div><h3>${escape(item.id === 'language-bias' ? local(item.title, lang) : local(item.title, lang).split(/[:：]/)[0])}</h3><p>${escape(local(item.summary, lang))}</p>${sourceLinks(item, lang)}</div></article>`).join('')}</div>
  <div class="journal-next"><div><p>${escape(copy(lang, 'More research and open-source work.', '更多研究与开源作品。'))}</p></div>${anchor(links.github, copy(lang, 'Visit GitHub', '前往 GitHub'), 'journal-button journal-button-primary')}</div>`;
}

function researchView(lang) {
  return `${head(copy(lang, 'AT THE EDGE OF WHAT WE KNOW', '在已知与未知之间'), copy(lang, 'Research directions', '研究方向'), copy(lang, 'I am interested in systems that can perceive, create, reason, act, and improve through experience.', '我关注能够感知、创造、推理、行动，并通过经验持续改进的系统。'), lang)}
  <div class="journal-research-opening"><span aria-hidden="true">${icon('orbit')}</span><p>${escape(copy(lang, 'A model’s intelligence and the infrastructure around it form one evolving research space.', '模型的智能，与它周围的基础设施，共同构成一片持续演化的研究空间。'))}</p></div>
  <div class="journal-research-list">${research.map((item, index) => `<article class="journal-research-item"><span class="journal-research-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><p class="journal-eyebrow">${escape(index < 3 ? copy(lang, 'CURRENT DIRECTION', '当前方向') : copy(lang, 'CONNECTED WORK', '相关研究'))}</p><h3>${escape(local(item.title, lang))}</h3><p>${escape(local(item.description, lang))}</p></div></article>`).join('')}</div>
  <div class="journal-next"><div><p>${escape(copy(lang, 'Follow these questions into the published work.', '从这些问题出发，继续阅读相关论文。'))}</p></div>${sectionButton('publications', copy(lang, 'Read publications', '阅读论文'))}</div>`;
}

function journeyView(lang) {
  return `${head(copy(lang, 'A PATH WITH MANY TURNS', '一条不断转弯的路'), copy(lang, 'The journey so far', '一路走来的故事'), copy(lang, 'From an early chapter in Brisbane, through mathematics in Edinburgh and engineering in Denmark, to machine learning research in Abu Dhabi.', '从布里斯班的早期经历，到爱丁堡的数学、丹麦的工程，再到阿布扎比的机器学习研究。'), lang)}
  <div class="journal-journey-note">${icon('compass')}<p>${escape(copy(lang, 'Curiosity has been the thread. Each change of direction helped shape the researcher I am becoming.', '贯穿其中的，是好奇心。每一次转向，都在塑造我正在成为的研究者。'))}</p></div>
  ${timeline(journey, lang, true)}
  <section class="journal-section"><div class="journal-section-top"><div><p class="journal-eyebrow">${escape(copy(lang, 'ALONG THE WAY', '沿途的经历'))}</p><h2>${escape(copy(lang, 'Research & service', '研究与服务'))}</h2></div></div>${timeline(experience, lang)}</section>
  <div class="journal-next"><div><p>${escape(copy(lang, 'The formal version, all in one place.', '正式简历，完整呈现。'))}</p></div>${anchor(links.cv, copy(lang, 'Open CV · PDF', '打开简历 · PDF'), 'journal-button journal-button-primary', 'file')}</div>`;
}

function contactView(lang) {
  const contacts = [
    { title: 'Google Scholar', detail: copy(lang, 'Publications and research profile', '论文与学术主页'), url: links.scholar, symbol: 'book' },
    { title: 'GitHub', detail: copy(lang, 'Code, projects, and ongoing work', '代码、项目与持续探索'), url: links.github, symbol: 'spark' },
    { title: 'LinkedIn', detail: copy(lang, 'Professional connections', '职业联系'), url: links.linkedin, symbol: 'external' },
    { title: 'X / Twitter', detail: copy(lang, 'Notes and updates', '随想与近况'), url: links.twitter, symbol: 'external' },
  ];
  return `${head(copy(lang, 'THE START OF A CONVERSATION', '一段交流的开始'), copy(lang, 'Let’s connect', '保持联系'), copy(lang, 'For research conversations and questions about the work, you can find me here.', '如果想交流研究，或讨论这些工作，欢迎通过下面的方式联系我。'), lang)}
  <section class="journal-contact-letter"><div class="journal-letter-mark" aria-hidden="true">${icon('mail')}</div><p class="journal-eyebrow">${escape(copy(lang, 'WRITE TO ME', '写一封信'))}</p><h3>${escape(local(profile.name, lang))}</h3><p>${escape(local(profile.role, lang))}<br>${escape(local(profile.affiliation, lang))}</p>${anchor(links.email, links.email.replace(/^mailto:/, ''), 'journal-email', 'arrow')}<span class="journal-letter-seal" aria-hidden="true">YL</span></section>
  <div class="journal-contact-grid">${contacts.map((item) => `<a class="journal-contact-card" href="${escape(safeURL(item.url))}" target="_blank" rel="noopener noreferrer"><span class="journal-contact-symbol" aria-hidden="true">${icon(item.symbol)}</span><div><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p></div>${icon('external')}</a>`).join('')}</div>
  <div class="journal-cv-note"><div>${icon('file')}<div><h3>${escape(copy(lang, 'Curriculum vitae', '个人简历'))}</h3><p>${escape(copy(lang, 'Education, research, and experience in a downloadable PDF.', '可下载的 PDF，包含教育、研究与工作经历。'))}</p></div></div>${anchor(links.cv, copy(lang, 'Open CV', '打开简历'), 'journal-button journal-button-primary', 'arrow')}</div>`;
}

/** Return a complete readable section. Navigation and travel are delegated to the shell. */
export function renderJournal(section, lang = 'en', progress = {}) {
  const language = lang === 'zh' ? 'zh' : 'en';
  const renderers = { about, publications: publicationView, projects: projectView, research: researchView, journey: journeyView, contact: contactView };
  const current = Object.hasOwn(renderers, section) ? section : 'about';
  return `<div class="journal-page journal-page-${current}" lang="${language === 'zh' ? 'zh-CN' : 'en'}">${renderers[current](language)}<footer class="journal-footer"><span>${escape(copy(language, 'Yaxin Luo · Research notebook', 'Yaxin Luo · 研究笔记'))}</span><button type="button" class="journal-travel" data-action="travel" data-id="${current}">${escape(copy(language, 'Visit this place in the world', '前往世界中的这个地点'))}${icon('compass')}</button></footer></div>`;
}
