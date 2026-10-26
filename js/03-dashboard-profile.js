/* ========================= لوحة التحكم: الصفحة الرئيسية للأدمن ========================= */
const ADMIN_SECTIONS = [
  {k:'activities',ic:'🗓️',t:'الفعاليات والمؤتمرات',g:'المحتوى',c:()=>STATE.activities.length},
  {k:'news',ic:'📰',t:'الأخبار',g:'المحتوى',c:()=>STATE.news.length},
  {k:'media',ic:'🖼️',t:'الميديا',g:'المحتوى',c:()=>STATE.media.length},
  {k:'polls',ic:'🗳️',t:'التصويت',g:'المحتوى',c:()=>STATE.polls.length},
  {k:'campaigns',ic:'📢',t:'حملات التوعية',g:'المحتوى',c:()=>STATE.campaigns.length},
  {k:'magazines',ic:'📖',t:'المجلات',g:'المحتوى',c:()=>STATE.magazines.length},
  {k:'students',ic:'🎓',t:'الطلاب وملفاتهم',g:'الطلاب',c:()=>ADM_STUDENTS||0},
  {k:'insights',ic:'📊',t:'التفاعل والإحصائيات',g:'الطلاب',c:null},
  {k:'rating',ic:'⚙️',t:'التقييم التلقائي',g:'الطلاب',c:null},
  {k:'sow',ic:'⭐',t:'طالب الأسبوع',g:'الطلاب',c:null},
  {k:'certificates',ic:'📜',t:'شهادات الحضور',g:'الطلاب',c:null},
  {k:'ranking',ic:'🏆',t:'ترتيب الطلاب',g:'الطلاب',c:()=>STATE.leaderboard.length},
  {k:'president',ic:'🏛️',t:'رئيس ونائب الاتحاد',g:'الاتحاد والكلية',c:null},
  {k:'members',ic:'🧑‍🤝‍🧑',t:'أعضاء الاتحاد',g:'الاتحاد والكلية',c:()=>STATE.members.length},
  {k:'committees',ic:'👥',t:'اللجان',g:'الاتحاد والكلية',c:()=>STATE.committees.length},
  {k:'dean',ic:'🎓',t:'عميدة الكلية',g:'الاتحاد والكلية',c:null},
  {k:'vice',ic:'🎓',t:'وكيلة الكلية',g:'الاتحاد والكلية',c:null},
  {k:'nextEvent',ic:'🔥',t:'الحدث القادم (يدوي)',g:'الرئيسية',c:null}
];
let ADM_STUDENTS = null, admRaf = 0;
function loadAdminStats(){
  if(!fbReady || ADM_STUDENTS!==null) return;
  ADM_STUDENTS = 0;
  db.collection('students').get().then(sn=>{ ADM_STUDENTS = sn.size; renderAdminDash(); }).catch(()=>{ ADM_STUDENTS = null; });
}
function adminDashRefresh(){
  if(admRaf) return;
  admRaf = requestAnimationFrame(()=>{ admRaf = 0; renderAdminDash(); });
}
function renderAdminDash(){
  const st = document.getElementById('admStats'), dash = document.getElementById('adminDash');
  if(!st || !dash) return;
  const upcoming = STATE.activities.filter(a=>actStart(a) && !actIsPast(a)).length;
  const live = STATE.polls.filter(p=>!pollClosed(p)).length;
  st.innerHTML = [['الطلاب', ADM_STUDENTS===null ? '—' : ADM_STUDENTS],['فعاليات قادمة',upcoming],['تصويتات جارية',live],['الأخبار',STATE.news.length]]
    .map(x=>`<div class="adm-stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
  const em = (fbReady && auth.currentUser && auth.currentUser.email) || '';
  const av = document.getElementById('admAv'); if(av) av.textContent = (em[0]||'ا').toUpperCase();
  let html = '', lastG = '';
  ADMIN_SECTIONS.forEach(x=>{
    if(x.g!==lastG){ if(lastG) html += '</div>'; html += `<div class="adm-group">${x.g}</div><div class="adm-tiles">`; lastG = x.g; }
    const n = x.c ? x.c() : null;
    html += `<button type="button" class="adm-tile" onclick="openAdminSection('${x.k}')"><div class="adm-ic">${x.ic}</div><div><b>${x.t}</b>${n!==null?`<span>${n} عنصر</span>`:'<span>تعديل</span>'}</div></button>`;
  });
  dash.innerHTML = html + '</div>';
}
function openAdminSection(key){
  const panel = document.getElementById('adminPanel');
  document.querySelectorAll('#adminSections > details.admin-box').forEach(d=>{
    const on = d.dataset.sec===key;
    d.classList.toggle('sec-active', on);
    if(on) d.open = true;
  });
  panel.classList.add('in-section');
  const t = ADMIN_SECTIONS.find(x=>x.k===key);
  document.getElementById('admBackTitle').textContent = t ? t.ic+' '+t.t : '';
  document.getElementById('pages').scrollTop = 0;
  if(typeof admOnSection==='function') admOnSection(key);
}
function closeAdminSection(){
  document.getElementById('adminPanel').classList.remove('in-section');
  document.querySelectorAll('#adminSections > details.admin-box').forEach(d=>d.classList.remove('sec-active'));
  document.getElementById('pages').scrollTop = 0;
}

/* ========================= تعديل الملف الشخصي ========================= */
let PE_REMOVE = false;
function setAvatarEl(node, name, photo, initial){
  if(!node) return;
  if(photo){
    node.style.background = 'url("'+String(photo).replace(/"/g,'%22')+'") center/cover no-repeat';
    node.textContent = ''; node.classList.add('has-photo');
  } else {
    node.style.background = avatarGradient(name||'guest');
    node.textContent = initial || '؟'; node.classList.remove('has-photo');
  }
}
function resizeImage(file, maxPx){
  return new Promise(resolve=>{
    try{
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        const r = Math.min(1, maxPx/Math.max(img.width, img.height));
        const w = Math.round(img.width*r), h = Math.round(img.height*r);
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        URL.revokeObjectURL(url);
        c.toBlob(b=>resolve(b||file),'image/jpeg',0.86);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    }catch(e){ resolve(file); }
  });
}
function openProfileEdit(){
  if(!STUDENT.uid){ showToast('سجّل دخولك الأول'); return; }
  PE_REMOVE = false;
  document.getElementById('peName').value = STUDENT.name || '';
  document.getElementById('peLevel').value = STUDENT.level && STUDENT.level!=='غير محدد' ? STUDENT.level : '';
  document.getElementById('peBio').value = STUDENT.bio || '';
  document.getElementById('peFile').value = '';
  setAvatarEl(document.getElementById('peAvatar'), STUDENT.name, STUDENT.photoURL, STUDENT.avatarInitial);
  document.getElementById('peRemove').style.display = STUDENT.photoURL ? '' : 'none';
  document.getElementById('profileEditModal').classList.add('show');
  closeMenu();
}
function closeProfileEdit(){ document.getElementById('profileEditModal').classList.remove('show'); }
function previewProfilePhoto(input){
  const f = input.files[0]; if(!f) return;
  PE_REMOVE = false;
  const r = new FileReader();
  r.onload = e=>{
    const av = document.getElementById('peAvatar');
    av.style.background = 'url("'+e.target.result+'") center/cover no-repeat';
    av.textContent=''; av.classList.add('has-photo');
    document.getElementById('peRemove').style.display='';
  };
  r.readAsDataURL(f);
}
function removeProfilePhoto(){
  PE_REMOVE = true;
  document.getElementById('peFile').value = '';
  const name = document.getElementById('peName').value.trim() || STUDENT.name;
  setAvatarEl(document.getElementById('peAvatar'), name, '', (name.trim()[0])||'؟');
  document.getElementById('peRemove').style.display='none';
}
async function saveProfileEdit(){
  if(!STUDENT.uid || !fbReady) return;
  const name = document.getElementById('peName').value.trim();
  const level = document.getElementById('peLevel').value.trim();
  const bio = document.getElementById('peBio').value.trim();
  if(!name){ showToast('اكتب اسمك'); return; }
  const btn = document.getElementById('peSave');
  btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try{
    const upd = { name, level: level || STUDENT.level || 'غير محدد', bio };
    const f = document.getElementById('peFile').files[0];
    if(f){
      const small = await resizeImage(f, 800);
      const u = await uploadImage(small,'students');
      if(!u){ btn.disabled=false; btn.textContent='حفظ'; return; }
      upd.photoURL = u;
    } else if(PE_REMOVE){ upd.photoURL = ''; }
    await db.collection('students').doc(STUDENT.uid).update(upd);
    STUDENT.name = upd.name; STUDENT.level = upd.level; STUDENT.bio = bio;
    if('photoURL' in upd) STUDENT.photoURL = upd.photoURL;
    STUDENT.avatarInitial = (STUDENT.name.trim()[0]) || '؟';
    renderHome(); renderProfile(); closeProfileEdit();
    showToast('تم حفظ التعديلات ✔');
  }catch(e){
    showToast('مقدرتش أحفظ، جرب تاني');
  }finally{
    btn.disabled = false; btn.textContent = 'حفظ';
  }
}

