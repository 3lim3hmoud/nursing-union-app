/* ========================= القيادات، اللجان، الأعضاء ========================= */
function byCreated(list){ return [...list].sort((a,b)=>(Number(a.createdAt)||0)-(Number(b.createdAt)||0)); }
function ldAvatar(name, photo, cls){
  return `<div class="${cls}" style="${esc(avStyle(name, photo))}">${avInner(name, photo)}</div>`;
}
function stripQuotes(t){ return String(t||'').replace(/^[\s"“”«»]+|[\s"“”«»]+$/g,''); }

function switchLead(which){
  document.querySelectorAll('.lead-tab').forEach(t=>t.classList.toggle('active', t.dataset.lt===which));
  const wrap = document.getElementById('leadContent');

  /* ----- اللجان ----- */
  if(which==='committees'){
    const list = byCreated(STATE.committees);
    if(!list.length){ wrap.innerHTML = '<div class="empty-note">لسه مفيش لجان مضافة</div>'; return; }
    wrap.innerHTML = `<div class="ld-grid">${list.map(c=>`
      <div class="ld-com">
        ${ldAvatar(c.head, c.photoURL, 'ld-com-av')}
        <div class="ld-com-info">
          <b>${esc(c.name)}</b>
          <span>رئيس اللجنة</span>
          <em>${esc(c.head)}</em>
        </div>
      </div>`).join('')}</div>`;
    return;
  }

  /* ----- الهيكل التنظيمي ----- */
  if(which==='members'){
    const L = STATE.leadership;
    const node = (name, photo, label, cls)=>
      `<div class="org-node ${cls||''}">${ldAvatar(name||label, photo, 'org-av')}<b>${esc(name||'—')}</b><span>${esc(label)}</span></div>`;
    const coms = byCreated(STATE.committees);
    const comsHtml = coms.length
      ? `<div class="org-committees-row">${coms.map(c=>node(c.head, c.photoURL, c.name, 'committee')).join('')}</div>`
      : '<div class="empty-note">لسه مفيش لجان مضافة</div>';
    const mem = byCreated(STATE.members);
    const memHtml = mem.length ? `
      <div class="section-title" style="margin-top:22px;">أعضاء الاتحاد</div>
      <div class="ld-members">${mem.map(m=>`
        <div class="ld-mem">${ldAvatar(m.name, m.photoURL, 'ld-mem-av')}<b>${esc(m.name)}</b><span>${esc(m.role||'')}</span></div>`).join('')}</div>` : '';
    wrap.innerHTML = `
      <div class="org-chart">
        <div class="org-top-row">
          ${node(L.presidentName, L.presidentPhoto, 'رئيس الاتحاد', 'president')}
          ${node(L.vpName, L.vpPhoto, 'نائب رئيس الاتحاد', 'vp')}
        </div>
        <div class="org-bus"></div>
        ${comsHtml}
      </div>
      ${memHtml}`;
    return;
  }

  /* ----- العميدة / الوكيلة ----- */
  const p = which==='dean' ? STATE.dean : STATE.viceDean;
  const quote = stripQuotes(p.quote);
  wrap.innerHTML = `
    <div class="ld-hero">
      <div class="ld-ring">${ldAvatar(p.name, p.photoURL, 'ld-photo')}</div>
      <b>${esc(p.name)}</b>
      <span class="ld-role">${esc(p.role)}</span>
    </div>
    ${p.bio ? `<div class="ld-card"><h4>نبذة</h4><p>${esc(p.bio)}</p></div>` : ''}
    ${quote ? `<div class="ld-quote"><i>“</i><p>${esc(quote)}</p></div>` : ''}
  `;
}

/* ========================= المجلات ========================= */
let magFilter='scientific';
function renderMagTabs(){
  const wrap = document.getElementById('magFilterTabs');
  wrap.innerHTML = `
    <div class="pill-tab ${magFilter==='scientific'?'active':''}" data-m="scientific">المجلة العلمية</div>
    <div class="pill-tab ${magFilter==='cultural'?'active':''}" data-m="cultural">المجلة الثقافية</div>
  `;
  wrap.querySelectorAll('.pill-tab').forEach(t=>t.addEventListener('click',()=>{magFilter=t.dataset.m; renderMagTabs(); renderMags();}));
}
function renderMags(){
  const wrap = document.getElementById('magList');
  wrap.innerHTML='';
  const list = STATE.magazines.filter(m=>m.type===magFilter);
  if(!list.length){wrap.appendChild(el('<div class="empty-note">لا توجد مقالات هنا حالياً</div>'));return;}
  list.forEach(m=>{
    wrap.appendChild(el(`
      <div class="card mag-card">
        <div class="mag-cover" style="${m.photoURL ? esc("background:url('"+cssUrl(m.photoURL)+"') center/cover no-repeat") : 'background:linear-gradient(160deg, '+(magFilter==='scientific'?'#4d8dff':'#b27cff')+', #0d1836)'}">
          ${m.photoURL ? '' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>'}
        </div>
        <div class="mag-body">
          <b>${esc(m.title)}</b>
          <div class="meta">📅 ${esc(m.date)}</div>
          <p>${esc(m.desc)}</p>
        </div>
      </div>
    `));
  });
}

/* ========================= حملات التوعية ========================= */
let campFilter='current';
function renderCampTabs(){
  const wrap = document.getElementById('campFilterTabs');
  wrap.innerHTML = `
    <div class="pill-tab ${campFilter==='current'?'active':''}" data-cp="current">الحالية</div>
    <div class="pill-tab ${campFilter==='upcoming'?'active':''}" data-cp="upcoming">القادمة</div>
    <div class="pill-tab ${campFilter==='past'?'active':''}" data-cp="past">السابقة</div>
  `;
  wrap.querySelectorAll('.pill-tab').forEach(t=>t.addEventListener('click',()=>{campFilter=t.dataset.cp; renderCampTabs(); renderCamps();}));
}
function renderCamps(){
  const wrap = document.getElementById('campList');
  wrap.innerHTML='';
  const list = STATE.campaigns.filter(c=>c.status===campFilter);
  if(!list.length){wrap.appendChild(el('<div class="empty-note">لا توجد حملات هنا حالياً</div>'));return;}
  list.forEach(c=>{
    const imgs = mediaList(c);
    const bg = imgs.length ? photoBg(imgs[0],.35) : 'background:linear-gradient(135deg, '+c.color1+', '+c.color2+')';
    const node = el(`
      <div class="campaign-banner ${imgs.length?'has-photo':''}" style="${bg}">
        <span class="cat-tag">${esc(c.cat)}</span>
        <b>${esc(c.title)}</b>
        <p>${esc(c.desc)}</p>
        <div class="meta">📅 ${esc(c.date)} &nbsp;·&nbsp; 📍 ${esc(c.place)}</div>
        ${galleryHtml(imgs,'gal-strip')}
      </div>
    `);
    bindGallery(node, imgs, c.title);
    wrap.appendChild(node);
  });
}

