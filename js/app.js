// Default config — overridden by config/settings.json
const DEFAULT_CONFIG = {
  model: 'gemini-3.1-flash-lite-preview',
  targetGrade: 8,
  questionsPerSession: 7,
  essaySize: 'medium',
  useNano: false
};

let config = { ...DEFAULT_CONFIG };
let subjects = {};
let lastSubjectKey = null;
let lastExamContext = null;
let freeChatActive = false;
let helpChatActive = false;
let _blockedOnSettings = false;
let _continueOnUnblock = false;

const HELP_TEXT = `Study Buddy — довідка

ЯК ПОЧАТИ
Обери предмет → отримай іспит → відповідай текстом → Gemini оцінює кожну відповідь.

ПІД ЧАС ІСПИТУ
• Відповідай своїми словами у полі знизу
• Enter — надіслати, Shift+Enter — новий рядок
• "далі →" — пропустити питання (рахується як помилка)
• "Не згоден" — оскаржити оцінку з аргументом
• "Поясни детальніше" — розгорнуте пояснення (активується після іспиту)
• Таймер і прогрес-бар у рядку під шапкою
• Кнопки довідки, статистики і налаштувань заблоковані — щоб не відволікатись

ПІСЛЯ ІСПИТУ
• "Новий іспит" — ще раз той самий предмет
• "Слабкі теми" — іспит тільки по темах де є помилки (з'являється коли по темі набирається ≥3 відповіді з результатом < 75%)
• "Змінити предмет" — вибрати інший предмет
• Чат залишається активним — можна запитати про будь-яке питання з іспиту

СЛАБКІ ТЕМИ
Тема вважається слабкою якщо правильних відповідей менше 75% (мінімум 3 відповіді по темі).
Режим генерує іспит саме по цих темах. Результати впливають на оцінку теми.

СТАТИСТИКА (кнопка 📊)
• Вкладка "Іспити" — графік результатів по сесіях
• Вкладка "Теми" — прогрес по кожній темі з порогом 75%
• Секція "По учнях" — результати в розрізі імен
• Кнопки очищення по предмету або повністю

НАЛАШТУВАННЯ (кнопка ⚙️)
• Тема оформлення (Авто / Світла / Темна) і розмір шрифта
• API ключ Gemini, ім'я учня, клас вступу, питань за сесію, розмір есе, модель, Gemini Nano
• Банк питань — кількість питань у пулі, кнопка скидання

БАНК ПИТАНЬ
Питання генеруються наперед (кількість питань у сесії × 10) і перемішуються щоразу.
Кожне питання показується не більше 3 разів, після чого банк поповнюється новими питаннями.
Есе генерується свіже щоразу.`;

async function loadConfig() {
  // 1. localStorage має пріоритет
  const saved = Storage.getSettings();
  if (saved && Object.keys(saved).length > 0) {
    config = { ...DEFAULT_CONFIG, ...saved };
    return;
  }
  // 2. Міграція з settings.json → localStorage
  try {
    const res = await fetch(chrome.runtime.getURL('config/settings.json'));
    const json = await res.json();
    config = { ...DEFAULT_CONFIG, ...json };
    Storage.saveSettings(config);
  } catch {
    // settings.json відсутній — залишаємо DEFAULT_CONFIG
  }
}

async function loadSubjects() {
  const files = ['math', 'ukrainian'];
  await Promise.all(files.map(async key => {
    try {
      const res = await fetch(chrome.runtime.getURL(`subjects/${key}.json`));
      subjects[key] = await res.json();
    } catch {
      // skip missing subject files
    }
  }));
}

// ─── Flow ────────────────────────────────────────────────────────────────────

