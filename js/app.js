// Default config — overridden by config/settings.json
const DEFAULT_CONFIG = {
  model: 'gemini-2.5-flash-lite-preview',
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

  await Promise.all([loadConfig(), loadSubjects()]);

  if (config.useNano) await Nano.init();

  const nameGreet = config.studentName ? `, ${config.studentName}` : '';
  UI.addBot(`Привіт${nameGreet}! Я Study Buddy 👋\nГотуємось до вступу в ${config.targetGrade} клас. Обирай предмет — і починаємо!`);

  if (!config.apiKey) {
    UI.addSystem('⚠️ API key не вказано. Відкрий налаштування і додай його.');
    Settings.open();
    return;
  }

  await startSubjectSelection();
}

async function startSubjectSelection() {
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
  UI.hideHeaderActions();
  UI.hideStopwatch();
  lastSubjectKey = subjectKey;
  const subject = subjects[subjectKey];
  const knownGrade = config.targetGrade - 1;

  const eligibleTopics = subject.topics.filter(t => t.grade <= knownGrade);

  UI.addUser(subject.name);
  UI.addBot(`Формую іспит з ${subject.name.toLowerCase()}...`);
  UI.showTyping();

  let questions;
  try {
    questions = await Gemini.generateExam(
      config.apiKey,
      config.model,
      subject,
      eligibleTopics,
      config.targetGrade,
      config.questionsPerSession,
      config.essaySize
    );
  } catch (err) {
    UI.addBot(`Помилка генерації іспиту: ${err.message}\n\nПеревір API key і спробуй ще раз.`);
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

  const elapsed = UI.getStopwatchTime();
  const elapsedSec = UI.getStopwatchSeconds();
  UI.stopStopwatch();
  const { correct, total } = Quiz.finish(elapsedSec);
  const pct = Math.round((correct / total) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪';
  const nameFin = config.studentName ? `, ${config.studentName}` : '';

  UI.setProgress(1);
  UI.addBot(`${emoji} Іспит завершено${nameFin}!\n\nПравильних відповідей: ${correct} з ${total} (${pct}%)\nЧас: ${elapsed}`);

  UI.enableExplainButtons();

  const { history } = Storage.getProgress();
  const subjectExamCount = history.filter(r => r.subject === lastSubjectKey).length;
  const weakTopics = subjectExamCount >= 5 ? getWeakTopics(lastSubjectKey) : [];
  UI.showHeaderActions(
    () => startExam(lastSubjectKey),
    () => { disableFreeChat(); UI.hideHeaderActions(); startSubjectSelection(); },
    weakTopics.length > 0 ? () => startWeakExam(lastSubjectKey) : null
  );

  UI.addSystem('💬 Можеш запитати про будь-яке питання з іспиту — я поясню.');
  enableFreeChat();
}

// ─── Weak topics ─────────────────────────────────────────────────────────────

function getWeakTopics(subjectKey) {
  const { history } = Storage.getProgress();
  const topicStats = {};
  history
    .filter(r => r.subject === subjectKey)
    .forEach(r => {
      (r.questionResults || []).forEach(qr => {
        if (!qr.topic) return;
        if (!topicStats[qr.topic]) topicStats[qr.topic] = { wrong: 0, total: 0 };
        topicStats[qr.topic].total++;
        if (!qr.correct) topicStats[qr.topic].wrong++;  // wrong або skipped
      });
    });
  return Object.entries(topicStats)
    .filter(([, s]) => s.wrong > 0)
    .sort((a, b) => (b[1].wrong / b[1].total) - (a[1].wrong / a[1].total))
    .map(([name]) => ({ name }));
}

async function startWeakExam(subjectKey) {
  const weakTopics = getWeakTopics(subjectKey);
  if (weakTopics.length === 0) {
    UI.addBot('Немає тем зі слабкими результатами — все чудово!');
    return;
  }

  disableFreeChat();
  UI.hideHeaderActions();
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
    questions = await Gemini.generateExam(
      config.apiKey,
      config.model,
      subject,
      weakTopics,
      config.targetGrade,
      config.questionsPerSession,
      config.essaySize
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
