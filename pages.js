(() => {
'use strict';
const PAGE_KEY='systema_pages_addon_v1';
const BASE_KEY='system_tracker_v2';
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2);
const esc=s=>String(s??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayKey=()=>dateKey(new Date());
const parseDate=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12)};
const prettyDate=k=>parseDate(k).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let pagesState=loadPages(), currentPageId=null, editMode=false, dirty=false;

function loadPages(){
  try{const x=JSON.parse(localStorage.getItem(PAGE_KEY));if(x&&Array.isArray(x.pages))return x}catch{}
  return {version:1,pages:[]};
}
function savePages(){
  localStorage.setItem(PAGE_KEY,JSON.stringify(pagesState));
  dirty=false;renderSaveState();renderPageLinks();
}
function baseState(){
  try{return JSON.parse(localStorage.getItem(BASE_KEY))||{}}catch{return{}}
}
function saveBase(s){localStorage.setItem(BASE_KEY,JSON.stringify(s))}
function toast(msg){
  const t=$('#pagesToast');if(!t)return;t.textContent=msg;t.classList.add('show');
  clearTimeout(window.__pagesToastTimer);window.__pagesToastTimer=setTimeout(()=>t.classList.remove('show'),1800);
}
function markDirty(){dirty=true;renderSaveState()}
function page(){return pagesState.pages.find(p=>p.id===currentPageId)}
function pageProgress(p=page()){
  let total=0,done=0;
  for(const b of p?.blocks||[])if(b.type==='list')for(const g of b.data.groups||[])for(const i of g.items||[]){total++;if(i.done)done++}
  return {total,done,pct:total?Math.round(done/total*100):0};
}