async function init() {
  UI.init();
  UI.setInputEnabled(false);
  Settings.init();
  Stats.init();
  document.getElementById('btn-help').addEventListener('click', showHelp);

  UI.setMessageLogger((type, text) => Storage.appendChatMessage({ type, text }));
  Settings.onSave = afterSettingsSaved;

  await Promise.all([loadConfig(), loadSubjects()]);

  if (config.useNano) await Nano.init();

  const chatLog = Storage.getChatLog();
  if (chatLog.length > 0) {
    // Відновлюємо чат без логування (лише DOM)
    UI._suppressLog = true;
    chatLog.forEach(m => {
      if (m.type === 'bot') UI.addBot(m.text);
      else if (m.type === 'user') UI.addUser(m.text);
    });
    UI._suppressLog = false;

    // Питаємо — продовжити чи заново (цей меседж не логуємо)
    UI._suppressLog = true;
    UI.addBot('Продовжити попередній сеанс чи почати заново?', {
      buttons: [
        { label: 'Продовжити', onClick: () => continueSession() },
        { label: 'Почати заново', onClick: () => freshStart() }
      ]
    });
    UI._suppressLog = false;
  } else {
    await freshStart();
  }
}

async function freshStart() {
  Storage.clearChatLog();
  Storage.clearSessionState();
  UI.clearMessages();

  const nameGreet = config.studentName ? `, ${config.studentName}` : '';
  UI.addBot(`Привіт${nameGreet}! Я Study Buddy 👋\nГотуємось до вступу в ${config.targetGrade} клас. Обирай предмет — і починаємо!`);

  _continueOnUnblock = false;
  if (!checkSettings()) return;
  await startSubjectSelection();
}

// Повертає true якщо можна рухатись далі, false якщо заблоковано на ключі
function checkSettings() {
  if (!config.apiKey) {
    _blockedOnSettings = true;
    UI.addSystem('⚠️ API ключ не налаштовано. Відкрий ⚙️ Налаштування щоб додати ключ.');
    Settings.open();
    return false;
  }
  _blockedOnSettings = false;
  if (!config.studentName) {
    UI.addSystem('💡 Вкажи ім\'я учня в ⚙️ Налаштуваннях — відповіді будуть персоналізованими.');
  }
  return true;
}

async function afterSettingsSaved() {
  if (!_blockedOnSettings) return; // налаштування змінили в звичайному режимі
  if (!config.apiKey) return;      // ключ досі не вказано

  _blockedOnSettings = false;

  if (!config.studentName) {
    UI.addSystem('💡 Вкажи ім\'я учня в ⚙️ Налаштуваннях — відповіді будуть персоналізованими.');
  }

  if (_continueOnUnblock) {
    _continueOnUnblock = false;
    await _proceedAfterSettings(Storage.getSessionState());
  } else {
    await startSubjectSelection();
  }
}

async function continueSession() {
  const state = Storage.getSessionState();

  if (state?.subjectKey) lastSubjectKey = state.subjectKey;
  if (state?.examContext) lastExamContext = state.examContext;

  // Показуємо статус попередньої сесії
  if (state?.phase === 'exam_complete') {
    const subject = subjects[state.subjectKey];
    UI.addSystem(subject ? `Попередній іспит з "${subject.name}" завершено.` : 'Попередній іспит завершено.');
  } else if (state?.phase === 'exam_active') {
    const subject = subjects[state?.subjectKey];
    UI.addSystem(subject ? `Попередній іспит з "${subject.name}" перервався.` : 'Попередній іспит перервався.');
  }

  _continueOnUnblock = true;
  if (!checkSettings()) return;
  _continueOnUnblock = false;

  await _proceedAfterSettings(state);
}

async function _proceedAfterSettings(state) {
  if (!state || state.phase === 'subject_selection' || !state.subjectKey) {
    await startSubjectSelection();
    return;
  }

  if (state.phase === 'exam_complete') {
    const weakTopics = getWeakTopics(state.subjectKey);
    UI.showHeaderActions(
      () => startExam(state.subjectKey),
      () => { disableFreeChat(); UI.hideHeaderActions(); startSubjectSelection(); },
      weakTopics.length > 0 ? () => startWeakExam(state.subjectKey) : null
    );
    if (state.examContext) {
      UI.addSystem('💬 Можеш запитати про будь-яке питання з іспиту — я поясню.');
      enableFreeChat();
    }
  } else if (state.phase === 'exam_active') {
    UI.showHeaderActions(
      () => startExam(state.subjectKey),
      () => { UI.hideHeaderActions(); startSubjectSelection(); },
      null
    );
  } else {
    await startSubjectSelection();
  }
}

