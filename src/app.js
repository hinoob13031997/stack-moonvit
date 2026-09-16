import {store} from './store.js';
import {todayView,stacksView,insightsView,profileView,onboardingView,checkinModal,builderModal,dayModal,modal} from './ui.js';

const app=document.querySelector('#app'),nav=document.querySelector('.bottom-nav'),toastEl=document.querySelector('#toast');
const views={today:todayView,stacks:stacksView,insights:insightsView,profile:profileView};
let currentView='today',toastTimer;

function render(view=currentView){currentView=view;app.innerHTML=views[view]();nav.classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===view));window.scrollTo(0,0)}
function renderOnboarding(){app.innerHTML=onboardingView();nav.classList.add('hidden')}
function toast(text){clearTimeout(toastTimer);toastEl.textContent=text;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1700)}

document.addEventListener('input',event=>{if(event.target.matches('[data-metric]'))document.querySelector(`[data-output="${event.target.dataset.metric}"]`).value=event.target.value});

document.addEventListener('click',event=>{
  const target=event.target;
  const view=target.closest('[data-view]');if(view){render(view.dataset.view);return}
  const goal=target.closest('[data-goal]');if(goal){store.state.goal=goal.dataset.goal;store.save();renderOnboarding();return}
  if(target.closest('[data-next]')){store.state.onboardingStep=1;store.save();renderOnboarding();return}
  const moon=target.closest('[data-moon]');if(moon){store.state.moonConnected=moon.dataset.moon==='yes';store.state.onboardingStep=2;store.save();renderOnboarding();return}
  if(target.closest('[data-finish]')){store.install(store.state.goal);store.state.activeStack=store.state.goal;store.state.onboarded=true;store.state.onboardingStep=0;store.save();render();return}
  const task=target.closest('[data-task]');if(task){const action=store.actions().find(a=>a.id===task.dataset.task);if(action?.checkin){checkinModal();return}const done=store.toggle(task.dataset.task);render();toast(done?'Выполнено':'Отметка снята');return}
  const quickStack=target.closest('[data-quick-stack]');if(quickStack){store.activate(quickStack.dataset.quickStack);render('today');return}
  const save=target.closest('[data-save-checkin]');if(save){const values=Object.fromEntries([...document.querySelectorAll('[data-metric]')].map(input=>[input.dataset.metric,+input.value]));store.saveCheckin(save.dataset.saveCheckin,values);save.closest('.modal-wrap').remove();render();toast('Состояние сохранено');return}
  if(target.closest('[data-reset]')){store.resetToday();render();toast('Отметки текущего стека сброшены');return}
  const remove=target.closest('[data-remove]');if(remove){event.stopPropagation();modal(`<p class="eyebrow">Удаление</p><h2>Удалить ${remove.dataset.remove} STACK?</h2><p class="subtitle">Сохранённые отметки останутся в истории.</p><button class="danger" data-confirm-remove="${remove.dataset.remove}">Удалить стек</button>`);return}
  const confirmRemove=target.closest('[data-confirm-remove]');if(confirmRemove){store.remove(confirmRemove.dataset.confirmRemove);confirmRemove.closest('.modal-wrap').remove();render('stacks');toast('Стек удалён');return}
  const activate=target.closest('[data-activate]');if(activate){store.activate(activate.dataset.activate);render('today');toast('Активный стек изменён');return}
  if(target.closest('[data-builder]')){builderModal();return}
  const preset=target.closest('[data-preset]');if(preset){document.querySelectorAll('[data-preset]').forEach(item=>item.classList.remove('selected'));preset.classList.add('selected');const button=document.querySelector('[data-create]');button.dataset.create=preset.dataset.preset;button.textContent=`Добавить ${preset.dataset.preset} STACK`;return}
  const create=target.closest('[data-create]');if(create){const added=store.install(create.dataset.create);create.closest('.modal-wrap').remove();render('stacks');toast(added?'Новый стек добавлен':'Этот стек уже существует');return}
  const date=target.closest('[data-date]');if(date){dayModal(date.dataset.date);return}
  if(target.closest('[data-close]')){target.closest('.modal-wrap').remove();return}
  if(target.closest('[data-restart]')){store.state.onboarded=false;store.state.onboardingStep=0;store.save();renderOnboarding()}
});

store.state.onboarded?render():renderOnboarding();
