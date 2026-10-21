const STORE='systema2_v2_merged';
const OLD_STORE='systema2_constructor_v1';
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const todayKey=()=>new Date().toISOString().slice(0,10);
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtDate=(d,opts={day:'2-digit',month:'short'})=>new Date(d+'T12:00:00').toLocaleDateString('ru-RU',opts);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function defaultState(){return{habits:[],habitLogs:{},tasks:[],pages:[],history:[],settings:{}}}
function load(){
  try{const s=JSON.parse(localStorage.getItem(STORE));if(s)return normalize(s)}catch{}
  try{
    const old=JSON.parse(localStorage.getItem(OLD_STORE));
    if(old?.pages){
      const s=defaultState();
      s.pages=old.pages.map(p=>({...p,description:p.description||'',blocks:(p.blocks||[]).map(b=>migrateBlock(b))}));
      return normalize(s)
    }
  }catch{}
  return defaultState();
}
function migrateBlock(b){
  const map={heading:'heading',text:'text',goal:'progress',metric:'metric',checklist:'list',tasks:'linkedTasks',habit:'habit',timer:'text',chart:'metric',calendar:'deadline',image:'text'};
  const type=map[b.type]||b.type;
  if(b.type==='checklist') return{id:b.id||uid(),type:'list',size:b.size||'m',data:{title:b.data?.title||'Список',groups:[{id:uid(),title:'Раздел',items:(b.data?.items||[]).map((x,i)=>({id:uid(),title:x,done:!!b.data?.done?.[i],deadline:'',note:''}))}]}}
  if(b.type==='goal') return{id:b.id||uid(),type:'progress',size:b.size||'m',data:{title:b.data?.title||'Прогресс',auto:false,current:Number(b.data?.value)||0,target:Number(b.data?.target)||100,unit:''}}
  return{id:b.id||uid(),type,size:b.size||'m',data:b.data||{}}
}
function normalize(s){
  s.habits ||= []; s.habitLogs ||= {}; s.tasks ||= []; s.pages ||= []; s.history ||= []; s.settings ||= {};
  s.pages.forEach(p=>{p.description ||= ''; p.blocks ||= []; p.archived=!!p.archived});
  return s;
}
let state=load(), currentPageId=null, editMode=false, selectedHabitId=null, habitMode='today', plannerDate=todayKey(), calendarDate=new Date(), analyticsMode='month', analyticsDate=new Date();
function save(){localStorage.setItem(STORE,JSON.stringify(state));renderSidebar();renderOverview();renderConstructor()}
function log(msg){state.history.unshift({id:uid(),at:new Date().toISOString(),msg});state.history=state.history.slice(0,300)}
function toast(msg){const t=q('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function openModal(id){q('#'+id).classList.add('open')}
function closeModal(id){q('#'+id).classList.remove('open')}
qa('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));

const viewTitles={overview:['СЕГОДНЯ','Обзор'],habits:['ТРЕКЕР','Привычки'],planner:['ДЕНЬ','План дня'],calendar:['МЕСЯЦ','Календарь'],analytics:['ДАННЫЕ','Аналитика'],history:['ЖУРНАЛ','История'],constructor:['СВОИ СТРАНИЦЫ','Конструктор'],settings:['СИСТЕМА','Настройки']};
function showView(id){
  qa('.view').forEach(v=>v.classList.remove('active')); q('#'+id).classList.add('active');
  qa('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(viewTitles[id]){q('#eyebrow').textContent=viewTitles[id][0];q('#title').textContent=viewTitles[id][1]}
  if(id!=='customPage'){currentPageId=null;editMode=false}
  ({overview:renderOverview,habits:renderHabits,planner:renderPlanner,calendar:renderCalendar,analytics:renderAnalytics,history:renderHistory,constructor:renderConstructor,settings:renderSettings}[id]||(()=>{}))();
}
qa('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));

/* sidebar */
function renderSidebar(){
  const box=q('#sidePages');box.innerHTML='';
  state.pages.filter(p=>!p.archived).forEach(p=>{
    const b=document.createElement('button');b.className='page-link'+(p.id===currentPageId?' active':'');b.innerHTML='<span>•</span><span>'+esc(p.name)+'</span>';b.onclick=()=>openPage(p.id);box.appendChild(b)
  });
}
q('#sideAddPage').onclick=()=>openPageModal();
q('#newPageBtn').onclick=()=>openPageModal();
q('#mobileAdd').onclick=()=>openPageModal();

/* overview */
function doneHabitsToday(){const d=state.habitLogs[todayKey()]||{};return state.habits.filter(h=>habitDone(h,d[h.id])).length}
function habitDone(h,val){if(h.type==='bool')return !!val;return Number(val)>=Number(h.target||1)}
function renderOverview(){
  const od=q('#overviewDateLabel');if(od)od.textContent=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
  q('#ovPages').textContent=state.pages.filter(p=>!p.archived).length;
  q('#ovHabits').textContent=state.habits.length?doneHabitsToday()+' / '+state.habits.length:'0';
  const td=state.tasks.filter(t=>t.date===todayKey());q('#ovTasks').textContent=td.filter(t=>t.done).length+' / '+td.length;
  q('#ovDate').textContent=new Date().toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});
  const taskBox=q('#overviewTasks');taskBox.innerHTML=td.length?td.slice(0,6).map(taskRowHTML).join(''):'<div class="empty">На сегодня задач нет.</div>';
  const hb=q('#overviewHabits');hb.innerHTML=state.habits.length?state.habits.slice(0,6).map(habitMiniHTML).join(''):'<div class="empty">Добавь первую привычку.</div>';
  wireTaskChecks(taskBox);wireHabitControls(hb);
}
function habitMiniHTML(h){const val=(state.habitLogs[todayKey()]||{})[h.id];return '<div class="panel habit-card"><div class="eyebrow">ПРИВЫЧКА</div><h3>'+esc(h.name)+'</h3><p class="muted tiny">'+esc(h.unit||'')+(h.type==='number'?' · цель '+esc(h.target):'')+'</p>'+(h.type==='bool'?'<button class="habit-check '+(val?'done':'')+'" data-habit-bool="'+h.id+'">'+(val?'✓':'')+'</button>':'<div class="habit-number"><input data-habit-number="'+h.id+'" type="number" value="'+esc(val??'')+'" placeholder="0"><span>'+esc(h.unit||'')+'</span></div>')+'</div>'}

/* habits */
q('#addHabitBtn').onclick=()=>{q('#habitId').value='';q('#habitName').value='';q('#habitType').value='bool';q('#habitUnit').value='';q('#habitTarget').value='1';openModal('habitModal')};
q('#saveHabit').onclick=()=>{
  const id=q('#habitId').value,name=q('#habitName').value.trim();if(!name)return toast('Нужно название');
  if(id){const h=state.habits.find(x=>x.id===id);Object.assign(h,{name,type:q('#habitType').value,unit:q('#habitUnit').value.trim(),target:Number(q('#habitTarget').value)||1});log('Изменена привычка «'+name+'»')}
  else{state.habits.push({id:uid(),name,type:q('#habitType').value,unit:q('#habitUnit').value.trim(),target:Number(q('#habitTarget').value)||1});log('Создана привычка «'+name+'»')}
  save();closeModal('habitModal');renderHabits()
};
q('#habitType').onchange=()=>q('#habitNumberFields').style.display=q('#habitType').value==='number'?'flex':'none';
qa('[data-habit-mode]').forEach(b=>b.onclick=()=>{habitMode=b.dataset.habitMode;qa('[data-habit-mode]').forEach(x=>x.classList.toggle('active',x===b));renderHabits()});
function renderHabits(){
  if(!selectedHabitId&&state.habits[0])selectedHabitId=state.habits[0].id;
  const host=q('#habitContent');
  if(!state.habits.length){host.innerHTML='<div class="empty">Пока нет привычек. Нажми «+ Привычка».</div>';return}
  if(habitMode==='today'){
    host.innerHTML='<div class="habit-grid">'+state.habits.map(h=>'<div class="panel habit-card">'+habitMiniHTML(h).replace('class="panel habit-card"','class="habit-inner"').replace('</div>','<div class="actions" style="margin-top:12px"><button class="btn small ghost" data-edit-habit="'+h.id+'">Настроить</button></div></div>')+'</div>').join('')+'</div>';
    wireHabitControls(host);host.querySelectorAll('[data-edit-habit]').forEach(b=>b.onclick=()=>editHabit(b.dataset.editHabit));
  }else if(habitMode==='month') host.innerHTML=habitMonthHTML();
  else host.innerHTML=habitYearHTML();
}
function editHabit(id){const h=state.habits.find(x=>x.id===id);q('#habitId').value=h.id;q('#habitName').value=h.name;q('#habitType').value=h.type;q('#habitUnit').value=h.unit||'';q('#habitTarget').value=h.target||1;q('#habitNumberFields').style.display=h.type==='number'?'flex':'none';openModal('habitModal')}
function wireHabitControls(root=document){
  root.querySelectorAll('[data-habit-bool]').forEach(b=>b.onclick=()=>setHabitValue(b.dataset.habitBool,!((state.habitLogs[todayKey()]||{})[b.dataset.habitBool])));
  root.querySelectorAll('[data-habit-number]').forEach(inp=>inp.onchange=()=>setHabitValue(inp.dataset.habitNumber,Number(inp.value)||0));
}
function setHabitValue(id,val,date=todayKey()){
  state.habitLogs[date] ||= {};state.habitLogs[date][id]=val;const h=state.habits.find(x=>x.id===id);log('Привычка «'+(h?.name||'')+'»: '+(val===true?'выполнено':val));save();
  if(q('#habits').classList.contains('active'))renderHabits();if(q('#overview').classList.contains('active'))renderOverview();if(currentPageId)renderPage()
}
function habitMonthHTML(){
  const h=state.habits.find(x=>x.id===selectedHabitId)||state.habits[0];
  const now=new Date(),y=now.getFullYear(),m=now.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=(first.getDay()+6)%7;
  let cells='';for(let i=0;i<start;i++)cells+='<div class="habit-day"></div>';
  for(let d=1;d<=days;d++){const key=new Date(y,m,d,12).toISOString().slice(0,10),val=(state.habitLogs[key]||{})[h.id],done=habitDone(h,val);cells+='<div class="habit-day '+(key===todayKey()?'today ':'')+(done?'done':'')+'"><div class="num">'+d+'</div><div class="val">'+(val===true?'готово':val??'—')+'</div></div>'}
  return '<div class="panel"><div class="row"><label>Привычка<select id="habitSelect">'+state.habits.map(x=>'<option value="'+x.id+'" '+(x.id===h.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label></div><div class="month-head" style="margin-top:15px"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="habit-calendar">'+cells+'</div></div>';
}
function habitYearHTML(){
  const h=state.habits.find(x=>x.id===selectedHabitId)||state.habits[0],now=new Date(),vals=[];
  for(let i=119;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);const k=d.toISOString().slice(0,10),v=(state.habitLogs[k]||{})[h.id];vals.push(habitDone(h,v)?4:0)}
  setTimeout(()=>{const s=q('#habitSelect');if(s)s.onchange=()=>{selectedHabitId=s.value;renderHabits()}},0);
  return '<div class="panel"><label>Привычка<select id="habitSelect">'+state.habits.map(x=>'<option value="'+x.id+'" '+(x.id===h.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label><p class="muted tiny">Последние 120 дней</p><div class="heatmap">'+vals.map(v=>'<i class="heat '+(v?'l'+v:'')+'"></i>').join('')+'</div></div>'
}
document.addEventListener('change',e=>{if(e.target?.id==='habitSelect'){selectedHabitId=e.target.value;renderHabits()}});

/* planner */
q('#addTaskBtn').onclick=()=>openTaskModal();
q('#plannerPrev').onclick=()=>{plannerDate=shiftDate(plannerDate,-1);renderPlanner()};
q('#plannerNext').onclick=()=>{plannerDate=shiftDate(plannerDate,1);renderPlanner()};
q('#plannerToday').onclick=()=>{plannerDate=todayKey();renderPlanner()};
function shiftDate(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function openTaskModal(prefill={}){
  q('#taskId').value=prefill.id||'';q('#taskTitle').value=prefill.title||'';q('#taskDate').value=prefill.date||plannerDate||todayKey();q('#taskTime').value=prefill.time||'';q('#taskKind').value=prefill.kind||'none';q('#taskSource').value=prefill.source?JSON.stringify(prefill.source):'';openModal('taskModal')
}
q('#saveTask').onclick=()=>{
  const title=q('#taskTitle').value.trim();if(!title)return toast('Напиши задачу');
  const id=q('#taskId').value,source=q('#taskSource').value?JSON.parse(q('#taskSource').value):null;
  if(id){const t=state.tasks.find(x=>x.id===id);Object.assign(t,{title,date:q('#taskDate').value,time:q('#taskTime').value,kind:q('#taskKind').value});log('Изменена задача «'+title+'»')}
  else{state.tasks.push({id:uid(),title,date:q('#taskDate').value,time:q('#taskTime').value,kind:q('#taskKind').value,done:false,source});log('Добавлена задача «'+title+'»')}
  save();closeModal('taskModal');renderPlanner();if(currentPageId)renderPage()
};
function renderPlanner(){
  q('#plannerDateLabel').textContent=fmtDate(plannerDate,{weekday:'long',day:'numeric',month:'long'});
  const tasks=state.tasks.filter(t=>t.date===plannerDate),timed=tasks.filter(t=>t.time),untimed=tasks.filter(t=>!t.time);
  const hours=[...Array.from({length:18},(_,i)=>i+6),0,1,2,3,4,5];
  q('#timeline').innerHTML=hours.map(h=>{
    const hh=String(h).padStart(2,'0'),items=timed.filter(t=>Number(t.time.slice(0,2))===h).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    return '<div class="hour-row"><div class="hour-label">'+hh+':00</div><div class="hour-content">'+items.map(taskChipHTML).join('')+'</div></div>'
  }).join('');
  q('#unscheduled').innerHTML=untimed.length?untimed.map(taskRowHTML).join(''):'<div class="muted tiny">Без времени ничего нет.</div>';
  wireTaskChecks(q('#planner'));q('#planner').querySelectorAll('[data-edit-task]').forEach(b=>b.onclick=()=>openTaskModal(state.tasks.find(t=>t.id===b.dataset.editTask)));
}
function taskChipHTML(t){return '<div class="task-chip '+esc(t.kind||'none')+' '+(t.done?'done':'')+'"><label><input type="checkbox" data-task-check="'+t.id+'" '+(t.done?'checked':'')+'> <strong style="display:inline">'+esc(t.title)+'</strong></label><small>'+esc(t.time||'')+(t.source?' · из страницы':'')+'</small><button class="icon-btn" data-edit-task="'+t.id+'">⋯</button></div>'}
function taskRowHTML(t){return '<div class="task-row '+(t.done?'done':'')+'"><input type="checkbox" data-task-check="'+t.id+'" '+(t.done?'checked':'')+'><div class="grow"><strong>'+esc(t.title)+'</strong><div class="muted tiny">'+(t.time?esc(t.time)+' · ':'')+(t.source?'из своей страницы':'')+'</div></div><button class="icon-btn" data-edit-task="'+t.id+'">⋯</button></div>'}
function wireTaskChecks(root=document){root.querySelectorAll('[data-task-check]').forEach(x=>x.onchange=()=>toggleTask(x.dataset.taskCheck,x.checked))}
function toggleTask(id,done){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=done;
  if(t.source?.pageId&&t.source?.itemId){const p=state.pages.find(p=>p.id===t.source.pageId);for(const b of p?.blocks||[])if(b.type==='list')for(const g of b.data.groups||[]){const it=g.items.find(i=>i.id===t.source.itemId);if(it)it.done=done}}
  log((done?'Закрыта':'Возвращена')+' задача «'+t.title+'»');save();
  if(q('#planner').classList.contains('active'))renderPlanner();if(q('#overview').classList.contains('active'))renderOverview();if(currentPageId)renderPage()
}

/* calendar */
q('#calPrev').onclick=()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar()};
q('#calNext').onclick=()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar()};
function renderCalendar(){
  const y=calendarDate.getFullYear(),m=calendarDate.getMonth();q('#calendarLabel').textContent=calendarDate.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const first=new Date(y,m,1),start=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();let cells='';
  for(let i=0;i<42;i++){
    let day=i-start+1,dm=m,dy=y,out=false;if(day<1){day=prevDays+day;dm=m-1;out=true}else if(day>days){day-=days;dm=m+1;out=true}
    const d=new Date(dy,dm,day,12),key=d.toISOString().slice(0,10),ts=state.tasks.filter(t=>t.date===key);
    cells+='<div class="month-cell '+(out?'out ':'')+(key===todayKey()?'today':'')+'"><div class="num">'+day+'</div>'+ts.slice(0,3).map(t=>'<div class="month-task">'+esc(t.title)+'</div>').join('')+'</div>'
  }
  q('#monthGrid').innerHTML=cells
}

/* analytics/history/settings */
qa('[data-analytics-mode]').forEach(b=>b.onclick=()=>{analyticsMode=b.dataset.analyticsMode;qa('[data-analytics-mode]').forEach(x=>x.classList.toggle('active',x===b));renderAnalytics()});
q('#analyticsPrev').onclick=()=>{analyticsDate=analyticsMode==='month'?new Date(analyticsDate.getFullYear(),analyticsDate.getMonth()-1,1):new Date(analyticsDate.getFullYear()-1,0,1);renderAnalytics()};
q('#analyticsNext').onclick=()=>{analyticsDate=analyticsMode==='month'?new Date(analyticsDate.getFullYear(),analyticsDate.getMonth()+1,1):new Date(analyticsDate.getFullYear()+1,0,1);renderAnalytics()};
q('#analyticsNow').onclick=()=>{analyticsDate=new Date();renderAnalytics()};
function monthHeatmapHTML(h,y,m){
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=(first.getDay()+6)%7;
  let cells='<div class="heat-weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="heat-month-grid">';
  for(let i=0;i<start;i++)cells+='<i class="heat-day blank"></i>';
  for(let d=1;d<=days;d++){
    const key=new Date(y,m,d,12).toISOString().slice(0,10),v=(state.habitLogs[key]||{})[h.id],done=habitDone(h,v),has=v!==undefined&&v!==null&&v!=='';
    cells+='<i class="heat-day '+(done?'done':has?'partial':'')+(key===todayKey()?' today':'')+'" title="'+d+'"></i>';
  }
  cells+='</div>';return cells
}
function yearHeatmapHTML(h,y){
  let out='<div class="year-habit-grid">';
  for(let m=0;m<12;m++){
    out+='<div class="mini-month"><strong>'+new Date(y,m,1).toLocaleDateString('ru-RU',{month:'short'})+'</strong><div class="mini-month-grid">';
    const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=(first.getDay()+6)%7;
    for(let i=0;i<start;i++)out+='<i class="mini-heat blank"></i>';
    for(let d=1;d<=days;d++){const key=new Date(y,m,d,12).toISOString().slice(0,10),v=(state.habitLogs[key]||{})[h.id],done=habitDone(h,v),has=v!==undefined&&v!==null&&v!=='';out+='<i class="mini-heat '+(done?'done':has?'partial':'')+(key===todayKey()?' today':'')+'"></i>'}
    out+='</div></div>'
  }
  out+='</div>';return out
}
function renderAnalytics(){
  q('#anHabits').textContent=state.habits.length;
  const y=analyticsDate.getFullYear(),m=analyticsDate.getMonth();
  q('#analyticsPeriodLabel').textContent=analyticsMode==='month'?analyticsDate.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}):String(y);
  const host=q('#habitCalendars');
  if(!state.habits.length){q('#anDone').textContent='0';q('#anActiveDays').textContent='0';host.innerHTML='<div class="empty">Пока нет привычек.</div>';return}
  let doneCount=0;const activeDays=new Set();
  const start=analyticsMode==='month'?new Date(y,m,1):new Date(y,0,1),end=analyticsMode==='month'?new Date(y,m+1,0):new Date(y,11,31);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const key=d.toISOString().slice(0,10),logs=state.habitLogs[key]||{};let dayActive=false;for(const h of state.habits){const v=logs[h.id];if(v!==undefined&&v!==null&&v!==''){dayActive=true;if(habitDone(h,v))doneCount++}}if(dayActive)activeDays.add(key)}
  q('#anDone').textContent=doneCount;q('#anActiveDays').textContent=activeDays.size;
  host.innerHTML=state.habits.map(h=>'<article class="panel habit-calendar-card"><div class="section-head"><div><span class="section-kicker">ПРИВЫЧКА</span><h2>'+esc(h.name)+'</h2></div></div>'+(analyticsMode==='month'?monthHeatmapHTML(h,y,m):yearHeatmapHTML(h,y))+'</article>').join('')
}
function renderHistory(){q('#historyList').innerHTML=state.history.length?state.history.map(h=>'<div class="history-item"><time>'+new Date(h.at).toLocaleString('ru-RU')+'</time><div>'+esc(h.msg)+'</div></div>').join(''):'<div class="empty">История появится после первых действий.</div>'}
function renderSettings(){}
q('#exportBtn').onclick=q('#settingsExport').onclick=()=>{
  const a=document.createElement('a'),blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='systema-2-'+todayKey()+'.json';a.click();URL.revokeObjectURL(a.href)
};
q('#importInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{state=normalize(JSON.parse(await f.text()));log('Импортированы данные');save();toast('Импорт готов');showView('overview')}catch{toast('Не удалось прочитать JSON')}};
q('#resetAll').onclick=()=>{if(confirm('Удалить ВСЕ локальные данные Системы 2?')){state=defaultState();save();localStorage.setItem(STORE,JSON.stringify(state));showView('overview')}};

/* constructor + pages */
function openPageModal(page=null){q('#pageId').value=page?.id||'';q('#pageName').value=page?.name||'';q('#pageDescription').value=page?.description||'';q('#pageModalTitle').textContent=page?'Настройки страницы':'Новая страница';openModal('pageModal')}
q('#savePage').onclick=()=>{
  const name=q('#pageName').value.trim();if(!name)return toast('Нужно название страницы');
  const id=q('#pageId').value;
  if(id){const p=state.pages.find(x=>x.id===id);p.name=name;p.description=q('#pageDescription').value.trim();log('Изменена страница «'+name+'»');currentPageId=id}
  else{const p={id:uid(),name,description:q('#pageDescription').value.trim(),archived:false,blocks:[]};state.pages.push(p);currentPageId=p.id;log('Создана страница «'+name+'»')}
  save();closeModal('pageModal');openPage(currentPageId)
};
function renderConstructor(){
  const host=q('#pageCards'),pages=state.pages.filter(p=>!p.archived);
  host.innerHTML=pages.length?pages.map(p=>{const prog=pageProgress(p);return '<article class="panel page-card" data-open-page="'+p.id+'"><div class="eyebrow">СТРАНИЦА</div><h3>'+esc(p.name)+'</h3><p class="muted">'+esc(p.description||'Без описания')+'</p><div class="progress"><i style="width:'+prog.pct+'%"></i></div><p class="tiny muted">'+prog.done+' / '+prog.total+' пунктов</p></article>'}).join(''):'<div class="empty">Создай первую страницу. Никаких шаблонов: только название, описание и нужные тебе блоки.</div>';
  host.querySelectorAll('[data-open-page]').forEach(x=>x.onclick=()=>openPage(x.dataset.openPage))
}
function openPage(id){currentPageId=id;editMode=false;const p=page();if(!p)return;qa('.view').forEach(v=>v.classList.remove('active'));q('#customPage').classList.add('active');qa('[data-view]').forEach(b=>b.classList.remove('active'));q('#eyebrow').textContent='МОЯ СТРАНИЦА';q('#title').textContent=p.name;renderPage();renderSidebar()}
function page(){return state.pages.find(p=>p.id===currentPageId)}
function pageProgress(p=page()){let total=0,done=0;for(const b of p?.blocks||[])if(b.type==='list')for(const g of b.data.groups||[])for(const i of g.items||[]){total++;if(i.done)done++}return{total,done,pct:total?Math.round(done/total*100):0}}
q('#editPageBtn').onclick=()=>{editMode=!editMode;renderPage()};
q('#savePageEditsBtn').onclick=()=>{
  commitInlinePageEdits();
  save();
  toast('Страница сохранена');
  editMode=false;
  renderPage()
};
q('#pageSettingsBtn').onclick=()=>openPageModal(page());
q('#archivePageBtn').onclick=()=>{const p=page();if(p&&confirm('Архивировать страницу «'+p.name+'»?')){p.archived=true;log('Архивирована страница «'+p.name+'»');save();showView('constructor')}};
q('#addBlockBtn').onclick=()=>openModal('blockPaletteModal');
const blockDefs={
  list:['Список с группами','Предметы → лабораторные, этапы проекта, покупки'],
  text:['Текстовая ячейка','Свободная заметка с заголовком'],
  heading:['Заголовок','Разделитель смысловых частей страницы'],
  progress:['Прогресс','Автоматически по галочкам или вручную'],
  metric:['Метрика','Число, единица, цель'],
  deadline:['Дата / дедлайн','Дата и сколько осталось дней'],
  linkedTasks:['Задачи страницы','Всё, что отправлено из этой страницы в план'],
  habit:['Привычка','Одна из привычек общей Системы'],
  spacer:['Пустое место','Немного воздуха между блоками']
};
q('#blockPalette').innerHTML=Object.entries(blockDefs).map(([k,v])=>'<button data-add-block="'+k+'"><b>'+v[0]+'</b><span>'+v[1]+'</span></button>').join('');
q('#blockPalette').querySelectorAll('[data-add-block]').forEach(b=>b.onclick=()=>{addBlock(b.dataset.addBlock);closeModal('blockPaletteModal')});
function addBlock(type){
  const defaults={
    list:{title:'Новый список',groups:[{id:uid(),title:'Новая группа',items:[]}]},
    text:{title:'Заметка',text:'Напиши здесь что угодно.'},heading:{text:'Новый раздел'},
    progress:{title:'Прогресс',auto:true,current:0,target:100,unit:'%'},
    metric:{title:'Метрика',value:0,target:'',unit:''},deadline:{title:'Дедлайн',date:todayKey()},
    linkedTasks:{title:'Задачи страницы'},habit:{title:'Привычка',habitId:state.habits[0]?.id||''},spacer:{height:1}
  };
  page().blocks.push({id:uid(),type,size:type==='heading'||type==='spacer'?'full':'m',data:defaults[type]});log('На страницу «'+page().name+'» добавлен блок «'+blockDefs[type][0]+'»');save();renderPage()
}
function renderPage(){
  const p=page();if(!p)return;q('#title').textContent=p.name;q('#pageDescriptionView').textContent=p.description||'';
  q('#editPageBtn').textContent=editMode?'Выйти без сохранения':'Редактировать';
  q('#savePageEditsBtn').style.display=editMode?'inline-block':'none';
  q('#addBlockBtn').style.display=editMode?'inline-block':'none';q('#pageSettingsBtn').style.display=editMode?'inline-block':'none';q('#archivePageBtn').style.display=editMode?'inline-block':'none';
  const host=q('#blocks');host.innerHTML=p.blocks.length?p.blocks.map(blockHTML).join(''):'<div class="empty" style="grid-column:1/-1">Страница пустая. Нажми «Редактировать», затем «+ Блок».</div>';
  wirePage(host)
}
function toolsHTML(b){if(!editMode)return'';return '<div class="block-tools"><button title="Выше" data-block-up="'+b.id+'">↑</button><button title="Ниже" data-block-down="'+b.id+'">↓</button><button title="Размер блока" data-block-size="'+b.id+'">'+b.size.toUpperCase()+'</button><button title="Настройки блока" data-block-edit="'+b.id+'">⚙</button><button title="Удалить блок" data-block-del="'+b.id+'">×</button></div>'}
function editableBlockTitle(b,label,title){
  if(!editMode)return '<div><div class="eyebrow">'+label+'</div>'+(title?'<h3>'+esc(title)+'</h3>':'')+'</div>';
  return '<div class="block-title-editor"><span>'+label+'</span><input class="block-title-input" data-inline-block-title="'+b.id+'" value="'+esc(title||'')+'" placeholder="Название блока"></div>';
}
function blockHTML(b){
  const d=b.data||{},cls='panel block '+(b.size||'m')+(editMode?' editing':'');
  const head=(label,title='')=>'<div class="block-head">'+editableBlockTitle(b,label,title)+toolsHTML(b)+'</div>';
  if(b.type==='heading'){
    const headingTop=editMode?'<div class="block-head"><div class="block-title-editor"><span>ЗАГОЛОВОК</span><input class="block-title-input" data-inline-heading="'+b.id+'" value="'+esc(d.text||'Раздел')+'" placeholder="Текст заголовка"></div>'+toolsHTML(b)+'</div>':head('ЗАГОЛОВОК')+'<h2>'+esc(d.text||'Раздел')+'</h2>';
    return '<section class="'+cls+'">'+headingTop+'</section>'
  }
  if(b.type==='text')return '<section class="'+cls+'">'+head('ТЕКСТ',d.title)+'<div class="block-text">'+esc(d.text||'')+'</div></section>';
  if(b.type==='progress'){const pr=d.auto?pageProgress():{done:Number(d.current)||0,total:Number(d.target)||100,pct:Math.round((Number(d.current)||0)/(Number(d.target)||100)*100)};return '<section class="'+cls+'">'+head('ПРОГРЕСС',d.title)+'<div class="metric-main">'+clamp(pr.pct,0,100)+'%</div><div class="progress"><i style="width:'+clamp(pr.pct,0,100)+'%"></i></div><div class="auto-progress-note">'+(d.auto?'Считается по всем пунктам с галочками на этой странице · '+pr.done+' / '+pr.total:esc(d.current)+' / '+esc(d.target)+' '+esc(d.unit||''))+'</div></section>'}
  if(b.type==='metric')return '<section class="'+cls+'">'+head('МЕТРИКА',d.title)+'<div class="metric-main">'+esc(d.value||0)+' <small>'+esc(d.unit||'')+'</small></div>'+(d.target!==''?'<div class="muted tiny">Цель: '+esc(d.target)+' '+esc(d.unit||'')+'</div>':'')+(editMode?'':'<div class="inline-add"><input type="number" data-metric-value="'+b.id+'" value="'+esc(d.value||0)+'"><button class="btn small" data-metric-save="'+b.id+'">Записать</button></div>')+'</section>';
  if(b.type==='deadline'){const delta=Math.ceil((new Date(d.date+'T12:00:00')-new Date(todayKey()+'T12:00:00'))/86400000);return '<section class="'+cls+'">'+head('ДЕДЛАЙН',d.title)+'<div class="deadline-main '+(delta<0?'overdue':'')+'">'+fmtDate(d.date,{day:'numeric',month:'long',year:'numeric'})+'</div><p class="muted">'+(delta===0?'Сегодня':delta>0?'Осталось '+delta+' дн.':'Просрочено на '+Math.abs(delta)+' дн.')+'</p></section>'}
  if(b.type==='linkedTasks'){const ts=state.tasks.filter(t=>t.source?.pageId===pId());return '<section class="'+cls+'">'+head('ПЛАН ДНЯ',d.title)+'<div class="miniTasks">'+(ts.length?ts.slice(0,10).map(taskRowHTML).join(''):'<div class="muted">Из этой страницы пока ничего не отправлено в план.</div>')+'</div></section>'}
  if(b.type==='habit'){const h=state.habits.find(h=>h.id===d.habitId);return '<section class="'+cls+'">'+head('ПРИВЫЧКА',d.title||h?.name||'Привычка')+(h?'<div class="habit-block"><div><strong>'+esc(h.name)+'</strong><div class="muted tiny">'+(h.type==='number'?'Цель '+esc(h.target)+' '+esc(h.unit||''):'Отметка за сегодня')+'</div></div>'+(h.type==='bool'?'<button class="habit-check '+(((state.habitLogs[todayKey()]||{})[h.id])?'done':'')+'" data-habit-bool="'+h.id+'">'+(((state.habitLogs[todayKey()]||{})[h.id])?'✓':'')+'</button>':'<div class="habit-number"><input data-habit-number="'+h.id+'" type="number" value="'+esc((state.habitLogs[todayKey()]||{})[h.id]??'')+'" placeholder="0"><span>'+esc(h.unit||'')+'</span></div>')+'</div>':'<div class="muted">Сначала создай привычку во вкладке «Привычки».</div>')+'</section>'}
  if(b.type==='spacer')return '<section class="'+cls+' spacer-block">'+(editMode?head('ПУСТОЕ МЕСТО'):'')+'</section>';
  if(b.type==='list')return listBlockHTML(b,cls,head('СПИСОК',d.title));
  return '<section class="'+cls+'">'+head(b.type)+'</section>'
}
function pId(){return currentPageId}
function listBlockHTML(b,cls,head){
  const gs=b.data.groups||[];let html='<section class="'+cls+'">'+head;
  for(const g of gs){
    const done=g.items.filter(i=>i.done).length;
    html+='<div class="list-group"><div class="group-head"><span>▾</span><strong>'+esc(g.title)+'</strong><span class="group-count">'+done+' / '+g.items.length+'</span>'+(editMode?'<button class="icon-btn" data-edit-group="'+b.id+':'+g.id+'">✎</button><button class="icon-btn" data-del-group="'+b.id+':'+g.id+'">×</button>':'')+'</div><div class="list-items">';
    for(const it of g.items){
      const linked=state.tasks.find(t=>t.source?.pageId===pId()&&t.source?.itemId===it.id&&!t.done);
      html+='<div class="list-item '+(it.done?'done':'')+'"><input type="checkbox" data-list-check="'+b.id+':'+g.id+':'+it.id+'" '+(it.done?'checked':'')+'><div><div class="item-title">'+esc(it.title)+'</div><div class="item-meta">'+(it.deadline?'<span class="tag deadline">'+fmtDate(it.deadline)+'</span>':'')+(linked?'<span class="tag plan">в плане '+fmtDate(linked.date)+'</span>':'')+(it.note?'<span class="tag">есть заметка</span>':'')+'</div></div><div class="item-actions">'+(!it.done&&!linked?'<button class="plan-btn" data-plan-item="'+b.id+':'+g.id+':'+it.id+'">+ в план</button>':'')+'<button class="icon-btn" data-edit-item="'+b.id+':'+g.id+':'+it.id+'">⋯</button></div></div>'
    }
    if(editMode)html+='<div class="inline-add" style="padding:9px"><input placeholder="Новый пункт" data-new-item-input="'+b.id+':'+g.id+'"><button class="btn small" data-add-item="'+b.id+':'+g.id+'">+ Пункт</button></div>';
    html+='</div></div>'
  }
  if(editMode)html+='<button class="btn small" style="margin-top:9px" data-add-group="'+b.id+'">+ Группа / предмет</button>';
  html+='</section>';return html
}
function commitInlinePageEdits(){
  q('#blocks')?.querySelectorAll('[data-inline-block-title]').forEach(x=>{const b=blockBy(x.dataset.inlineBlockTitle);if(b)b.data.title=x.value.trim()||'Без названия'});
  q('#blocks')?.querySelectorAll('[data-inline-heading]').forEach(x=>{const b=blockBy(x.dataset.inlineHeading);if(b)b.data.text=x.value.trim()||'Раздел'});
}
function wirePage(host){
  host.querySelectorAll('[data-block-up]').forEach(x=>x.onclick=()=>{commitInlinePageEdits();moveBlock(x.dataset.blockUp,-1)});host.querySelectorAll('[data-block-down]').forEach(x=>x.onclick=()=>moveBlock(x.dataset.blockDown,1));
  host.querySelectorAll('[data-block-size]').forEach(x=>x.onclick=()=>{commitInlinePageEdits();cycleSize(x.dataset.blockSize)});host.querySelectorAll('[data-block-del]').forEach(x=>x.onclick=()=>deleteBlock(x.dataset.blockDel));host.querySelectorAll('[data-block-edit]').forEach(x=>x.onclick=()=>openBlockEdit(x.dataset.blockEdit));
  host.querySelectorAll('[data-list-check]').forEach(x=>x.onchange=()=>toggleListItem(x.dataset.listCheck,x.checked));host.querySelectorAll('[data-add-group]').forEach(x=>x.onclick=()=>addGroup(x.dataset.addGroup));
  host.querySelectorAll('[data-edit-group]').forEach(x=>x.onclick=()=>editGroup(x.dataset.editGroup));host.querySelectorAll('[data-del-group]').forEach(x=>x.onclick=()=>deleteGroup(x.dataset.delGroup));
  host.querySelectorAll('[data-add-item]').forEach(x=>x.onclick=()=>addItem(x.dataset.addItem));host.querySelectorAll('[data-new-item-input]').forEach(x=>x.onkeydown=e=>{if(e.key==='Enter')addItem(x.dataset.newItemInput)});
  host.querySelectorAll('[data-edit-item]').forEach(x=>x.onclick=()=>openItemEdit(x.dataset.editItem));host.querySelectorAll('[data-plan-item]').forEach(x=>x.onclick=()=>planItem(x.dataset.planItem));
  host.querySelectorAll('[data-metric-save]').forEach(x=>x.onclick=()=>{const b=page().blocks.find(b=>b.id===x.dataset.metricSave),inp=host.querySelector('[data-metric-value="'+b.id+'"]');b.data.value=Number(inp.value)||0;b.data.history ||= [];b.data.history.push({date:todayKey(),value:b.data.value});log('Метрика «'+b.data.title+'»: '+b.data.value+' '+(b.data.unit||''));save();renderPage()});
  wireTaskChecks(host);wireHabitControls(host)
}
function moveBlock(id,dir){const a=page().blocks,i=a.findIndex(b=>b.id===id),j=i+dir;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];save();renderPage()}
function cycleSize(id){const b=page().blocks.find(b=>b.id===id),sizes=['s','m','l','full'];b.size=sizes[(sizes.indexOf(b.size||'m')+1)%sizes.length];save();renderPage()}
function deleteBlock(id){if(confirm('Удалить этот блок?')){page().blocks=page().blocks.filter(b=>b.id!==id);save();renderPage()}}
function blockBy(id){return page().blocks.find(b=>b.id===id)}
function addGroup(blockId){const b=blockBy(blockId),name=prompt('Название группы / предмета','Новый предмет');if(!name?.trim())return;b.data.groups.push({id:uid(),title:name.trim(),items:[]});save();renderPage()}
function editGroup(key){const [bid,gid]=key.split(':'),g=blockBy(bid).data.groups.find(g=>g.id===gid),n=prompt('Название',g.title);if(n?.trim()){g.title=n.trim();save();renderPage()}}
function deleteGroup(key){const [bid,gid]=key.split(':');if(confirm('Удалить группу вместе с её пунктами?')){const b=blockBy(bid);b.data.groups=b.data.groups.filter(g=>g.id!==gid);save();renderPage()}}
function addItem(key){const [bid,gid]=key.split(':'),input=q('[data-new-item-input="'+key+'"]'),title=input?.value.trim();if(!title)return;const g=blockBy(bid).data.groups.find(g=>g.id===gid);g.items.push({id:uid(),title,done:false,deadline:'',note:''});input.value='';log('Добавлен пункт «'+title+'» на странице «'+page().name+'»');save();renderPage()}
function findItem(key){const [bid,gid,iid]=key.split(':'),b=blockBy(bid),g=b.data.groups.find(g=>g.id===gid),it=g.items.find(i=>i.id===iid);return{b,g,it}}
function toggleListItem(key,done){const {it}=findItem(key);it.done=done;const linked=state.tasks.find(t=>t.source?.pageId===pId()&&t.source?.itemId===it.id&&!t.done);if(linked&&done)linked.done=true;log((done?'Закрыт':'Возвращён')+' пункт «'+it.title+'»');save();renderPage()}
let editingItemKey=null;
function openItemEdit(key){editingItemKey=key;const {it}=findItem(key);q('#itemTitle').value=it.title;q('#itemDeadline').value=it.deadline||'';q('#itemNote').value=it.note||'';openModal('itemModal')}
q('#saveItem').onclick=()=>{const {it}=findItem(editingItemKey);it.title=q('#itemTitle').value.trim()||it.title;it.deadline=q('#itemDeadline').value;it.note=q('#itemNote').value.trim();save();closeModal('itemModal');renderPage()};
q('#deleteItem').onclick=()=>{const {g,it}=findItem(editingItemKey);if(confirm('Удалить «'+it.title+'»?')){g.items=g.items.filter(i=>i.id!==it.id);state.tasks=state.tasks.filter(t=>t.source?.itemId!==it.id);save();closeModal('itemModal');renderPage()}};
function planItem(key){const {it}=findItem(key);q('#planItemKey').value=key;q('#planItemDate').value=it.deadline&&it.deadline>=todayKey()?it.deadline:todayKey();q('#planItemTime').value='';q('#planItemKind').value='none';openModal('planItemModal')}
q('#savePlanItem').onclick=()=>{const key=q('#planItemKey').value,{it}=findItem(key);state.tasks.push({id:uid(),title:it.title,date:q('#planItemDate').value,time:q('#planItemTime').value,kind:q('#planItemKind').value,done:it.done,source:{pageId:pId(),itemId:it.id}});log('Пункт «'+it.title+'» добавлен в план на '+q('#planItemDate').value);save();closeModal('planItemModal');renderPage();toast('Добавлено в план')};

/* block editor */
let editingBlockId=null;
function openBlockEdit(id){
  editingBlockId=id;const b=blockBy(id),d=b.data,host=q('#blockEditFields');q('#blockEditTitle').textContent='Настроить: '+(blockDefs[b.type]?.[0]||b.type);
  const input=(label,name,val,type='text')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(val??'')+'"></label>';
  let h='';
  if(b.type==='heading')h=input('Текст заголовка','text',d.text);
  if(b.type==='text')h=input('Название','title',d.title)+'<label>Текст<textarea name="text">'+esc(d.text||'')+'</textarea></label>';
  if(b.type==='list')h=input('Название блока','title',d.title)+'<p class="muted tiny">Группы и пункты редактируются прямо на странице в режиме редактирования.</p>';
  if(b.type==='progress')h=input('Название','title',d.title)+'<label><input name="auto" type="checkbox" '+(d.auto?'checked':'')+'> Считать автоматически по галочкам страницы</label><div class="row">'+input('Текущее','current',d.current,'number')+input('Цель','target',d.target,'number')+input('Единица','unit',d.unit)+'</div>';
  if(b.type==='metric')h=input('Название','title',d.title)+'<div class="row">'+input('Значение','value',d.value,'number')+input('Цель (необязательно)','target',d.target,'number')+input('Единица','unit',d.unit)+'</div>';
  if(b.type==='deadline')h=input('Название','title',d.title)+input('Дата','date',d.date,'date');
  if(b.type==='linkedTasks')h=input('Название','title',d.title);
  if(b.type==='habit')h=input('Название блока','title',d.title)+'<label>Привычка<select name="habitId">'+state.habits.map(h=>'<option value="'+h.id+'" '+(h.id===d.habitId?'selected':'')+'>'+esc(h.name)+'</option>').join('')+'</select></label>';
  if(b.type==='spacer')h='<p class="muted">Этот блок просто создаёт визуальный отступ.</p>';
  host.innerHTML=h;openModal('blockEditModal')
}
q('#saveBlockEdit').onclick=()=>{const b=blockBy(editingBlockId),fd=new FormData(q('#blockEditForm'));for(const [k,v] of fd.entries()){if(['current','target','value'].includes(k))b.data[k]=v===''?'':Number(v);else b.data[k]=v}if(b.type==='progress')b.data.auto=!!q('#blockEditFields [name=auto]')?.checked;save();closeModal('blockEditModal');renderPage()};

/* initialization */
q('#mobilePages').onclick=()=>showView('constructor');
if(q('#goConstructor'))q('#goConstructor').onclick=()=>showView('constructor');
if(q('#goHabits'))q('#goHabits').onclick=()=>showView('habits');
if(q('#goPlanner'))q('#goPlanner').onclick=()=>showView('planner');
renderSidebar();renderOverview();renderConstructor();renderCalendar();