async function startSubjectSelection() {
  Storage.saveSessionState({ phase: 'subject_selection', subjectKey: lastSubjectKey });

  const subjectKeys = Object.keys(subjects);
  if (subjectKeys.length === 0) {
    UI.addBot('Не вдалося завантажити предмети. Перевір файли subjects/');
    return;
  }

  UI.addBot('Який предмет обираємо сьогодні?', {
    buttons: subjectKeys.map(key => ({
      label: subjects[key].name,
      value: key,
      onClick: (val) => startExam(val)
    }))
  });
}

async function startExam(subjectKey) {
  disableFreeChat();
  disableHelpChat();
  UI.hideHeaderActions();
  UI.hideStopwatch();
  lastSubjectKey = subjectKey;
  Storage.saveSessionState({ phase: 'exam_active', subjectKey });
  UI.lockHeader();
  const subject = subjects[subjectKey];
  const knownGrade = config.targetGrade - 1;
  const eligibleTopics = subject.topics.filter(t => t.grade <= knownGrade);

  UI.addUser(subject.name);
  UI.addBot(`Формую іспит з ${subject.name.toLowerCase()}...`);
  UI.showTyping();

  let questions;
  try {
    const pool = await ensurePool(subjectKey, subject, eligibleTopics);
    const regularCount = subject.hasEssay ? config.questionsPerSession - 1 : config.questionsPerSession;
    questions = pickFromPool(pool.questions, regularCount);

    if (subject.hasEssay) {
      const essay = await Gemini.generateEssayQuestion(
        config.apiKey, config.model, subject, config.targetGrade, config.essaySize
      );
      questions.push(essay);
    }
  } catch (err) {
    UI.unlockHeader();
    UI.addBot(`Помилка підготовки іспиту: ${err.message}\n\nПеревір API key і спробуй ще раз.`);
    UI.addBot('Спробувати ще раз?', {
      buttons: [{ label: 'Так', onClick: () => startExam(subjectKey) }]
    });
    return;
  }

  Quiz.start(subjectKey, subject.name, questions, config.studentName);
  UI.startStopwatch();
  await askNextQuestion();
}

async function askNextQuestion() {
  if (Quiz.isFinished()) {
    await finishExam();
    return;
  }

  const q = Quiz.currentQuestion();
  const num = Quiz.session.current + 1;
  const total = Quiz.session.questions.length;
  const isEssay = q.type === 'essay';
  const prefix = isEssay ? `✍️ Завдання ${num}/${total} — есе:` : `Питання ${num}/${total}:`;

  UI.setProgress(Quiz.progress());
  UI.addBot(`${prefix}\n\n${q.question}`, { skipBtn: !isEssay });

  const answer = await waitForInput();

  if (answer === null) {
    // Skipped
    await evaluateAnswer(null, true);
  } else {
    UI.addUser(answer);
    UI.setInputEnabled(false);
    await evaluateAnswer(answer, false);
  }
}

