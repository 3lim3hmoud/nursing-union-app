/* يحوّل الرابط لشكل آمن جوه url('...') في CSS */
function cssUrl(u){ return String(u||'').replace(/['"()\\\s]/g, c=>'%'+c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')); }

/* صورة الغلاف + المعرض (أكتر من صورة جنب بعض) لأي عنصر: فعالية / حملة */
function mediaList(o){
  const l = []; if(o && o.photoURL) l.push(o.photoURL);
  ((o && o.images) || []).forEach(u=>{ if(u && !l.includes(u)) l.push(u); });
  return l;
}
/* خلفية صورة باينة مع تدرج خفيف عشان النص يفضل مقروء (زي كروت الأخبار) */
function photoBg(url, top){
  return esc("background:linear-gradient(180deg,rgba(8,20,50,"+(top==null?.18:top)+"),rgba(8,20,50,.85)),url('"+cssUrl(cld(url,'c_fill,w_900,h_600,q_auto,f_auto'))+"') center/cover no-repeat");
}
function galleryHtml(list, cls){
  if(!list || list.length<2) return '';
  return '<div class="'+(cls||'nr-gal')+'">'+list.map((u,i)=>`<img src="${esc(cld(u,'c_fill,w_300,h_220,q_auto,f_auto'))}" alt="" data-i="${i}" loading="lazy">`).join('')+'</div>';
}
function bindGallery(root, list, title){
  if(!root) return;
  root.querySelectorAll('.nr-gal img, .gal-strip img').forEach(im=>im.addEventListener('click', ev=>{
    ev.stopPropagation();
    openLightboxList(list.map(u=>({type:'image',url:u,title:title||'',album:''})), Number(im.dataset.i));
  }));
}
/* اسم مرتب: أول اسمين، والإنجليزي بحروف عادية (مش ALL CAPS) */
function niceName(n){
  const parts = String(n||'').trim().split(/\s+/).slice(0,2);
  return parts.map(w=>/^[A-Za-z]+$/.test(w) ? w.charAt(0).toUpperCase()+w.slice(1).toLowerCase() : w).join(' ');
}
/* ========================= الصفحة الرئيسية ========================= */
function renderHome(){
  setAvatarEl(document.getElementById('homeAvatar'), STUDENT.uid ? STUDENT.name : 'guest', STUDENT.uid ? STUDENT.photoURL : '', STUDENT.avatarInitial);
  const hr = new Date().getHours();
  const greet = hr<12 ? 'صباح الخير' : 'مساء الخير';
  document.getElementById('homeGreetTime').textContent = `${greet} 👋`;
  document.getElementById('homeGreeting').textContent = STUDENT.uid ? niceName(STUDENT.name) : 'يا صديق الاتحاد';
  const NE = homeNextEvent();
  document.getElementById('nextEventName').textContent = NE.name;
  document.getElementById('nextEventMeta').textContent = NE.place;
  document.getElementById('eventStrip').style.backgroundImage =
    `linear-gradient(180deg, rgba(6,16,40,.45), rgba(4,10,28,.90)), url('${cssUrl(cld(NE.image,'c_fill,w_900,h_700,q_auto,f_auto'))}')`;
  ensureMyRegs();

  setAvatarEl(document.getElementById('sowAvatar'), STATE.studentOfWeek.name, STATE.studentOfWeek.photoURL, STATE.studentOfWeek.initial);
  document.getElementById('sowName').textContent = STATE.studentOfWeek.name;
  document.getElementById('sowLevel').textContent = STATE.studentOfWeek.level;
  document.getElementById('sowPoints').textContent = STATE.studentOfWeek.points;

  const scroll = document.getElementById('homeEventsScroll');
  scroll.innerHTML='';
  /* القادمة الأول (الأقرب موعداً)، وبعدها اللي من غير ميعاد، وبعدها المنتهية */
  const upc = STATE.activities.filter(x=>actStart(x) && !actIsPast(x)).sort((x,y)=>actStart(x)-actStart(y));
  const nod = STATE.activities.filter(x=>!actStart(x));
  const pst = STATE.activities.filter(x=>actStart(x) && actIsPast(x)).sort((x,y)=>actStart(y)-actStart(x));
  [...upc, ...nod, ...pst].slice(0,6).forEach(a=>{
    const c = CATS[a.cat]||CATS.scientific;
    const card = el(`
      <div class="mini-event">
        <div class="mini-thumb ${a.photoURL?'has-photo':''}" style="${a.photoURL ? photoBg(a.photoURL,.05) : 'background:linear-gradient(135deg, '+c.color+', #0d1836)'}">
          <span class="chip" style="background:rgba(255,255,255,.92)">${esc(c.label)}</span>
        </div>
        <div class="body">
          <b>${esc(a.title)}</b>
          <div class="meta">📅 ${esc(a.date)}</div>
        </div>
      </div>
    `);
    card.style.cursor = 'pointer';
    card.addEventListener('click', ()=>openActivityModal(a.id));
    scroll.appendChild(card);
  });
  if(!STATE.activities.length) scroll.appendChild(el('<div class="empty-note">لسه مفيش فعاليات مضافة</div>'));

  const cp = document.getElementById('homeCampaignPreview');
  cp.innerHTML='';
  /* أحدث حملة حالية (أو أحدث حملة لو مفيش حالية) */
  const campPick = STATE.campaigns.filter(c=>c.status==='current').concat(STATE.campaigns.filter(c=>c.status!=='current')).slice(0,1);
  campPick.forEach(c=>{
    const imgs = mediaList(c);
    const bg = imgs.length ? photoBg(imgs[0],.28) : 'background:linear-gradient(135deg, '+c.color1+', '+c.color2+')';
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
    cp.appendChild(node);
  });
}

