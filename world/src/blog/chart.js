// Small SVG charts for posts, written as ```chart blocks holding JSON:
// {"type":"line"|"bar","title":"…","x":[…],"series":[{"name":"…","values":[…]}],"y":{"label":"…","unit":"%","min":0,"max":100},"caption":"…"}
// Colors are a validated categorical order on the paper surface (#f3eee1); four series at most.
export const SERIES_COLORS=['#00897b','#ad6f00','#4f5db5','#c23f52'];
const NS='http://www.w3.org/2000/svg';

export function validateSpec(spec){
  if(!spec||typeof spec!=='object')throw new Error('Chart spec must be a JSON object');
  if(!['line','bar'].includes(spec.type))throw new Error('Chart type must be "line" or "bar"');
  if(!Array.isArray(spec.x)||!spec.x.length)throw new Error('Chart needs a non-empty "x" array');
  if(!Array.isArray(spec.series)||!spec.series.length)throw new Error('Chart needs at least one series');
  if(spec.series.length>SERIES_COLORS.length)throw new Error(`Charts show at most ${SERIES_COLORS.length} series`);
  for(const s of spec.series){
    if(!s.name)throw new Error('Every series needs a name');
    if(!Array.isArray(s.values)||s.values.length!==spec.x.length)throw new Error(`Series "${s.name}" needs one value per x label`);
    if(s.values.some(v=>v!==null&&!Number.isFinite(v)))throw new Error(`Series "${s.name}" has a non-numeric value`);
  }
  return spec;
}