async function evaluateAnswer(studentAnswer, isSkipped) {
  const q = Quiz.currentQuestion();

  let result;
  if (isSkipped) {
    result = { correct: false, explanation: `Правильна відповідь: ${q.answer}` };
  } else {
    UI.showTyping();
    try {
      result = q.type === 'essay'
        ? await Gemini.evaluateEssay(config.apiKey, config.model, q.question, studentAnswer, config.targetGrade, config.studentName)
        : await Gemini.checkAnswer(config.apiKey, config.model, q.question, q.answer, studentAnswer, config.targetGrade, config.studentName);
    } catch (err) {
      UI.addBot(`Помилка перевірки відповіді: ${err.message}`);
      result = { correct: false, explanation: 'Не вдалося перевірити відповідь.' };
    }
  }

  const icon = result.correct ? '✅' : '❌';
  let explanationText = `${icon} ${result.explanation}`;
  if (!result.correct && q.hint) explanationText += `\n\n💡 ${q.hint}`;

  UI.addExplanation({
    text: explanationText,
    correct: result.correct,
    showDispute: !isSkipped && !result.correct && q.type !== 'essay',
    onDispute: (argument) => Gemini.disputeAnswer(
      config.apiKey, config.model,
      q.question, q.answer, studentAnswer, argument, config.targetGrade, config.studentName
    ),
    onExplain: () => Gemini.explainQuestion(
      config.apiKey, config.model, q.question, q.answer, config.targetGrade
    ),
    onTopicChat: (message) => Gemini.chatOnTopic(
      config.apiKey, config.model, q.question, q.answer, message, config.targetGrade
    ),
    onScoreUpdate: () => { if (Quiz.session) Quiz.session.correct++; }
  });

  Quiz.recordAnswer(result.correct, isSkipped);
  await askNextQuestion();
}

