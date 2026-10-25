/* ========================= الحساب الشخصي ========================= */
function renderProfile(){
  const loggedIn = !!STUDENT.uid;
  document.getElementById('profileLoggedIn').style.display = loggedIn ? 'block' : 'none';
  document.getElementById('profileLoggedOut').style.display = loggedIn ? 'none' : 'block';
  document.getElementById('smName').textContent = loggedIn ? STUDENT.name : 'زائر';
  document.getElementById('smLevel').textContent = loggedIn ? STUDENT.level : 'سجّل دخولك من صفحة حسابي';
  if(loggedIn) setAvatarEl(document.getElementById('smAvatar'), STUDENT.name, STUDENT.photoURL, STUDENT.avatarInitial);
  else { const sa=document.getElementById('smAvatar'); sa.textContent='؟'; sa.classList.remove('has-photo'); sa.style.background='linear-gradient(135deg,var(--gold),#173a86)'; }
  if(!loggedIn) return;

  setAvatarEl(document.getElementById('profAvatar'), STUDENT.name, STUDENT.photoURL, STUDENT.avatarInitial);
  const pb = document.getElementById('profBio'); pb.textContent = STUDENT.bio || ''; pb.style.display = STUDENT.bio ? '' : 'none';
  document.getElementById('profName').textContent = STUDENT.name;
  document.getElementById('profRole').textContent = STUDENT.level;
  document.getElementById('profId').textContent = 'ID: ' + (STUDENT.studentId || '—');
  document.getElementById('chipPoints').textContent = STUDENT.points;
  document.getElementById('chipRank').textContent = '#'+STUDENT.rank;
  document.getElementById('chipEvents').textContent = STUDENT.events;
  document.getElementById('statComp').textContent = STUDENT.competitions;
  document.getElementById('statCamp').textContent = STUDENT.campaigns;
  document.getElementById('statVol').textContent = STUDENT.workshops;
  document.getElementById('statActive').textContent = STUDENT.activeLevel;

  const badges = [
    {icon:'🏅', label:'طالب نشط'},
    {icon:'🏆', label:'بطل مسابقة'},
    {icon:'🤝', label:'متطوع'},
    {icon:'⭐', label:'طالب الأسبوع'},
  ];
  const wrap = document.getElementById('achievCard');
  wrap.innerHTML='';
  badges.forEach(b=>{
    wrap.appendChild(el(`
      <div style="flex:1;min-width:70px;text-align:center;padding:10px 4px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);">
        <div style="font-size:22px;">${b.icon}</div>
        <div style="font-size:9.5px;color:var(--muted);margin-top:4px;">${b.label}</div>
      </div>
    `));
  });
}

/* ========================= الترتيب ========================= */
let rankFilter='week';
function renderRankTabs(){
  const wrap = document.getElementById('rankFilterTabs');
  wrap.innerHTML = `
    <div class="pill-tab ${rankFilter==='week'?'active':''}" data-r="week">هذا الأسبوع</div>
    <div class="pill-tab ${rankFilter==='month'?'active':''}" data-r="month">هذا الشهر</div>
    <div class="pill-tab ${rankFilter==='all'?'active':''}" data-r="all">كل الأوقات</div>
  `;
  wrap.querySelectorAll('.pill-tab').forEach(t=>t.addEventListener('click',()=>{rankFilter=t.dataset.r; renderRankTabs(); renderRanking();}));
}
function renderRanking(){
  const sorted = [...STATE.leaderboard].sort((a,b)=>b.points-a.points);
  const podium = document.getElementById('podium');
  const listCard = document.getElementById('rankListCard');
  if(!sorted.length){
    podium.innerHTML='';
    listCard.innerHTML = '<div class="empty-note">لسه مفيش طلاب في الترتيب</div>';
    return;
  }
  const [p1,p2,p3] = sorted;
  podium.innerHTML = `
    ${p2?`<div class="pod silver"><div class="rank-avatar" style="background:${avatarGradient(p2.name)}">${esc((p2.name||'?')[0])}</div><b>${esc(p2.name)}</b><div class="pts">${p2.points} نقطة</div></div>`:''}
    <div class="pod gold"><div class="crown">👑</div><div class="rank-avatar" style="background:${avatarGradient(p1.name)}">${esc((p1.name||'?')[0])}</div><b>${esc(p1.name)}</b><div class="pts">${p1.points} نقطة</div></div>
    ${p3?`<div class="pod bronze"><div class="rank-avatar" style="background:${avatarGradient(p3.name)}">${esc((p3.name||'?')[0])}</div><b>${esc(p3.name)}</b><div class="pts">${p3.points} نقطة</div></div>`:''}
  `;
  listCard.innerHTML='';
  sorted.forEach((s,i)=>{
    const isMe = s.name===STUDENT.name;
    listCard.appendChild(el(`
      <div class="rank-list-row ${isMe?'me':''}">
        <div class="rank-num">${i+1}</div>
        <div class="r-avatar" style="background:${avatarGradient(s.name)}">${esc((s.name||'?')[0])}</div>
        <div class="rname">${esc(s.name)}${isMe?' (أنت)':''}</div>
        <div class="rpts">${s.points} نقطة</div>
      </div>
    `));
  });
}

