/* ========================= القيادات، اللجان، الأعضاء ========================= */
function switchLead(which){
  document.querySelectorAll('.lead-tab').forEach(t=>t.classList.toggle('active', t.dataset.lt===which));
  const wrap = document.getElementById('leadContent');
  if(which==='committees'){
    if(!STATE.committees.length){ wrap.innerHTML = '<div class="empty-note">لسه مفيش لجان مضافة</div>'; return; }
    let rows='';
    STATE.committees.forEach(c=>{
      rows+=`<div class="committee-row">
        <div class="c-avatar" style="background:${avatarGradient(c.head)}">${esc((c.head||'?')[0])}</div>
        <div><div class="name">${esc(c.name)}</div><div class="role">رئيس اللجنة: ${esc(c.head)}</div></div>
      </div>`;
    });
    wrap.innerHTML = `<div class="card" style="padding:6px 14px;">${rows}</div>`;
    return;
  }
  if(which==='members'){
    const L = STATE.leadership;
    const nodeHtml = (name, photo, label, extraClass)=>{
      const ph = photo
        ? `<img src="${photo}" alt="${esc(name)}" loading="lazy" decoding="async">`
        : `<div class="ph" style="background:${avatarGradient(name||label)}">${esc((name||'؟')[0])}</div>`;
      return `<div class="org-node ${extraClass||''}">${ph}<b>${esc(name||'—')}</b><span>${esc(label)}</span></div>`;
    };
    let committeesHtml = '';
    if(!STATE.committees.length){
      committeesHtml = '<div class="empty-note">لسه مفيش لجان مضافة</div>';
    }else{
      committeesHtml = `<div class="org-committees-row">${STATE.committees.map(c=>
        nodeHtml(c.head, c.photoURL, c.name, 'committee')
      ).join('')}</div>`;
    }
    wrap.innerHTML = `
      <div class="org-chart">
        <div class="org-top-row">
          ${nodeHtml(L.presidentName, L.presidentPhoto, 'رئيس الاتحاد', 'president')}
          ${nodeHtml(L.vpName, L.vpPhoto, 'نائب رئيس الاتحاد', 'vp')}
        </div>
        <div class="org-bus"></div>
        ${committeesHtml}
      </div>
    `;
    return;
  }
  const p = which==='dean' ? STATE.dean : STATE.viceDean;
  const bigPh = p.photoURL
    ? `<img src="${p.photoURL}" alt="${esc(p.name)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : p.initial;
  wrap.innerHTML = `
    <div class="profile-hero">
      <div class="big-avatar" style="background:${avatarGradient(p.name)};overflow:hidden;">${bigPh}</div>
      <b>${esc(p.name)}</b>
      <div class="role">${esc(p.role)}</div>
    </div>
    <div class="section-title" style="margin-top:14px;">نبذة</div>
    <div class="card"><p class="bio-text" style="margin:0;">${esc(p.bio)}</p></div>
    <div class="section-title">آخر رسالة</div>
    <div class="card"><p class="bio-text" style="margin:0;">${esc(p.quote)}</p></div>
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
        <div class="mag-cover" style="background:linear-gradient(160deg, ${magFilter==='scientific'?'#4d8dff':'#b27cff'}, #0d1836)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
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
    wrap.appendChild(el(`
      <div class="campaign-banner" style="background:linear-gradient(135deg, ${c.color1}, ${c.color2})">
        <span class="cat-tag">${esc(c.cat)}</span>
        <b>${esc(c.title)}</b>
        <p>${esc(c.desc)}</p>
        <div class="meta">📅 ${esc(c.date)} &nbsp;·&nbsp; 📍 ${esc(c.place)}</div>
      </div>
    `));
  });
}