async function finishExam() {
  // Зберігаємо контекст до того як Quiz.finish() очистить сесію
  lastExamContext = {
    subjectName: Quiz.session.subjectName,
    questions: Quiz.session.questions
  };
  Storage.saveSessionState({ phase: 'exam_complete', subjectKey: lastSubjectKey, examContext: lastExamContext });

  // Зберігаємо до Quiz.finish() який очищає сесію
  const poolQuestions = Quiz.session.questions.filter(q => q.type !== 'essay');
  const questionResults = [...Quiz.session.questionResults];

  updatePoolUsedCounts(lastSubjectKey, poolQuestions);
  Storage.updateTopicScores(lastSubjectKey, config.targetGrade, questionResults);

  const elapsed = UI.getStopwatchTime();
  const elapsedSec = UI.getStopwatchSeconds();
  UI.stopStopwatch();
  const { correct, total } = Quiz.finish(elapsedSec);
  const pct = Math.round((correct / total) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪';
  const nameFin = config.studentName ? `, ${config.studentName}` : '';

  UI.setProgress(1);
  UI.addBot(`${emoji} Іспит завершено${nameFin}!\n\nПравильних відповідей: ${correct} з ${total} (${pct}%)\nЧас: ${elapsed}`);

  UI.unlockHeader();
  UI.enableExplainButtons();

  const weakTopics = getWeakTopics(lastSubjectKey);
  UI.showHeaderActions(
    () => startExam(lastSubjectKey),
    () => { disableFreeChat(); UI.hideHeaderActions(); startSubjectSelection(); },
    weakTopics.length > 0 ? () => startWeakExam(lastSubjectKey) : null
  );

  UI.addSystem('💬 Можеш запитати про будь-яке питання з іспиту — я поясню.');
  enableFreeChat();
}

// ─── Question pool ───────────────────────────────────────────────────────────

function isPoolExhausted(pool) {
  return pool.questions.length > 0 && pool.questions.every(q => q.usedCount >= 3);
}

function pickFromPool(questions, count) {
  const groups = {};
  questions.forEach((q, idx) => {
    if (!groups[q.usedCount]) groups[q.usedCount] = [];
    groups[q.usedCount].push(idx);
  });

  const sortedCounts = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const selected = [];

  for (const cnt of sortedCounts) {
    if (selected.length >= count) break;
    const arr = groups[cnt];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    selected.push(...arr.slice(0, count - selected.length));
  }

  // Final shuffle
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected.map(idx => questions[idx]);
}

async function ensurePool(subjectKey, subject, eligibleTopics) {
  const POOL_SIZE = config.questionsPerSession * 10;
  let pool = Storage.getPool(subjectKey, config.targetGrade);

  if (!pool) {
    const questions = await Gemini.generatePool(
      config.apiKey, config.model, subject, eligibleTopics, config.targetGrade, POOL_SIZE, []
    );
    pool = { questions: questions.map(q => ({ ...q, usedCount: 0 })), resetDone: false };
    Storage.savePool(subjectKey, config.targetGrade, pool);
    return pool;
  }

  if (isPoolExhausted(pool)) {
    if (!pool.resetDone) {
      pool.questions.forEach(q => q.usedCount = 0);
      pool.resetDone = true;
      Storage.savePool(subjectKey, config.targetGrade, pool);
    } else {
      const existingTexts = pool.questions.map(q => q.question);
      const newQuestions = await Gemini.generatePool(
        config.apiKey, config.model, subject, eligibleTopics, config.targetGrade, POOL_SIZE, existingTexts
      );
      newQuestions.forEach(q => pool.questions.push({ ...q, usedCount: 0 }));
      pool.resetDone = false;
      Storage.savePool(subjectKey, config.targetGrade, pool);
    }
  }

  return pool;
}

function updatePoolUsedCounts(subjectKey, usedQuestions) {
  const pool = Storage.getPool(subjectKey, config.targetGrade);
  if (!pool) return;
  const usedTexts = new Set(usedQuestions.map(q => q.question));
  pool.questions.forEach(q => { if (usedTexts.has(q.question)) q.usedCount++; });
  Storage.savePool(subjectKey, config.targetGrade, pool);
}

// ─── Weak topics ─────────────────────────────────────────────────────────────

const WEAK_THRESHOLD = 0.75;
const WEAK_MIN_ANSWERS = 3;

function getWeakTopics(subjectKey) {
  const scores = Storage.getTopicScores(subjectKey, config.targetGrade);
  return Object.entries(scores)
    .filter(([, s]) => s.total >= WEAK_MIN_ANSWERS && (s.correct / s.total) < WEAK_THRESHOLD)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .map(([name]) => ({ name }));
}

async function startWeakExam(subjectKey) {
  const weakTopics = getWeakTopics(subjectKey);
  if (weakTopics.length === 0) {
    UI.addBot('Немає тем зі слабкими результатами — все чудово!');
    return;
  }

  disableFreeChat();
  lastSubjectKey = subjectKey;
  const subject = subjects[subjectKey];

  UI.addUser('Слабкі теми');
  const topicList = weakTopics.map(t => `• ${t.name}`).join('\n');
  UI.addBot(
    `Ось теми де найбільше помилок з ${subject.name.toLowerCase()}:\n\n${topicList}`,
    { buttons: [{ label: 'Сформувати іспит', onClick: () => _runWeakExam(subjectKey, weakTopics) }] }
  );
}

async function _runWeakExam(subjectKey, weakTopics) {
  UI.hideStopwatch();
  const subject = subjects[subjectKey];
  UI.addBot(`Формую іспит по слабких темах з ${subject.name.toLowerCase()}...`);
  UI.showTyping();

  let questions;
  try {
    questions = await Gemini.generatePool(
      config.apiKey,
      config.model,
      subject,
      weakTopics,
      config.targetGrade,
      config.questionsPerSession,
      []
    );
  } catch (err) {
    UI.addBot(`Помилка генерації іспиту: ${err.message}\n\nПеревір API key і спробуй ще раз.`);
    UI.addBot('Спробувати ще раз?', {
      buttons: [{ label: 'Так', onClick: () => _runWeakExam(subjectKey, weakTopics) }]
    });
    return;
  }

  Quiz.start(subjectKey, subject.name, questions, config.studentName);
  UI.startStopwatch();
  await askNextQuestion();
}

// ─── Help ────────────────────────────────────────────────────────────────────

function showHelp() {
  UI.addBot(HELP_TEXT);
  UI.addSystem('💬 Можеш запитати про будь-що з довідки — відповім.');
  disableFreeChat();
  enableHelpChat();

  // Показуємо кнопки навігації: новий іспит (disabled якщо ще не було) і зміна предмету
  const { history } = Storage.getProgress();
  const hasExams = lastSubjectKey && history.some(r => r.subject === lastSubjectKey);
  UI.showHeaderActions(
    hasExams ? () => startExam(lastSubjectKey) : null,
    () => { disableHelpChat(); UI.hideHeaderActions(); startSubjectSelection(); },
    null
  );
}

function enableHelpChat() {
  helpChatActive = true;
  UI.setInputEnabled(true);
  UI.clearInput();

  const handler = async () => {
    if (!helpChatActive) return;
    const val = UI.getInput();
    if (!val) return;
    UI.addUser(val);
    UI.clearInput();
    UI.setInputEnabled(false);
    UI.showTyping();
    try {
      const reply = await Gemini.helpChat(config.apiKey, config.model, HELP_TEXT, val);
      UI.addBot(reply);
    } catch (err) {
      UI.addBot(`Помилка: ${err.message}`);
    }
    if (helpChatActive) UI.setInputEnabled(true);
  };

  const keyHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handler(); }
  };

  UI.sendBtn.addEventListener('click', handler);
  UI.inputEl.addEventListener('keydown', keyHandler);
  UI._helpChatHandlers = { click: handler, key: keyHandler };
}

