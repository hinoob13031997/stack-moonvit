import {store} from './store.js?v=33';
import {todayView,stacksView,insightsView,profileView,onboardingView,checkinModal,builderModal,dayModal,weeklyReviewModal,experimentResultModal,modal,manageStackModal,actionMenuModal,templatesModal,customActionModal,processModal} from './ui.js?v=33';

const app=document.querySelector('#app'),nav=document.querySelector('.bottom-nav'),toastEl=document.querySelector('#toast'),updateBanner=document.querySelector('#updateBanner');
const views={today:todayView,stacks:stacksView,insights:insightsView,profile:profileView};
let currentView='today',toastTimer,swRegistration=null;

function render(view=currentView){currentView=view;app.innerHTML=views[view]();nav.classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===view));window.scrollTo(0,0)}
function renderOnboarding(){app.innerHTML=onboardingView();nav.classList.add('hidden')}
function toast(text){clearTimeout(toastTimer);toastEl.textContent=text;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1700)}
function syncCalendarDay(){if(!store.syncDay())return false;document.querySelectorAll('.modal-wrap').forEach(item=>item.remove());store.state.onboarded?render():renderOnboarding();toast('Начался новый день');return true}
function syncViewport(){document.documentElement.style.setProperty('--visual-viewport-height',`${window.visualViewport?.height||window.innerHeight}px`)}
function completeOnboarding(){store.install(store.state.goal);store.state.activeStack=store.state.goal;store.state.onboarded=true;store.state.onboardingStep=0;store.save();render('stacks')}

function updateCategoryAdvice(){const title=document.querySelector('#customTitle')?.value||'',selected=document.querySelector('#customStack')?.value,suggested=store.suggestCategory(title),advice=document.querySelector('[data-category-advice]');if(advice)advice.textContent=suggested&&suggested!==selected?(store.state.installed.includes(suggested)?`Похоже, это относится к ${suggested}. Категорию можно изменить.`:`Похоже, это относится к ${suggested}. Сначала добавь эту категорию.`):''}
document.addEventListener('input',event=>{if(event.target.matches('[data-metric]'))document.querySelector(`[data-output="${event.target.dataset.metric}"]`).value=event.target.value;if(event.target.id==='customTitle')updateCategoryAdvice()});
document.addEventListener('change',event=>{if(event.target.id==='customKind'){document.querySelector('[data-steps]')?.classList.toggle('hidden',event.target.value!=='process');return}if(event.target.id==='customSchedule'){document.querySelector('[data-days]')?.classList.toggle('hidden',event.target.value!=='custom');return}if(event.target.id==='customStack'){const hints={SLEEP:'Сон, режим и вечернее восстановление',FOCUS:'Работа, учёба и управление вниманием',TRAIN:'Тренировки, движение и восстановление тела',BALANCE:'Отдых, настроение и снижение перегрузки'};const hint=document.querySelector('[data-category-hint]');if(hint)hint.textContent=hints[event.target.value];updateCategoryAdvice();return}if(!event.target.matches('[data-backup-file]'))return;const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const restored=store.restore(JSON.parse(reader.result));if(!restored)throw new Error('invalid');event.target.closest('.modal-wrap').remove();render('profile');toast('Резервная копия восстановлена')}catch{toast('Не удалось прочитать резервную копию')}};reader.readAsText(file)});

