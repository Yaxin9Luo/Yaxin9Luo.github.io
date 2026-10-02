import {Marked} from 'marked';
import markedFootnote from 'marked-footnote';

const escapeHtml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Heading ids keep CJK characters so Chinese headings get readable anchors too.
export function slugify(text){
  return String(text).toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'')||'section';
}

export const hasMath=body=>/\$\$[\s\S]+?\$\$|\$(?=\S)[^$\n]*?\S\$/.test(body.replace(/```[\s\S]*?```|`[^`\n]*`/g,''));

// `katex` is optional so pages without math never download it.
export function createMarkdown({katex}={}){
  const tex=(source,displayMode)=>katex
    ?katex.renderToString(source,{displayMode,throwOnError:false,output:'htmlAndMathml'})
    :`<code class="math-fallback">${escapeHtml(source)}</code>`;
  const marked=new Marked();
  marked.use(markedFootnote({description:'Footnotes'}));
  marked.use({extensions:[
    {name:'mathBlock',level:'block',
      start:src=>src.match(/^\$\$/m)?.index,
      tokenizer(src){const m=src.match(/^\$\$\s*\n?([\s\S]+?)\n?\s*\$\$[ \t]*(?:\n+|$)/);if(m)return {type:'mathBlock',raw:m[0],text:m[1].trim()};},
      renderer:token=>`<div class="math-block">${tex(token.text,true)}</div>\n`},
    {name:'mathInline',level:'inline',
      start:src=>src.indexOf('$')>=0?src.indexOf('$'):undefined,
      tokenizer(src){const m=src.match(/^\$(?!\$)(?=\S)((?:\\.|[^\\\n$])*?\S)\$(?!\d)/);if(m)return {type:'mathInline',raw:m[0],text:m[1]};},
      renderer:token=>tex(token.text,false)},
  ]});
  marked.use({renderer:{
    // A paragraph holding a single titled image becomes a figure with a caption.
    paragraph(token){
      const only=token.tokens?.filter(t=>!(t.type==='text'&&!t.text.trim()));
      if(only?.length===1&&only[0].type==='image'){
        const img=only[0];
        return `<figure class="post-figure"><img src="${escapeHtml(img.href)}" alt="${escapeHtml(img.text)}" loading="lazy" decoding="async"/>${img.title?`<figcaption>${escapeHtml(img.title)}</figcaption>`:''}</figure>\n`;
      }
      return false;
    },
    code(token){
      if(token.lang==='chart')return `<div class="chart-slot" data-chart="${escapeHtml(token.text)}"></div>\n`;
      return false;
    },
  }});
  return marked;
}