function disableHelpChat() {
  helpChatActive = false;
  if (UI._helpChatHandlers) {
    UI.sendBtn.removeEventListener('click', UI._helpChatHandlers.click);
    UI.inputEl.removeEventListener('keydown', UI._helpChatHandlers.key);
    UI._helpChatHandlers = null;
  }
}

// ─── Free chat ───────────────────────────────────────────────────────────────

function enableFreeChat() {
  freeChatActive = true;
  UI.setInputEnabled(true);
  UI.clearInput();

  const handler = async () => {
    if (!freeChatActive) return;
    const val = UI.getInput();
    if (!val) return;
    UI.clearInput();
    UI.addUser(val);
    UI.setInputEnabled(false);
    UI.showTyping();

    try {
      const reply = await Gemini.freeChat(
        config.apiKey,
        config.model,
        lastExamContext.subjectName,
        lastExamContext.questions,
        val,
        config.targetGrade,
        config.studentName
      );
      UI.addBot(reply);
    } catch (err) {
      UI.addBot(`Помилка: ${err.message}`);
    }

    if (freeChatActive) UI.setInputEnabled(true);
  };

  const keyHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handler(); }
  };

  UI.sendBtn.addEventListener('click', handler);
  UI.inputEl.addEventListener('keydown', keyHandler);

  // Store refs for cleanup
  UI._freeChatHandlers = { click: handler, key: keyHandler };
}

function disableFreeChat() {
  freeChatActive = false;
  if (UI._freeChatHandlers) {
    UI.sendBtn.removeEventListener('click', UI._freeChatHandlers.click);
    UI.inputEl.removeEventListener('keydown', UI._freeChatHandlers.key);
    UI._freeChatHandlers = null;
  }
  UI.setInputEnabled(false);
}

// ─── Input helper ────────────────────────────────────────────────────────────

// Returns the typed string, or null if skipped
function waitForInput() {
  return new Promise(resolve => {
    UI.setInputEnabled(true);
    UI.clearInput();

    const handler = () => {
      const val = UI.getInput();
      if (!val) return;
      UI.clearInput();
      UI.setInputEnabled(false);
      detach();
      resolve(val);
    };

    const keyHandler = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handler(); }
    };

    const detach = () => {
      UI.sendBtn.removeEventListener('click', handler);
      UI.inputEl.removeEventListener('keydown', keyHandler);
      UI._skipCallback = null;
    };

    UI._skipCallback = () => {
      UI.setInputEnabled(false);
      detach();
      resolve(null);
    };

    UI.sendBtn.addEventListener('click', handler);
    UI.inputEl.addEventListener('keydown', keyHandler);
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