function install(){
  const link=document.createElement('link');link.rel='stylesheet';link.href='pages.css?v=1';document.head.appendChild(link);
  injectSidebar();injectViews();injectDialogs();bindGlobal();
  renderPageLinks();renderPagesHome();
}
function injectSidebar(){
  const nav=$('.side-nav'); if(!nav)return;
  const pagesBtn=document.createElement('button');pagesBtn.className='nav-button';pagesBtn.id='pagesNavButton';
  pagesBtn.innerHTML='<img src="assets/icons/book.svg" alt=""/><span>Страницы</span>';
  pagesBtn.onclick=e=>{e.stopPropagation();openPagesHome()};nav.appendChild(pagesBtn);

  const head=document.createElement('div');head.className='pages-sidebar-head';head.innerHTML='<span>МОИ СТРАНИЦЫ</span><button id="pagesSideAdd" aria-label="Новая страница">+</button>';
  const list=document.createElement('div');list.className='pages-sidebar-list';list.id='pagesSidebarList';
  const sidebar=$('.sidebar');const foot=$('.sidebar-foot');sidebar.insertBefore(head,foot);sidebar.insertBefore(list,foot);
  $('#pagesSideAdd').onclick=()=>openPageDialog();

  const drawer=$('.drawer-panel');
  if(drawer){
    const title=document.createElement('div');title.className='pages-drawer-title';title.textContent='МОИ СТРАНИЦЫ';
    const dlist=document.createElement('div');dlist.id='pagesDrawerList';
    drawer.appendChild(title);drawer.appendChild(dlist);
  }
  const mobile=$('.mobile-nav');
  if(mobile){
    const b=document.createElement('button');b.id='pagesMobileButton';b.innerHTML='<img src="assets/icons/book.svg" alt=""/><span>Страницы</span>';b.onclick=e=>{e.stopPropagation();openPagesHome()};mobile.appendChild(b);
  }
}
function injectViews(){
  const main=$('.main-content');if(!main)return;
  const home=document.createElement('section');home.className='view';home.id='pagesView';
  home.innerHTML='<div class="pages-shell"><article class="panel pages-intro"><div><span class="section-kicker">МОИ СТРАНИЦЫ</span><h2>Свои разделы</h2><p>Любая структура: семестр, проект, поездка, список покупок или что угодно ещё. Старые разделы Системы работают как раньше.</p></div><button class="primary-button" id="pagesNewPage">＋ Новая страница</button></article><div id="pagesCards" class="pages-list"></div></div>';
  const own=document.createElement('section');own.className='view';own.id='pageOwnView';
  own.innerHTML='<article class="panel page-own-head"><div><span class="section-kicker">МОЯ СТРАНИЦА</span><h2 id="pageOwnTitle"></h2><p id="pageOwnDescription"></p></div><div class="page-own-toolbar"><button class="secondary-button" id="pageEditButton">Редактировать</button><button class="primary-button hidden" id="pageSaveButton">Сохранить страницу</button><button class="secondary-button hidden" id="pageAddBlockButton">＋ Блок</button><button class="text-button hidden" id="pageSettingsButton">Настройки</button><span id="pageSaveNote" class="page-save-note">Есть несохранённые изменения</span></div></article><div id="pageBlocks" class="page-blocks"></div>';
  main.appendChild(home);main.appendChild(own);
  $('#pagesNewPage').onclick=()=>openPageDialog();
  $('#pageEditButton').onclick=()=>{if(editMode&&dirty&&!confirm('Выйти из редактирования без сохранения?'))return;editMode=!editMode;if(!editMode){pagesState=loadPages();}dirty=false;renderCurrentPage()};
  $('#pageSaveButton').onclick=()=>{commitInlineEdits();savePages();editMode=false;renderCurrentPage();toast('Страница сохранена')};
  $('#pageAddBlockButton').onclick=()=>$('#pageBlockDialog').showModal();
  $('#pageSettingsButton').onclick=()=>openPageDialog(page());
}
function injectDialogs(){
  document.body.insertAdjacentHTML('beforeend',`
  <dialog class="modal" id="pageCreateDialog"><form id="pageCreateForm"><div class="modal-head"><div><span class="section-kicker">СТРАНИЦА</span><h2 id="pageDialogTitle">Новая страница</h2></div><button type="button" class="close-button" data-pages-close="pageCreateDialog">×</button></div><input id="pageEditId" type="hidden"/><div class="form-grid"><label class="full">Название<input id="pageNameInput" required maxlength="100" placeholder="МИФИ 5 семестр"/></label><label class="full">Описание<textarea id="pageDescriptionInput" rows="3" maxlength="1000" placeholder="Предметы, лабораторные и дедлайны"></textarea></label></div><div class="modal-actions"><button type="button" class="danger-button hidden" id="pageArchiveButton">Архивировать</button><span></span><button type="button" class="secondary-button" data-pages-close="pageCreateDialog">Отмена</button><button type="submit" class="primary-button">Сохранить</button></div></form></dialog>

  <dialog class="modal" id="pageBlockDialog"><div class="modal-head"><div><span class="section-kicker">КОНСТРУКТОР</span><h2>Добавить блок</h2></div><button type="button" class="close-button" data-pages-close="pageBlockDialog">×</button></div><div class="page-block-palette" id="pageBlockPalette"></div></dialog>

  <dialog class="modal" id="pageBlockEditDialog"><form id="pageBlockEditForm"><div class="modal-head"><div><span class="section-kicker">БЛОК</span><h2 id="pageBlockEditTitle">Настройки</h2></div><button type="button" class="close-button" data-pages-close="pageBlockEditDialog">×</button></div><input id="pageBlockEditId" type="hidden"/><div id="pageBlockEditFields" class="page-edit-grid"></div><div class="modal-actions"><span></span><span></span><button type="button" class="secondary-button" data-pages-close="pageBlockEditDialog">Отмена</button><button type="submit" class="primary-button">Применить</button></div></form></dialog>

  <dialog class="modal" id="pageItemDialog"><form id="pageItemForm"><div class="modal-head"><div><span class="section-kicker">ПУНКТ</span><h2>Настройки пункта</h2></div><button type="button" class="close-button" data-pages-close="pageItemDialog">×</button></div><input id="pageItemKey" type="hidden"/><div class="page-edit-grid"><label class="full">Название<input id="pageItemTitle" required/></label><label>Дедлайн<input id="pageItemDeadline" type="date"/></label><label class="full">Заметка<textarea id="pageItemNote" rows="3"></textarea></label></div><div class="modal-actions"><button type="button" class="danger-button" id="pageDeleteItem">Удалить</button><span></span><button type="button" class="secondary-button" data-pages-close="pageItemDialog">Отмена</button><button type="submit" class="primary-button">Сохранить</button></div></form></dialog>

  <dialog class="modal" id="pagePlanDialog"><form id="pagePlanForm" class="page-plan-form"><div class="modal-head"><div><span class="section-kicker">ПЛАН ДНЯ</span><h2 id="pagePlanTitle">Добавить в план</h2></div><button type="button" class="close-button" data-pages-close="pagePlanDialog">×</button></div><input id="pagePlanKey" type="hidden"/><div class="form-grid"><label>Дата<input id="pagePlanDate" type="date" required/></label><label>Тип времени<select id="pagePlanMode"><option value="none">Без времени</option><option value="exact">Точное время</option><option value="flexible">Примерное время</option></select></label><label id="pagePlanTimeWrap">Время<input id="pagePlanTime" type="time" value="12:00"/></label><label id="pagePlanDurationWrap">Длительность, мин<input id="pagePlanDuration" type="number" min="0" step="5" value="30"/></label></div><div class="modal-actions"><span></span><span></span><button type="button" class="secondary-button" data-pages-close="pagePlanDialog">Отмена</button><button type="submit" class="primary-button">Добавить</button></div></form></dialog>

  <div class="toast" id="pagesToast" role="status" aria-live="polite"></div>`);
  const defs={list:['Список с группами','Предметы → лабораторные, этапы, покупки'],text:['Текст','Свободная текстовая ячейка'],heading:['Заголовок','Раздел страницы'],progress:['Прогресс','По галочкам страницы или вручную'],metric:['Метрика','Число, единица и цель'],deadline:['Дедлайн','Дата и сколько осталось'],habit:['Привычка','Связь с привычкой из Системы'],linkedTasks:['Задачи страницы','То, что отправлено отсюда в план'],spacer:['Пустое место','Визуальный отступ']};
  $('#pageBlockPalette').innerHTML=Object.entries(defs).map(([k,v])=>'<button class="page-block-choice" data-page-add-block="'+k+'"><strong>'+v[0]+'</strong><span>'+v[1]+'</span></button>').join('');
  $$('[data-pages-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.pagesClose).close());
  $$('[data-page-add-block]').forEach(b=>b.onclick=()=>{addBlock(b.dataset.pageAddBlock);$('#pageBlockDialog').close()});
  $('#pageCreateForm').onsubmit=savePageDialog;$('#pageArchiveButton').onclick=archivePage;
  $('#pageBlockEditForm').onsubmit=saveBlockDialog;$('#pageItemForm').onsubmit=saveItemDialog;$('#pageDeleteItem').onclick=deleteItem;
  $('#pagePlanForm').onsubmit=savePlanDialog;$('#pagePlanMode').onchange=updatePlanMode;updatePlanMode();
}
function bindGlobal(){
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-view],[data-view-target]')&&!e.target.closest('#pagesNavButton,#pagesMobileButton'))hidePagesViews();
  },true);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
}
function hidePagesViews(){
  $('#pagesView')?.classList.remove('active');$('#pageOwnView')?.classList.remove('active');
  $('#pagesNavButton')?.classList.remove('active');$('#pagesMobileButton')?.classList.remove('active');
}
function activatePagesView(view){
  $$('.view').forEach(v=>v.classList.remove('active'));view.classList.add('active');
  $$('.nav-button').forEach(b=>b.classList.remove('active'));$('#pagesNavButton')?.classList.add('active');
  $$('.mobile-nav button').forEach(b=>b.classList.remove('active'));$('#pagesMobileButton')?.classList.add('active');
}
function setHeader(eyebrow,title){$('#pageEyebrow').textContent=eyebrow;$('#pageTitle').textContent=title;$('#drawer')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
function openPagesHome(){currentPageId=null;editMode=false;dirty=false;activatePagesView($('#pagesView'));setHeader('МОИ СТРАНИЦЫ','Страницы');renderPagesHome();renderPageLinks()}
function openOwnPage(id){currentPageId=id;editMode=false;dirty=false;activatePagesView($('#pageOwnView'));setHeader('МОЯ СТРАНИЦА',page()?.name||'Страница');renderCurrentPage();renderPageLinks()}
function renderPagesHome(){
  const root=$('#pagesCards');if(!root)return;const pages=pagesState.pages.filter(p=>!p.archived);
  root.innerHTML=pages.length?pages.map(p=>{const pr=pageProgress(p);return '<button class="pages-card" data-open-own-page="'+p.id+'"><span class="section-kicker">СТРАНИЦА</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'Без описания')+'</p><div class="progress-track"><i style="width:'+pr.pct+'%"></i></div><div class="pages-card-foot"><span>'+pr.done+' / '+pr.total+' пунктов</span><span>Открыть →</span></div></button>'}).join(''):'<div class="pages-empty"><h2>Пока пусто</h2><p>Создай первую страницу и собери её из нужных блоков.</p></div>';
  root.querySelectorAll('[data-open-own-page]').forEach(b=>b.onclick=()=>openOwnPage(b.dataset.openOwnPage))
}
function renderPageLinks(){
  const pages=pagesState.pages.filter(p=>!p.archived);
  const side=$('#pagesSidebarList');if(side)side.innerHTML=pages.map(p=>'<button class="pages-sidebar-link '+(p.id===currentPageId?'active':'')+'" data-page-link="'+p.id+'">'+esc(p.name)+'</button>').join('');
  side?.querySelectorAll('[data-page-link]').forEach(b=>b.onclick=()=>openOwnPage(b.dataset.pageLink));
  const drawer=$('#pagesDrawerList');if(drawer)drawer.innerHTML='<button class="pages-drawer-link" id="drawerPagesHome"><img src="assets/icons/book.svg" alt=""/>Все страницы</button>'+pages.map(p=>'<button class="pages-drawer-link" data-drawer-page="'+p.id+'"><img src="assets/icons/list.svg" alt=""/>'+esc(p.name)+'</button>').join('');
  $('#drawerPagesHome')?.addEventListener('click',openPagesHome);drawer?.querySelectorAll('[data-drawer-page]').forEach(b=>b.onclick=()=>openOwnPage(b.dataset.drawerPage))
}
function renderSaveState(){
  const n=$('#pageSaveNote');if(n)n.classList.toggle('show',dirty);
}
function openPageDialog(p=null){
  $('#pageDialogTitle').textContent=p?'Настройки страницы':'Новая страница';$('#pageEditId').value=p?.id||'';$('#pageNameInput').value=p?.name||'';$('#pageDescriptionInput').value=p?.description||'';$('#pageArchiveButton').classList.toggle('hidden',!p);$('#pageCreateDialog').showModal()
}
function savePageDialog(e){
  e.preventDefault();const name=$('#pageNameInput').value.trim();if(!name)return;
  const id=$('#pageEditId').value;
  if(id){const p=pagesState.pages.find(p=>p.id===id);p.name=name;p.description=$('#pageDescriptionInput').value.trim();currentPageId=id}
  else{const p={id:uid(),name,description:$('#pageDescriptionInput').value.trim(),archived:false,blocks:[]};pagesState.pages.push(p);currentPageId=p.id}
  savePages();$('#pageCreateDialog').close();openOwnPage(currentPageId)
}
function archivePage(){
  const p=page();if(!p||!confirm('Архивировать страницу «'+p.name+'»?'))return;p.archived=true;savePages();$('#pageCreateDialog').close();openPagesHome()
}
function addBlock(type){
  const base=baseState(),defs={
    list:{title:'Новый список',groups:[{id:uid(),title:'Новая группа',items:[]}]},
    text:{title:'Заметка',text:'Напиши здесь что угодно.'},
    heading:{text:'Новый раздел'},
    progress:{title:'Прогресс',auto:true,current:0,target:100,unit:'%'},
    metric:{title:'Метрика',value:0,target:'',unit:''},
    deadline:{title:'Дедлайн',date:todayKey()},
    habit:{title:'Привычка',habitId:(base.habits||[]).find(h=>h.active!==false)?.id||''},
    linkedTasks:{title:'Задачи страницы'},
    spacer:{height:1}
  };
  page().blocks.push({id:uid(),type,size:type==='heading'||type==='spacer'?'full':'m',data:defs[type]});markDirty();renderCurrentPage()
}
function renderCurrentPage(){
  const p=page();if(!p)return;setHeader('МОЯ СТРАНИЦА',p.name);$('#pageOwnTitle').textContent=p.name;$('#pageOwnDescription').textContent=p.description||'';
  $('#pageEditButton').textContent=editMode?'Выйти без сохранения':'Редактировать';$('#pageSaveButton').classList.toggle('hidden',!editMode);$('#pageAddBlockButton').classList.toggle('hidden',!editMode);$('#pageSettingsButton').classList.toggle('hidden',!editMode);renderSaveState();
  const root=$('#pageBlocks');root.innerHTML=p.blocks.length?p.blocks.map(blockHtml).join(''):'<div class="pages-empty" style="grid-column:1/-1"><h2>Страница пустая</h2><p>Нажми «Редактировать», затем «＋ Блок».</p></div>';wirePage(root)
}
function tools(b){return editMode?'<div class="page-block-tools"><button title="Выше" data-block-up="'+b.id+'">↑</button><button title="Ниже" data-block-down="'+b.id+'">↓</button><button title="Размер" data-block-size="'+b.id+'">'+b.size.toUpperCase()+'</button><button title="Настроить" data-block-edit="'+b.id+'">⚙</button><button title="Удалить" data-block-delete="'+b.id+'">×</button></div>':''}
function titleHead(b,label,title){
  if(editMode)return '<div class="page-block-head"><div class="page-title-edit"><span>'+label+'</span><input data-block-title="'+b.id+'" value="'+esc(title||'')+'" placeholder="Название блока"/></div>'+tools(b)+'</div>';
  return '<div class="page-block-head"><div><span class="section-kicker">'+label+'</span>'+(title?'<h3>'+esc(title)+'</h3>':'')+'</div>'+tools(b)+'</div>'
}
function blockHtml(b){
  const d=b.data||{},cls='panel page-block size-'+(b.size||'m')+(editMode?' editing':'');
  if(b.type==='heading')return '<article class="'+cls+'">'+(editMode?'<div class="page-block-head"><div class="page-title-edit"><span>ЗАГОЛОВОК</span><input data-heading-text="'+b.id+'" value="'+esc(d.text||'')+'"/></div>'+tools(b)+'</div>':'<h2 class="page-heading">'+esc(d.text||'Раздел')+'</h2>')+'</article>';
  if(b.type==='text')return '<article class="'+cls+'">'+titleHead(b,'ТЕКСТ',d.title)+'<div class="page-free-text">'+esc(d.text||'')+'</div></article>';
  if(b.type==='list')return listHtml(b,cls);
  if(b.type==='progress'){const pr=d.auto?pageProgress():{done:Number(d.current)||0,total:Number(d.target)||100,pct:Math.round((Number(d.current)||0)/Math.max(1,Number(d.target)||100)*100)};return '<article class="'+cls+'">'+titleHead(b,'ПРОГРЕСС',d.title)+'<div class="page-progress-value">'+Math.max(0,Math.min(100,pr.pct))+'%</div><div class="page-progress-track"><i style="width:'+Math.max(0,Math.min(100,pr.pct))+'%"></i></div><div class="page-progress-note">'+(d.auto?pr.done+' / '+pr.total+' пунктов страницы':esc(d.current)+' / '+esc(d.target)+' '+esc(d.unit||''))+'</div></article>'}
  if(b.type==='metric')return '<article class="'+cls+'">'+titleHead(b,'МЕТРИКА',d.title)+'<div class="page-metric-value">'+esc(d.value??0)+' <small>'+esc(d.unit||'')+'</small></div>'+(d.target!==''?'<div class="page-progress-note">Цель: '+esc(d.target)+' '+esc(d.unit||'')+'</div>':'')+'</article>';
  if(b.type==='deadline'){const delta=Math.ceil((parseDate(d.date)-parseDate(todayKey()))/86400000);return '<article class="'+cls+'">'+titleHead(b,'ДЕДЛАЙН',d.title)+'<div class="page-deadline-value '+(delta<0?'overdue':'')+'">'+esc(prettyDate(d.date))+'</div><div class="page-progress-note">'+(delta===0?'Сегодня':delta>0?'Осталось '+delta+' дн.':'Просрочено на '+Math.abs(delta)+' дн.')+'</div></article>'}
  if(b.type==='habit')return habitBlockHtml(b,cls);
  if(b.type==='linkedTasks')return linkedTasksHtml(b,cls);
  if(b.type==='spacer')return '<article class="'+cls+' spacer">'+(editMode?titleHead(b,'ПУСТОЕ МЕСТО',''):'')+'</article>';
  return '<article class="'+cls+'">'+titleHead(b,b.type,d.title)+'</article>'
}
function listHtml(b,cls){
  let out='<article class="'+cls+'">'+titleHead(b,'СПИСОК',b.data.title);
  for(const g of b.data.groups||[]){
    const done=g.items.filter(i=>i.done).length;
    out+='<div class="page-list-group"><div class="page-group-head">'+(editMode?'<input class="page-group-title-input" data-group-title="'+b.id+':'+g.id+'" value="'+esc(g.title)+'"/>':'<strong>'+esc(g.title)+'</strong>')+'<span class="page-group-count">'+done+' / '+g.items.length+'</span>'+(editMode?'<button class="text-button" data-group-delete="'+b.id+':'+g.id+'">×</button>':'')+'</div>';
    for(const it of g.items){
      const linked=findLinkedTask(it);
      out+='<div class="page-list-item '+(itemDone(it,linked)?'done':'')+'"><input type="checkbox" data-item-check="'+b.id+':'+g.id+':'+it.id+'" '+(itemDone(it,linked)?'checked':'')+'/><div><div class="page-item-title">'+esc(it.title)+'</div><div class="page-item-meta">'+(it.deadline?'<span class="page-tag deadline">'+esc(prettyDate(it.deadline))+'</span>':'')+(linked?'<span class="page-tag plan">в плане '+esc(prettyDate(linked.date))+'</span>':'')+(it.note?'<span class="page-tag">есть заметка</span>':'')+'</div></div><div class="page-item-actions">'+(!linked&&!itemDone(it,linked)?'<button class="page-plan-button" data-item-plan="'+b.id+':'+g.id+':'+it.id+'">＋ в план</button>':'')+'<button class="text-button" data-item-edit="'+b.id+':'+g.id+':'+it.id+'">•••</button></div></div>'
    }
    if(editMode)out+='<div class="page-inline-add"><input data-new-item="'+b.id+':'+g.id+'" placeholder="Новый пункт"/><button class="secondary-button" data-add-item="'+b.id+':'+g.id+'">＋ Пункт</button></div>';
    out+='</div>'
  }
  if(editMode)out+='<button class="text-button" style="margin-top:10px" data-add-group="'+b.id+'">＋ Группа / предмет</button>';
  return out+'</article>'
}
function habitBlockHtml(b,cls){
  const base=baseState(),h=(base.habits||[]).find(h=>h.id===b.data.habitId),log=base.habitLogs?.[todayKey()]?.[h?.id],value=typeof log==='object'?Number(log.value||0):Number(log||0);
  const done=h?(h.metric==='check'?value>=1:(h.metric==='limit'?value<=Number(h.target||0):value>=Number(h.target||1))):false;
  return '<article class="'+cls+'">'+titleHead(b,'ПРИВЫЧКА',b.data.title||h?.name||'Привычка')+(h?'<div class="page-habit"><div class="page-habit-copy"><strong>'+esc(h.name)+'</strong><span>'+esc(h.metric==='check'?'сделано / нет':(h.target+' '+(h.unit||'')))+'</span></div><span class="page-habit-status '+(done?'done':'')+'">'+(done?'Выполнено':(value?esc(value+' '+(h.unit||'')):'Нет отметки'))+'</span></div>':'<p class="page-free-text">Выбери привычку в настройках блока.</p>')+'</article>'
}
function linkedTasksHtml(b,cls){
  const base=baseState(),tasks=(base.tasks||[]).filter(t=>t.pageSource?.pageId===currentPageId).sort((a,b)=>a.date.localeCompare(b.date));
  return '<article class="'+cls+'">'+titleHead(b,'ПЛАН ДНЯ',b.data.title)+'<div class="page-linked-tasks">'+(tasks.length?tasks.slice(0,12).map(t=>'<div class="page-linked-task '+(base.taskCompletions?.[t.date]?.[t.id]?'done':'')+'"><i></i><span>'+esc(t.title)+'</span><small>'+esc(prettyDate(t.date))+(t.time?' · '+esc(t.time):'')+'</small></div>').join(''):'<p class="page-free-text">Из этой страницы пока ничего не добавлено в план.</p>')+'</div></article>'
}
function itemDone(it,linked){if(linked){const b=baseState();return !!b.taskCompletions?.[linked.date]?.[linked.id]}return !!it.done}
function findLinkedTask(it){const b=baseState();return (b.tasks||[]).find(t=>t.pageSource?.pageId===currentPageId&&t.pageSource?.itemId===it.id)}
function block(id){return page()?.blocks.find(b=>b.id===id)}
function findItem(key){const [bid,gid,iid]=key.split(':'),b=block(bid),g=b.data.groups.find(g=>g.id===gid),it=g.items.find(i=>i.id===iid);return{b,g,it}}
function wirePage(root){
  root.querySelectorAll('[data-block-title]').forEach(x=>x.oninput=()=>markDirty());root.querySelectorAll('[data-heading-text]').forEach(x=>x.oninput=()=>markDirty());root.querySelectorAll('[data-group-title]').forEach(x=>x.oninput=()=>markDirty());
  root.querySelectorAll('[data-block-up]').forEach(x=>x.onclick=()=>moveBlock(x.dataset.blockUp,-1));root.querySelectorAll('[data-block-down]').forEach(x=>x.onclick=()=>moveBlock(x.dataset.blockDown,1));root.querySelectorAll('[data-block-size]').forEach(x=>x.onclick=()=>cycleSize(x.dataset.blockSize));root.querySelectorAll('[data-block-edit]').forEach(x=>x.onclick=()=>openBlockDialog(x.dataset.blockEdit));root.querySelectorAll('[data-block-delete]').forEach(x=>x.onclick=()=>deleteBlock(x.dataset.blockDelete));
  root.querySelectorAll('[data-add-group]').forEach(x=>x.onclick=()=>addGroup(x.dataset.addGroup));root.querySelectorAll('[data-group-delete]').forEach(x=>x.onclick=()=>deleteGroup(x.dataset.groupDelete));root.querySelectorAll('[data-add-item]').forEach(x=>x.onclick=()=>addItem(x.dataset.addItem));root.querySelectorAll('[data-new-item]').forEach(x=>x.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addItem(x.dataset.newItem)}});
  root.querySelectorAll('[data-item-check]').forEach(x=>x.onchange=()=>toggleItem(x.dataset.itemCheck,x.checked));root.querySelectorAll('[data-item-edit]').forEach(x=>x.onclick=()=>openItemDialog(x.dataset.itemEdit));root.querySelectorAll('[data-item-plan]').forEach(x=>x.onclick=()=>openPlanDialog(x.dataset.itemPlan))
}
function commitInlineEdits(){
  $('#pageBlocks')?.querySelectorAll('[data-block-title]').forEach(x=>{const b=block(x.dataset.blockTitle);if(b)b.data.title=x.value.trim()||'Без названия'});
  $('#pageBlocks')?.querySelectorAll('[data-heading-text]').forEach(x=>{const b=block(x.dataset.headingText);if(b)b.data.text=x.value.trim()||'Раздел'});
  $('#pageBlocks')?.querySelectorAll('[data-group-title]').forEach(x=>{const [bid,gid]=x.dataset.groupTitle.split(':'),g=block(bid)?.data.groups.find(g=>g.id===gid);if(g)g.title=x.value.trim()||'Группа'});
}
function moveBlock(id,dir){commitInlineEdits();const a=page().blocks,i=a.findIndex(b=>b.id===id),j=i+dir;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];markDirty();renderCurrentPage()}
function cycleSize(id){commitInlineEdits();const b=block(id),s=['s','m','l','full'];b.size=s[(s.indexOf(b.size||'m')+1)%s.length];markDirty();renderCurrentPage()}
function deleteBlock(id){if(confirm('Удалить блок?')){commitInlineEdits();page().blocks=page().blocks.filter(b=>b.id!==id);markDirty();renderCurrentPage()}}
function addGroup(id){commitInlineEdits();block(id).data.groups.push({id:uid(),title:'Новая группа',items:[]});markDirty();renderCurrentPage()}
function deleteGroup(key){if(!confirm('Удалить группу вместе с пунктами?'))return;commitInlineEdits();const [bid,gid]=key.split(':');block(bid).data.groups=block(bid).data.groups.filter(g=>g.id!==gid);markDirty();renderCurrentPage()}
function addItem(key){commitInlineEdits();const inp=$('[data-new-item="'+key+'"]'),title=inp?.value.trim();if(!title)return;const [bid,gid]=key.split(':'),g=block(bid).data.groups.find(g=>g.id===gid);g.items.push({id:uid(),title,done:false,deadline:'',note:''});markDirty();renderCurrentPage()}
function toggleItem(key,checked){const {it}=findItem(key),linked=findLinkedTask(it);if(linked){const base=baseState();base.taskCompletions ||= {};base.taskCompletions[linked.date] ||= {};base.taskCompletions[linked.date][linked.id]=checked;saveBase(base)}it.done=checked;markDirty();renderCurrentPage()}
function openItemDialog(key){commitInlineEdits();const {it}=findItem(key);$('#pageItemKey').value=key;$('#pageItemTitle').value=it.title;$('#pageItemDeadline').value=it.deadline||'';$('#pageItemNote').value=it.note||'';$('#pageItemDialog').showModal()}
function saveItemDialog(e){e.preventDefault();const {it}=findItem($('#pageItemKey').value);it.title=$('#pageItemTitle').value.trim()||it.title;it.deadline=$('#pageItemDeadline').value;it.note=$('#pageItemNote').value.trim();markDirty();$('#pageItemDialog').close();renderCurrentPage()}
function deleteItem(){const {g,it}=findItem($('#pageItemKey').value);if(!confirm('Удалить «'+it.title+'»?'))return;g.items=g.items.filter(i=>i.id!==it.id);markDirty();$('#pageItemDialog').close();renderCurrentPage()}
function openPlanDialog(key){commitInlineEdits();const {it}=findItem(key);$('#pagePlanKey').value=key;$('#pagePlanTitle').textContent=it.title;$('#pagePlanDate').value=it.deadline&&it.deadline>=todayKey()?it.deadline:todayKey();$('#pagePlanMode').value='none';$('#pagePlanTime').value='12:00';$('#pagePlanDuration').value='30';updatePlanMode();$('#pagePlanDialog').showModal()}
function updatePlanMode(){const show=$('#pagePlanMode')?.value!=='none';$('#pagePlanTimeWrap')?.classList.toggle('hidden',!show);$('#pagePlanDurationWrap')?.classList.toggle('hidden',!show)}
function savePlanDialog(e){
  e.preventDefault();const key=$('#pagePlanKey').value,{it}=findItem(key),base=baseState();base.tasks ||= [];base.taskCompletions ||= {};
  if(findLinkedTask(it)){toast('Этот пункт уже в плане');return}
  const mode=$('#pagePlanMode').value,date=$('#pagePlanDate').value,id=uid();
  base.tasks.push({id,title:it.title,date,timeMode:mode,time:mode==='none'?'':$('#pagePlanTime').value,duration:mode==='none'?0:Number($('#pagePlanDuration').value||0),color:'blue',repeat:'none',note:it.note||'',createdAt:Date.now(),pageSource:{pageId:currentPageId,itemId:it.id}});
  base.taskCompletions[date] ||= {};base.taskCompletions[date][id]=!!it.done;saveBase(base);$('#pagePlanDialog').close();toast('Добавлено в план дня');renderCurrentPage()
}
function openBlockDialog(id){
  commitInlineEdits();const b=block(id),d=b.data,base=baseState();$('#pageBlockEditId').value=id;$('#pageBlockEditTitle').textContent='Настройки блока';let h='';
  const input=(label,name,val,type='text')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(val??'')+'"/></label>';
  if(b.type==='text')h=input('Название','title',d.title)+'<label class="full">Текст<textarea name="text" rows="6">'+esc(d.text||'')+'</textarea></label>';
  else if(b.type==='list')h=input('Название','title',d.title)+'<p class="full backup-status">Группы и пункты редактируются прямо на странице.</p>';
  else if(b.type==='heading')h=input('Текст','text',d.text);
  else if(b.type==='progress')h=input('Название','title',d.title)+'<label class="full toggle-row"><input name="auto" type="checkbox" '+(d.auto?'checked':'')+'/>Считать по всем галочкам страницы</label>'+input('Текущее','current',d.current,'number')+input('Цель','target',d.target,'number')+input('Единица','unit',d.unit);
  else if(b.type==='metric')h=input('Название','title',d.title)+input('Значение','value',d.value,'number')+input('Цель','target',d.target,'number')+input('Единица','unit',d.unit);
  else if(b.type==='deadline')h=input('Название','title',d.title)+input('Дата','date',d.date,'date');
  else if(b.type==='habit')h=input('Название блока','title',d.title)+'<label class="full">Привычка<select name="habitId">'+(base.habits||[]).filter(h=>h.active!==false).map(h=>'<option value="'+h.id+'" '+(h.id===d.habitId?'selected':'')+'>'+esc(h.name)+'</option>').join('')+'</select></label>';
  else if(b.type==='linkedTasks')h=input('Название','title',d.title);
  else h='<p class="full backup-status">У этого блока нет дополнительных настроек.</p>';
  $('#pageBlockEditFields').innerHTML=h;$('#pageBlockEditDialog').showModal()
}
function saveBlockDialog(e){
  e.preventDefault();const b=block($('#pageBlockEditId').value),fd=new FormData($('#pageBlockEditForm'));for(const [k,v] of fd.entries()){if(['current','target','value'].includes(k))b.data[k]=v===''?'':Number(v);else b.data[k]=v}if(b.type==='progress')b.data.auto=!!$('#pageBlockEditFields [name=auto]')?.checked;markDirty();$('#pageBlockEditDialog').close();renderCurrentPage()
}
install();
})();