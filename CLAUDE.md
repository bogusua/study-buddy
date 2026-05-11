# CLAUDE.md — Study Buddy

## Що це за проект

Chrome Extension (Manifest V3, side panel) для підготовки дитини до вступного іспиту в ліцей.
Це **не навчання з нуля** — симуляція іспиту. Учень вже знає матеріал, додаток перевіряє готовність.

Детальніше: `STUDY_BUDDY_TZ.md`, `USER_FLOW.md`, `ROADMAP.md`

---

## Стек і обмеження

- **Vanilla JS** — без фреймворків, без npm, без build-степу
- **Gemini API** — модель через `config/settings.json` (`model`)
- **Без бекенду** — тільки localStorage + sessionStorage
- Запуск виключно як Chrome Extension (не через file://)

---

## Ключова логіка

**`targetGrade`** — клас вступу (наприклад, 8).
Питання генеруються в межах програми **1–(targetGrade-1)** класів.
Учень не може знати матеріал класу в який він ще тільки вступає.

**API key** — зберігається в `config/settings.json`, не вводиться користувачем.
Якщо порожній — системне попередження, далі не йде.

---

## Структура файлів

```
manifest.json         # MV3, permissions: sidePanel + tabs
background.js         # openPanelOnActionClick
side_panel.html       # єдиний UI
style.css
js/
  app.js              # flow: init → subject → topic → quiz → complete
  gemini.js           # generateQuestions + checkAnswer
  quiz.js             # сесія, recordAnswer, finish
  storage.js          # обгортки над localStorage/sessionStorage
  ui.js               # addBot, addUser, addSystem, showTyping
subjects/
  math.json           # { name, topics: [{ id, name, grade }] }
  ukrainian.json
config/
  settings.json       # apiKey, studentName, targetGrade, questionsPerSession, model
icons/                # 16, 48, 128px PNG
```

---

## Правила роботи з кодом

- Не додавати залежності, бібліотеки, npm пакети
- Не створювати нові файли без потреби — розширювати існуючі
- `ui.js` — тільки DOM. Бізнес-логіка не належить сюди
- `app.js` — orchestrator flow, не містить прямих API-викликів
- Помилки Gemini API показувати через `UI.addBot(...)` з кнопкою повтору

---

## Документи — підтримувати актуальність

Вимоги змінюються в процесі. Після кожної зміни рішення або реалізації —
**проактивно перевіряти** ці три файли і оновлювати якщо є розбіжності:

- `STUDY_BUDDY_TZ.md` — концепція, стек, промпти, формати даних
- `ROADMAP.md` — позначати виконане, додавати нові пункти
- `USER_FLOW.md` — реальний флоу від учня, відображає поточну реалізацію
- `HELP_TEXT` в `js/app.js` — користувацька довідка що відображається в чаті; оновлювати при зміні функціональності

Після суттєвих змін (нова логіка, зміна вимог, новий флоу) — нагадати юзеру і запитати підтвердження на оновлення документів. Дрібні правки коду цього не потребують.
