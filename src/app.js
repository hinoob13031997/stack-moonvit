import {store} from './store.js';
import {todayView,stacksView,insightsView,profileView,onboardingView,checkinModal,builderModal,dayModal,modal,manageStackModal,customActionModal,processModal} from './ui.js';

const app=document.querySelector('#app'),nav=document.querySelector('.bottom-nav'),toastEl=document.querySelector('#toast');
const views={today:todayView,stacks:stacksView,insights:insightsView,profile:profileView};
let currentView='today',toastTimer;

function render(view=currentView){currentView=view;app.innerHTML=views[view]();nav.classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===view));window.scrollTo(0,0)}
function renderOnboarding(){app.innerHTML=onboardingView();nav.classList.add('hidden')}
function toast(text){clearTimeout(toastTimer);toastEl.textContent=text;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1700)}

document.addEventListener('input',event=>{if(event.target.matches('[data-metric]'))document.querySelector(`[data-output="${event.target.dataset.metric}"]`).value=event.target.value});
document.addEventListener('change',event=>{if(event.target.id==='customKind'){document.querySelector('[data-steps]')?.classList.toggle('hidden',event.target.value!=='process');return}if(event.target.id==='customSchedule'){document.querySelector('[data-days]')?.classList.toggle('hidden',event.target.value!=='custom');return}if(!event.target.matches('[data-backup-file]'))return;const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const restored=store.restore(JSON.parse(reader.result));if(!restored)throw new Error('invalid');event.target.closest('.modal-wrap').remove();render('profile');toast('Резервная копия восстановлена')}catch{toast('Не удалось прочитать резервную копию')}};reader.readAsText(file)});