// Clean axis ticks: steps of 1, 2, 2.5 or 5 × 10ⁿ covering [min, max].
export function niceTicks(min,max,count=5){
  if(min===max){max=min+1;}
  const raw=(max-min)/Math.max(1,count),power=10**Math.floor(Math.log10(raw)),scaled=raw/power;
  const step=(scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10)*power;
  const start=Math.floor(min/step)*step,end=Math.ceil(max/step)*step,ticks=[];
  for(let v=start;v<=end+step/2;v+=step)ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export function formatValue(v,unit=''){
  if(v===null||v===undefined)return '—';
  const abs=Math.abs(v);
  const text=abs>=1e6?`${+(v/1e6).toFixed(1)}M`:abs>=1e4?`${+(v/1e3).toFixed(1)}K`:Number.isInteger(v)?v.toLocaleString('en-US'):(+v.toFixed(2)).toLocaleString('en-US');
  return unit==='%'?`${text}%`:unit?`${text} ${unit}`:text;
}

const el=(tag,attrs={},parent)=>{const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);parent?.append(node);return node;};
const escape=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function renderChart(slot,{lang='en',reducedMotion=false}={}){
  let spec;
  try{spec=validateSpec(JSON.parse(slot.dataset.chart));}
  catch(error){slot.className='chart-error';slot.textContent=`Chart error: ${error.message}`;return;}
  const t=(en,zh)=>lang==='zh'?zh:en;
  const unit=spec.y?.unit||'';
  const figure=document.createElement('figure');figure.className='chart-figure';
  const multi=spec.series.length>1;
  figure.innerHTML=`<header class="chart-head"><div>${spec.title?`<h4>${escape(spec.title)}</h4>`:''}${spec.y?.label?`<p>${escape(spec.y.label)}</p>`:''}</div>
    <button type="button" class="chart-table-toggle" aria-expanded="false">${t('Data','数据')}</button></header>
    ${multi?`<ul class="chart-legend">${spec.series.map((s,i)=>`<li><i style="--c:${SERIES_COLORS[i]}" class="${spec.type}"></i>${escape(s.name)}</li>`).join('')}</ul>`:''}
    <div class="chart-plot"><div class="chart-tooltip" role="status" aria-live="polite" hidden></div></div>
    <div class="chart-table" hidden><table><thead><tr><th></th>${spec.series.map(s=>`<th>${escape(s.name)}</th>`).join('')}</tr></thead><tbody>${spec.x.map((x,i)=>`<tr><th>${escape(x)}</th>${spec.series.map(s=>`<td>${formatValue(s.values[i],unit)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${spec.caption?`<figcaption>${escape(spec.caption)}</figcaption>`:''}`;
  slot.replaceWith(figure);
  const plot=figure.querySelector('.chart-plot'),tooltip=figure.querySelector('.chart-tooltip');
  const toggle=figure.querySelector('.chart-table-toggle'),table=figure.querySelector('.chart-table');
  toggle.addEventListener('click',()=>{const open=table.hidden;table.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?t('Chart','图表'):t('Data','数据');plot.hidden=open;});

  const values=spec.series.flatMap(s=>s.values).filter(v=>v!==null);
  const lo=spec.y?.min??Math.min(0,...values),hi=spec.y?.max??Math.max(...values);
  const ticks=niceTicks(lo,hi,4),y0=ticks[0],y1=ticks.at(-1);
  let svg,cleanup=()=>{};
  let animated=reducedMotion;

  function draw(){
    cleanup();svg?.remove();
    const width=Math.max(280,plot.clientWidth),narrow=width<520,height=narrow?230:290;
    const directLabels=spec.type==='line'&&!narrow&&spec.series.length<=4;
    const labelSpace=directLabels?Math.min(150,12+Math.max(...spec.series.map(s=>s.name.length))*7.2):0;
    const m={top:14,right:14+labelSpace,bottom:34,left:12+Math.max(...ticks.map(v=>formatValue(v,unit).length))*7};
    const w=width-m.left-m.right,h=height-m.top-m.bottom;
    const yScale=v=>m.top+h-(v-y0)/(y1-y0)*h;
    const n=spec.x.length;
    const band=w/n,xLine=i=>m.left+(n===1?w/2:i*(w/(n-1))),xBand=i=>m.left+band*i+band/2;
    const xAt=spec.type==='line'?xLine:xBand;
    svg=el('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img',tabindex:'0','aria-label':`${spec.title||'Chart'} — ${t('use arrow keys to inspect values','用方向键查看数值')}`});
    plot.prepend(svg);
    const grid=el('g',{class:'chart-grid'},svg);
    for(const v of ticks){
      const y=yScale(v);el('line',{x1:m.left,x2:m.left+w,y1:y,y2:y,class:v===0||v===y0?'baseline':''},grid);
      const label=el('text',{x:m.left-8,y:y+4,'text-anchor':'end'},grid);label.textContent=formatValue(v,unit);
    }
    const every=Math.ceil(n/(narrow?5:9));
    spec.x.forEach((x,i)=>{if(i%every&&i!==n-1)return;const label=el('text',{x:xAt(i),y:height-10,'text-anchor':'middle',class:'x-label'},grid);label.textContent=x;});

    const marks=el('g',{},svg);
    if(spec.type==='line'){
      spec.series.forEach((s,si)=>{
        let d='',pen=false;
        s.values.forEach((v,i)=>{if(v===null){pen=false;return;}d+=`${pen?'L':'M'}${xAt(i).toFixed(1)},${yScale(v).toFixed(1)}`;pen=true;});
        const path=el('path',{d,class:'chart-line',stroke:SERIES_COLORS[si]},marks);
        if(!animated){const len=path.getTotalLength();path.style.strokeDasharray=len;path.style.strokeDashoffset=len;path.style.setProperty('--len',len);path.classList.add('drawing');path.style.animationDelay=`${si*120}ms`;}
        if(directLabels){
          const last=s.values.findLastIndex(v=>v!==null);
          const g=el('g',{class:'direct-label'},marks);
          el('circle',{cx:xAt(last)+10,cy:yScale(s.values[last]),r:4,fill:SERIES_COLORS[si]},g);
          const label=el('text',{x:xAt(last)+19,y:yScale(s.values[last])+4},g);label.textContent=s.name;
        }
      });
      // Nudge direct labels apart when two series end close together.
      const labels=[...marks.querySelectorAll('.direct-label')].map(g=>({g,y:+g.querySelector('circle').getAttribute('cy')})).sort((a,b)=>a.y-b.y);
      for(let i=1;i<labels.length;i++)if(labels[i].y-labels[i-1].y<16){const shift=16-(labels[i].y-labels[i-1].y);labels[i].y+=shift;labels[i].g.querySelector('text').setAttribute('y',labels[i].y+4);}
    }else{
      const k=spec.series.length,gap=2,group=Math.min(band*.72,64*k),barW=Math.max(3,(group-gap*(k-1))/k);
      spec.series.forEach((s,si)=>s.values.forEach((v,i)=>{
        if(v===null)return;
        const x=m.left+band*i+(band-group)/2+si*(barW+gap),top=yScale(Math.max(v,y0)),base=yScale(Math.max(y0,0)),bh=Math.max(0,base-top),r=Math.min(4,barW/2,bh);
        const d=`M${x},${base}V${top+r}Q${x},${top} ${x+r},${top}H${x+barW-r}Q${x+barW},${top} ${x+barW},${top+r}V${base}Z`;
        const bar=el('path',{d,fill:SERIES_COLORS[si],class:'chart-bar','data-i':i,'data-s':si},marks);
        if(!animated){bar.style.transformOrigin=`0 ${base}px`;bar.classList.add('growing');bar.style.animationDelay=`${i*40+si*60}ms`;}
        if(k===1&&n<=12&&barW>=26){const label=el('text',{x:x+barW/2,y:top-6,'text-anchor':'middle',class:'bar-value'},marks);label.textContent=formatValue(v,unit);}
      }));
    }

    // Hover layer: crosshair + one tooltip for the nearest x position.
    const cross=el('line',{y1:m.top,y2:m.top+h,class:'chart-crosshair',visibility:'hidden'},svg);
    const dots=spec.type==='line'?spec.series.map((s,si)=>el('circle',{r:5,fill:SERIES_COLORS[si],class:'chart-dot',visibility:'hidden'},svg)):[];
    let active=-1;
    const show=i=>{
      active=i;const x=xAt(i);
      if(spec.type==='line'){cross.setAttribute('x1',x);cross.setAttribute('x2',x);cross.setAttribute('visibility','visible');
        dots.forEach((d,si)=>{const v=spec.series[si].values[i];if(v===null){d.setAttribute('visibility','hidden');return;}d.setAttribute('cx',x);d.setAttribute('cy',yScale(v));d.setAttribute('visibility','visible');});}
      else marks.querySelectorAll('.chart-bar').forEach(b=>b.classList.toggle('dim',+b.dataset.i!==i));
      tooltip.innerHTML=`<strong>${escape(spec.x[i])}</strong>${spec.series.map((s,si)=>`<span><i style="--c:${SERIES_COLORS[si]}"></i>${multi?`${escape(s.name)}<b>`:'<b>'}${formatValue(s.values[i],unit)}</b></span>`).join('')}`;
      tooltip.hidden=false;
      const tw=tooltip.offsetWidth,left=Math.min(Math.max(x-tw/2,0),width-tw);
      const top=spec.type==='line'?Math.min(...spec.series.map(s=>s.values[i]).filter(v=>v!==null).map(yScale)):yScale(Math.max(...spec.series.map(s=>s.values[i]??y0)));
      tooltip.style.transform=`translate(${left}px,${Math.max(0,top-tooltip.offsetHeight-14)}px)`;
    };
    const hide=()=>{active=-1;cross.setAttribute('visibility','hidden');dots.forEach(d=>d.setAttribute('visibility','hidden'));marks.querySelectorAll('.dim').forEach(b=>b.classList.remove('dim'));tooltip.hidden=true;};
    const nearest=event=>{const box=svg.getBoundingClientRect(),x=(event.clientX-box.left)*(width/box.width);let best=0;for(let i=1;i<n;i++)if(Math.abs(xAt(i)-x)<Math.abs(xAt(best)-x))best=i;return best;};
    const move=event=>{const box=svg.getBoundingClientRect(),y=(event.clientY-box.top)*(height/box.height);if(y<m.top-10||y>m.top+h+10){hide();return;}const i=nearest(event);if(i!==active)show(i);};
    const key=event=>{if(!['ArrowLeft','ArrowRight','Escape','Home','End'].includes(event.key))return;event.preventDefault();
      if(event.key==='Escape')return hide();const next=event.key==='Home'?0:event.key==='End'?n-1:Math.min(n-1,Math.max(0,(active<0?0:active)+(event.key==='ArrowRight'?1:-1)));show(next);};
    svg.addEventListener('pointermove',move);svg.addEventListener('pointerdown',move);svg.addEventListener('pointerleave',hide);svg.addEventListener('keydown',key);svg.addEventListener('blur',hide);
    cleanup=()=>{svg.removeEventListener('pointermove',move);hide();};
  }

  // Draw once the chart scrolls into view so the entrance animation is seen.
  const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();draw();animated=true;}},{threshold:.25});
  io.observe(figure);
  let lastWidth=0;
  new ResizeObserver(()=>{if(!svg||!plot.clientWidth||Math.abs(plot.clientWidth-lastWidth)<4)return;lastWidth=plot.clientWidth;draw();}).observe(plot);
}
