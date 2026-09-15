export const STACK_LIBRARY = {
  SLEEP: {
    code: 'SLEEP', title: 'Сон и восстановление', icon: '◐', removable: false,
    actions: [
      {id:'sleep-moon', title:'Принять Moonvit Moon', meta:'Вечер · SLEEP STACK', product:true},
      {id:'sleep-checkin', title:'Оценить сон и энергию', meta:'2 коротких вопроса', checkin:true},
      {id:'sleep-screen', title:'Без экрана перед сном', meta:'30 минут · дисциплина'},
      {id:'sleep-bed', title:'Лечь до выбранного времени', meta:'До 00:00 · SLEEP STACK'}
    ]
  },
  FOCUS: {code:'FOCUS',title:'Фокус и энергия',icon:'↗',removable:true,actions:[
    {id:'focus-session',title:'Фокус-сессия 45 минут',meta:'FOCUS STACK'},
    {id:'focus-phone',title:'Телефон вне зоны работы',meta:'FOCUS STACK'},
    {id:'focus-checkin',title:'Оценить концентрацию',meta:'FOCUS STACK'}]},
  TRAIN: {code:'TRAIN',title:'Тренировки и восстановление',icon:'⌁',removable:true,actions:[
    {id:'train-session',title:'Выполнить тренировку',meta:'TRAIN STACK'},
    {id:'train-warmup',title:'Разминка и заминка',meta:'TRAIN STACK'},
    {id:'train-checkin',title:'Оценить восстановление',meta:'TRAIN STACK'}]},
  BALANCE: {code:'BALANCE',title:'Баланс и состояние',icon:'○',removable:true,actions:[
    {id:'balance-screen',title:'Пауза без экрана',meta:'BALANCE STACK'},
    {id:'balance-walk',title:'Короткая прогулка',meta:'BALANCE STACK'},
    {id:'balance-checkin',title:'Оценить настроение',meta:'BALANCE STACK'}]}
};

export const TODAY = () => new Date().toISOString().slice(0,10);
export const formatDay = date => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`));
export const longToday = () => new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