/* ========================= كاروسيل الصور والفيديوهات ========================= */
let mcIndex=0, mcTimer=null;
function iconFor(type){
  return type==='video'
    ? '<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/>'
    : '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>';
}
let MC_SLIDES = [];
let mcBound = false;
function renderMediaCarousel(){
  const track = document.getElementById('mcTrack');
  const dots = document.getElementById('mcDots');
  track.innerHTML=''; dots.innerHTML='';
  const items = STATE.media.slice(0,6);
  MC_SLIDES = items.length ? items : [MEDIA_ITEMS[0]];
  MC_SLIDES.forEach((m,i)=>{
    const real = !!m.id;
    let mediaHtml='';
    if(real){
      const th = mediaThumb(m);
      mediaHtml = th ? `<img src="${esc(cld(th,'c_fill,w_800,h_450,q_auto,f_auto'))}" alt="${esc(m.title||m.album||'')}">`
                     : `<div class="mc-fallback" style="background:linear-gradient(135deg,#2159c9,#0f2a66)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${iconFor(m.type)}</svg></div>`;
    } else if(m.src && m.type==='image') mediaHtml = `<img src="${esc(m.src)}" alt="${esc(m.title)}">`;
    else mediaHtml = `<div class="mc-fallback" style="background:linear-gradient(135deg, ${m.color1}, ${m.color2})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${iconFor(m.type)}</svg></div>`;
    const tag = real ? (m.album || (m.type==='video'?'فيديو':'صورة')) : m.tag;
    const title = real ? (m.title || m.album || '') : m.title;
    const sub = real ? (m.type==='video' ? 'اضغط للمشاهدة' : 'اضغط للتكبير') : m.sub;
    const slide = el(`
      <div class="mc-slide">
        ${mediaHtml}
        <div class="mc-shade"></div>
        ${m.type==='video' ? '<div class="mc-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : ''}
        <div class="mc-caption">
          <span class="mc-tag">${esc(tag)}</span>
          <b>${esc(title)}</b>
          <span>${esc(sub)}</span>
        </div>
      </div>
    `);
    if(real){ slide.style.cursor='pointer'; slide.addEventListener('click', ()=>openLightbox(m.id,'home')); }
    track.appendChild(slide);
    dots.appendChild(el(`<div class="mc-dot ${i===0?'active':''}"></div>`));
  });
  const multi = MC_SLIDES.length>1;
  document.querySelectorAll('#mediaCarousel .mc-arrow').forEach(a=>a.style.display = multi?'':'none');
  dots.style.display = multi?'':'none';
  mcGo(0);
  if(!mcBound){
    mcBound = true;
    let sx=0;
    const carousel=document.getElementById('mediaCarousel');
    carousel.addEventListener('touchstart', e=>{sx=e.touches[0].clientX; clearInterval(mcTimer);});
    carousel.addEventListener('touchend', e=>{
      const dx = e.changedTouches[0].clientX - sx;
      if(Math.abs(dx)>40) mcMove(dx>0?1:-1);
      mcAutoplay();
    });
  }
  if(multi) mcAutoplay(); else clearInterval(mcTimer);
}
function mcGo(i){
  const n = MC_SLIDES.length || 1;
  mcIndex = (i+n)%n;
  document.getElementById('mcTrack').style.transform = `translateX(${mcIndex*100}%)`;
  document.querySelectorAll('.mc-dot').forEach((d,idx)=>d.classList.toggle('active', idx===mcIndex));
}
function mcMove(dir){ mcGo(mcIndex + (dir>0?-1:1)); }
function mcAutoplay(){
  clearInterval(mcTimer);
  mcTimer = setInterval(()=>mcGo(mcIndex-1), 4000);
}

let cdTimer=null;
function startCountdown(){
  clearInterval(cdTimer);
  function tick(){
    const target = new Date(homeNextEvent().date).getTime();
    const over = !(target > Date.now());
    const strip = document.getElementById('eventStrip'), box = document.getElementById('countdownBox');
    if(strip){ strip.classList.toggle('is-over', over); const jb = strip.querySelector('.btn-primary'); if(jb) jb.textContent = (over && !homeNextEvent().activityId) ? 'شوف الفعاليات' : 'انضم للفعالية'; }
    if(box) box.style.display = over ? 'none' : '';
    let note = document.getElementById('evOverNote');
    if(over && !note && box){ note = document.createElement('div'); note.id = 'evOverNote'; note.className = 'ev-over'; note.textContent = 'الحدث ده خلص — تابع الفعاليات الجاية'; box.after(note); }
    if(note) note.style.display = over ? '' : 'none';
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff/86400000);
    const h = Math.floor(diff%86400000/3600000);
    const m = Math.floor(diff%3600000/60000);
    const s = Math.floor(diff%60000/1000);
    document.getElementById('cdDays').textContent = String(d).padStart(2,'0');
    document.getElementById('cdHours').textContent = String(h).padStart(2,'0');
    document.getElementById('cdMin').textContent = String(m).padStart(2,'0');
    document.getElementById('cdSec').textContent = String(s).padStart(2,'0');
  }
  tick();
  cdTimer = setInterval(tick, 1000);
}