document.addEventListener('click',event=>{
  const target=event.target;
  const view=target.closest('[data-view]');if(view){render(view.dataset.view);return}
  const goal=target.closest('[data-goal]');if(goal){store.state.goal=goal.dataset.goal;store.save();renderOnboarding();return}
  if(target.closest('[data-next]')){store.state.onboardingStep=1;store.save();renderOnboarding();return}
  const moon=target.closest('[data-moon]');if(moon){store.state.moonConnected=moon.dataset.moon==='yes';store.state.onboardingStep=2;store.save();renderOnboarding();return}
  if(target.closest('[data-finish]')){store.install(store.state.goal);store.state.activeStack=store.state.goal;store.state.onboarded=true;store.state.onboardingStep=0;store.save();render();return}
  const task=target.closest('[data-task]');if(task){const action=store.actions().find(a=>a.id===task.dataset.task);if(action?.checkin){checkinModal();return}const done=store.toggle(task.dataset.task);render();toast(done?'Выполнено':'Отметка снята');return}
  const process=target.closest('[data-process]');if(process){processModal(process.dataset.process);return}
  const processStep=target.closest('[data-process-step]');if(processStep){const complete=store.toggleProcessStep(processStep.dataset.processId,processStep.dataset.processStep);processStep.closest('.modal-wrap').remove();processModal(processStep.dataset.processId);if(complete)toast('Процесс выполнен');return}
  const quickStack=target.closest('[data-quick-stack]');if(quickStack){store.activate(quickStack.dataset.quickStack);render('today');return}
  const insightStack=target.closest('[data-insight-stack]');if(insightStack){store.activate(insightStack.dataset.insightStack);render('insights');return}
  const save=target.closest('[data-save-checkin]');if(save){const values=Object.fromEntries([...document.querySelectorAll('[data-metric]')].map(input=>[input.dataset.metric,+input.value]));store.saveCheckin(save.dataset.saveCheckin,values);save.closest('.modal-wrap').remove();render();toast('Состояние сохранено');return}
  if(target.closest('[data-reset]')){store.resetToday();render();toast('Отметки текущего стека сброшены');return}
  const remove=target.closest('[data-remove]');if(remove){event.stopPropagation();modal(`<p class="eyebrow">Удаление</p><h2>Удалить ${remove.dataset.remove} STACK?</h2><p class="subtitle">Сохранённые отметки останутся в истории.</p><button class="danger" data-confirm-remove="${remove.dataset.remove}">Удалить стек</button>`);return}
  const confirmRemove=target.closest('[data-confirm-remove]');if(confirmRemove){store.remove(confirmRemove.dataset.confirmRemove);confirmRemove.closest('.modal-wrap').remove();render('stacks');toast('Стек удалён');return}
  const manage=target.closest('[data-manage]');if(manage){event.stopPropagation();manageStackModal(manage.dataset.manage);return}
  const addCustom=target.closest('[data-add-custom]');if(addCustom){addCustom.closest('.modal-wrap').remove();customActionModal(addCustom.dataset.addCustom);return}
  const editCustom=target.closest('[data-edit-custom]');if(editCustom){const action=store.state.customActions.find(item=>item.id===editCustom.dataset.editCustom);editCustom.closest('.modal-wrap').remove();if(action)customActionModal(action.stackCode,action.id);return}
  const saveCustom=target.closest('[data-save-custom]');if(saveCustom){const input={stackCode:saveCustom.dataset.stackCode,title:document.querySelector('#customTitle').value,kind:document.querySelector('#customKind').value,schedule:document.querySelector('#customSchedule').value,period:document.querySelector('#customPeriod').value,days:[...document.querySelectorAll('[data-days] input:checked')].map(item=>item.value),steps:document.querySelector('#customSteps').value.split('\n')};const saved=saveCustom.dataset.customId?store.updateCustomAction(saveCustom.dataset.customId,input):store.addCustomAction(input);if(!saved){toast('Заполни название, дни и шаги процесса');return}saveCustom.closest('.modal-wrap').remove();manageStackModal(input.stackCode);toast(saveCustom.dataset.customId?'Изменения сохранены':'Действие добавлено');return}
  const toggleCustom=target.closest('[data-toggle-custom]');if(toggleCustom){const action=store.state.customActions.find(item=>item.id===toggleCustom.dataset.toggleCustom);store.toggleCustomAction(toggleCustom.dataset.toggleCustom);toggleCustom.closest('.modal-wrap').remove();if(action)manageStackModal(action.stackCode);toast(action?.pausedAt?'Действие на паузе':'Действие возобновлено');return}
  const deleteCustom=target.closest('[data-delete-custom]');if(deleteCustom){modal(`<p class="eyebrow">Удаление</p><h2>Удалить действие?</h2><p class="subtitle">Прошлые отметки останутся в истории.</p><button class="danger" data-confirm-delete-custom="${deleteCustom.dataset.deleteCustom}">Удалить действие</button>`);return}
  const confirmDelete=target.closest('[data-confirm-delete-custom]');if(confirmDelete){const action=store.state.customActions.find(item=>item.id===confirmDelete.dataset.confirmDelete);store.deleteCustomAction(confirmDelete.dataset.confirmDelete);document.querySelectorAll('.modal-wrap').forEach(item=>item.remove());if(action)manageStackModal(action.stackCode);toast('Действие удалено');return}
  const activate=target.closest('[data-activate]');if(activate){store.activate(activate.dataset.activate);render('today');toast('Активный стек изменён');return}
  if(target.closest('[data-builder]')){builderModal();return}
  const preset=target.closest('[data-preset]');if(preset){document.querySelectorAll('[data-preset]').forEach(item=>item.classList.remove('selected'));preset.classList.add('selected');const button=document.querySelector('[data-create]');button.dataset.create=preset.dataset.preset;button.textContent=`Добавить ${preset.dataset.preset} STACK`;return}
  const create=target.closest('[data-create]');if(create){const added=store.install(create.dataset.create);create.closest('.modal-wrap').remove();render('stacks');toast(added?'Новый стек добавлен':'Этот стек уже существует');return}
  const date=target.closest('[data-date]');if(date){dayModal(date.dataset.date);return}
  if(target.closest('[data-start-experiment]')){store.startExperiment();render('insights');toast('Эксперимент начат на 3 дня');return}
  if(target.closest('[data-finish-experiment]')){store.finishExperiment();render('insights');toast('Эксперимент завершён');return}
  if(target.closest('[data-toggle-moon]')){store.state.moonConnected=!store.state.moonConnected;store.save();render('profile');toast(store.state.moonConnected?'Moonvit подключён':'Moonvit отключён');return}
  if(target.closest('[data-export]')){const blob=new Blob([JSON.stringify(store.backup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`stack-moonvit-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('Резервная копия создана');return}
  if(target.closest('[data-import]')){modal('<p class="eyebrow">Восстановление</p><h2>Выбери резервную копию</h2><p class="subtitle">Текущие данные на этом устройстве будут заменены содержимым файла.</p><label class="file-picker">Выбрать файл<input data-backup-file type="file" accept="application/json,.json"></label>');return}
  if(target.closest('[data-close]')){target.closest('.modal-wrap').remove();return}
  if(target.closest('[data-restart]')){store.state.onboarded=false;store.state.onboardingStep=0;store.save();renderOnboarding()}
});

store.state.onboarded?render():renderOnboarding();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=11').catch(()=>{}));