document.addEventListener('click',event=>{
  if(syncCalendarDay())return;
  const target=event.target;
  if(target.closest('[data-reload-update]')){window.location.reload();return}
  if(target.matches('.modal-wrap')){target.remove();return}
  const view=target.closest('[data-view]');if(view){render(view.dataset.view);return}
  const goal=target.closest('[data-goal]');if(goal){store.state.goal=goal.dataset.goal;store.save();renderOnboarding();return}
  if(target.closest('[data-owner-next]')){store.setOwnerName(document.querySelector('#ownerName')?.value);store.state.onboardingStep=1;store.save();renderOnboarding();return}
  if(target.closest('[data-next]')){store.state.onboardingStep=2;store.save();renderOnboarding();return}
  if(target.closest('[data-goal-next]')){store.state.onboardingStep=3;store.save();renderOnboarding();return}
  if(target.closest('[data-onboarding-custom]')){completeOnboarding();customActionModal(store.state.goal);return}
  if(target.closest('[data-onboarding-templates]')){completeOnboarding();templatesModal(store.state.goal);return}
  if(target.closest('[data-onboarding-empty]')){completeOnboarding();render('today');return}
  const task=target.closest('[data-task]');if(task){const action=store.actions().find(a=>a.id===task.dataset.task);if(action?.checkin){checkinModal();return}const done=store.toggle(task.dataset.task);render();toast(done?'Выполнено':'Отметка снята');return}
  const process=target.closest('[data-process]');if(process){processModal(process.dataset.process);return}
  const processStep=target.closest('[data-process-step]');if(processStep){const complete=store.toggleProcessStep(processStep.dataset.processId,processStep.dataset.processStep);processStep.closest('.modal-wrap').remove();processModal(processStep.dataset.processId);if(complete)toast('Процесс выполнен');return}
  const quickStack=target.closest('[data-quick-stack]');if(quickStack){store.activate(quickStack.dataset.quickStack);render('today');return}
  const insightStack=target.closest('[data-insight-stack]');if(insightStack){store.activate(insightStack.dataset.insightStack);render('insights');return}
  const openCheckin=target.closest('[data-open-checkin]');if(openCheckin){checkinModal(openCheckin.dataset.openCheckin);return}
  const save=target.closest('[data-save-checkin]');if(save){const values=Object.fromEntries([...document.querySelectorAll('[data-metric]')].map(input=>[input.dataset.metric,+input.value]));store.saveCheckin(save.dataset.saveCheckin,values);save.closest('.modal-wrap').remove();render();toast('Состояние сохранено');return}
  if(target.closest('[data-reset]')){store.resetToday();render();toast('Отметки текущего стека сброшены');return}
  if(target.closest('[data-dismiss-today-hint]')){store.state.todayHintDismissed=true;store.save();render('today');return}
  const remove=target.closest('[data-remove]');if(remove){event.stopPropagation();modal(`<p class="eyebrow">Удаление</p><h2>Удалить ${remove.dataset.remove} STACK?</h2><p class="subtitle">Сохранённые отметки останутся в истории.</p><button class="danger" data-confirm-remove="${remove.dataset.remove}">Удалить стек</button>`);return}
  const confirmRemove=target.closest('[data-confirm-remove]');if(confirmRemove){store.remove(confirmRemove.dataset.confirmRemove);confirmRemove.closest('.modal-wrap').remove();render('stacks');toast('Стек удалён');return}
  const manage=target.closest('[data-manage]');if(manage){event.stopPropagation();manageStackModal(manage.dataset.manage);return}
  const actionMenu=target.closest('[data-action-menu]');if(actionMenu){actionMenu.closest('.modal-wrap').remove();actionMenuModal(actionMenu.dataset.actionMenu);return}
  const openTemplates=target.closest('[data-open-templates]');if(openTemplates){openTemplates.closest('.modal-wrap').remove();templatesModal(openTemplates.dataset.openTemplates);return}
  const backManage=target.closest('[data-back-manage]');if(backManage){backManage.closest('.modal-wrap').remove();manageStackModal(backManage.dataset.backManage);return}
  const addCustom=target.closest('[data-add-custom]');if(addCustom){addCustom.closest('.modal-wrap').remove();customActionModal(addCustom.dataset.addCustom);return}
  const editCustom=target.closest('[data-edit-custom]');if(editCustom){const action=store.state.customActions.find(item=>item.id===editCustom.dataset.editCustom);editCustom.closest('.modal-wrap').remove();if(action)customActionModal(action.stackCode,action.id);return}
  const moveCustom=target.closest('[data-move-custom]');if(moveCustom){const action=store.state.customActions.find(item=>item.id===moveCustom.dataset.moveCustom);store.moveCustomAction(moveCustom.dataset.moveCustom,Number(moveCustom.dataset.direction));moveCustom.closest('.modal-wrap').remove();if(action)manageStackModal(action.stackCode);return}
  const saveCustom=target.closest('[data-save-custom]');if(saveCustom){const input={stackCode:document.querySelector('#customStack').value,title:document.querySelector('#customTitle').value,kind:document.querySelector('#customKind').value,schedule:document.querySelector('#customSchedule').value,period:document.querySelector('#customPeriod').value,days:[...document.querySelectorAll('[data-days] input:checked')].map(item=>item.value),steps:document.querySelector('#customSteps').value.split('\n')};const saved=saveCustom.dataset.customId?store.updateCustomAction(saveCustom.dataset.customId,input):store.addCustomAction(input);if(!saved){toast('Заполни название, дни и шаги процесса');return}saveCustom.closest('.modal-wrap').remove();manageStackModal(input.stackCode);toast(saveCustom.dataset.customId?'Изменения сохранены':'Действие добавлено');return}
  const toggleCustom=target.closest('[data-toggle-custom]');if(toggleCustom){const action=store.state.customActions.find(item=>item.id===toggleCustom.dataset.toggleCustom);store.toggleCustomAction(toggleCustom.dataset.toggleCustom);toggleCustom.closest('.modal-wrap').remove();if(action)manageStackModal(action.stackCode);toast(action?.pausedAt?'Действие на паузе':'Действие возобновлено');return}
  const deleteCustom=target.closest('[data-delete-custom]');if(deleteCustom){deleteCustom.closest('.modal-wrap').remove();modal(`<p class="eyebrow">Удаление</p><h2>Удалить действие?</h2><p class="subtitle">Прошлые отметки останутся в истории.</p><button class="danger" data-confirm-delete-custom="${deleteCustom.dataset.deleteCustom}">Удалить действие</button>`);return}
  const confirmDelete=target.closest('[data-confirm-delete-custom]');if(confirmDelete){const action=store.state.customActions.find(item=>item.id===confirmDelete.dataset.confirmDelete);store.deleteCustomAction(confirmDelete.dataset.confirmDelete);document.querySelectorAll('.modal-wrap').forEach(item=>item.remove());if(action)manageStackModal(action.stackCode);toast('Действие удалено');return}
  const template=target.closest('[data-template]');if(template){const added=store.toggleTemplate(template.dataset.template);template.closest('.modal-wrap').remove();templatesModal(template.dataset.templateStack);toast(added?'Пример добавлен':'Пример убран');return}
  const activate=target.closest('[data-activate]');if(activate){store.activate(activate.dataset.activate);render('today');toast('Активный стек изменён');return}
  if(target.closest('[data-builder]')){builderModal();return}
  const preset=target.closest('[data-preset]');if(preset){document.querySelectorAll('[data-preset]').forEach(item=>item.classList.remove('selected'));preset.classList.add('selected');const button=document.querySelector('[data-create]');button.dataset.create=preset.dataset.preset;button.textContent=`Добавить ${preset.dataset.preset} STACK`;return}
  const create=target.closest('[data-create]');if(create){const code=create.dataset.create,added=store.install(code);create.closest('.modal-wrap').remove();render('stacks');if(added)manageStackModal(code);toast(added?'Категория добавлена':'Эта категория уже существует');return}
  const date=target.closest('[data-date]');if(date){dayModal(date.dataset.date);return}
  if(target.closest('[data-weekly-review]')){weeklyReviewModal();return}
  if(target.closest('[data-save-weekly]')){store.saveWeeklyReview();target.closest('.modal-wrap').remove();render('insights');toast('Итог недели сохранён');return}
  const weeklyDecision=target.closest('[data-weekly-decision]');if(weeklyDecision){const decision=store.saveWeeklyDecision(store.state.activeStack,weeklyDecision.dataset.weeklyDecision);weeklyDecision.closest('.modal-wrap').remove();render('insights');toast(decision?'Решение на неделю сохранено':'Нужно больше данных');return}
  if(target.closest('[data-weekly-experiment]')){store.startExperiment();target.closest('.modal-wrap').remove();render('insights');toast('Одно улучшение выбрано');return}
  const startExperiment=target.closest('[data-start-experiment]');if(startExperiment){store.startExperiment(store.state.activeStack,startExperiment.dataset.experimentAction||null);render('insights');toast('Эксперимент начат на 3 дня');return}
  if(target.closest('[data-finish-experiment]')){experimentResultModal();return}
  const experimentOutcome=target.closest('[data-experiment-outcome]');if(experimentOutcome){store.finishExperiment(store.state.activeStack,experimentOutcome.dataset.experimentOutcome);experimentOutcome.closest('.modal-wrap').remove();render('insights');toast('Результат эксперимента сохранён');return}
  if(target.closest('[data-toggle-moon]')){store.state.moonConnected=!store.state.moonConnected;store.save();render('profile');toast(store.state.moonConnected?'Moonvit подключён':'Moonvit отключён');return}
  if(target.closest('[data-edit-owner]')){modal(`<p class="eyebrow">Персонализация</p><h2>Как к тебе обращаться?</h2><p class="subtitle">Имя используется только внутри STACK и хранится на этом устройстве.</p><label class="field modal-owner-field">Имя<input id="profileOwnerName" maxlength="40" autocomplete="name" value="${String(store.state.ownerName||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}" placeholder="Можно оставить пустым"></label><button class="primary" data-save-owner>Сохранить</button>`);return}
  if(target.closest('[data-save-owner]')){store.setOwnerName(document.querySelector('#profileOwnerName')?.value);target.closest('.modal-wrap').remove();render('profile');toast('Имя сохранено');return}
  if(target.closest('[data-check-update]')){if(!swRegistration){toast('Обновление недоступно');return}swRegistration.update().then(()=>toast('Проверка обновлений завершена')).catch(()=>toast('Не удалось проверить обновление'));return}
  if(target.closest('[data-export]')){const blob=new Blob([JSON.stringify(store.backup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`stack-moonvit-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('Резервная копия создана');return}
  if(target.closest('[data-import]')){modal('<p class="eyebrow">Восстановление</p><h2>Выбери резервную копию</h2><p class="subtitle">Текущие данные на этом устройстве будут заменены содержимым файла.</p><label class="file-picker">Выбрать файл<input data-backup-file type="file" accept="application/json,.json"></label>');return}
  if(target.closest('[data-close]')){target.closest('.modal-wrap').remove();return}
  if(target.closest('[data-restart]')){store.state.onboarded=false;store.state.onboardingStep=0;store.save();renderOnboarding()}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('.modal-wrap')?.remove()});
document.addEventListener('focusin',event=>{if(!event.target.closest?.('.modal'))return;setTimeout(()=>{if(document.activeElement===event.target)event.target.scrollIntoView({block:'nearest'})},250)});

store.state.onboarded?render():renderOnboarding();
syncViewport();
window.visualViewport?.addEventListener('resize',syncViewport);
window.addEventListener('resize',syncViewport);
window.addEventListener('focus',syncCalendarDay);
window.addEventListener('pageshow',syncCalendarDay);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncCalendarDay()});
window.setInterval(syncCalendarDay,30000);
window.addEventListener('online',()=>{if(currentView==='profile')render('profile');toast('Соединение восстановлено')});
window.addEventListener('offline',()=>{if(currentView==='profile')render('profile');toast('Офлайн-режим: данные сохраняются')});
if('serviceWorker'in navigator){let hadController=Boolean(navigator.serviceWorker.controller);navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController)updateBanner.classList.remove('hidden');hadController=true});window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=33').then(registration=>{swRegistration=registration;registration.update().catch(()=>{})}).catch(()=>{}))}
