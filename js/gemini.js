const Gemini = {
  async generateExam(apiKey, model, subject, topics, targetGrade, count, essaySize) {
    const knownGrade = targetGrade - 1;
    const topicList = topics.map(t => t.name).join(', ');
    const hasEssay = !!subject.hasEssay;
    const questionCount = hasEssay ? count - 1 : count;

    const essaySizes = {
      short:  { range: '8–10',   label: 'невеликий' },
      medium: { range: '12–15',  label: 'розгорнутий' },
      long:   { range: '18–22',  label: 'детальний' },
    };
    const sz = essaySizes[essaySize] || essaySizes.medium;
    const essayInstruction = hasEssay ? `
Останнє завдання — есе: вигадай цікаву тему для ${sz.label} твору відповідного рівня.
Формат для есе: { "type": "essay", "question": "Напиши есе (${sz.range} речень) на тему: «...». Структуруй твір: вступ, основна думка, висновок.", "answer": "", "hint": "", "topic": "Есе" }` : '';

    const prompt = `Ти екзаменатор, який приймає вступний іспит до ${targetGrade} класу ліцею.
Предмет: ${subject.name}.
Доступні теми (програма 1–${knownGrade} класів): ${topicList}.

Склади іспит з ${questionCount} відкритих питань різної складності.
Вибери теми рівномірно з різних розділів, питання перемішай.${essayInstruction}

Відповідь — лише JSON масив без будь-якого іншого тексту:
[{ "type": "question", "question": "...", "answer": "...", "hint": "...", "topic": "назва теми" }]
Питання українською мовою.`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text);
  },

  async generatePool(apiKey, model, subject, topics, targetGrade, count, existingQuestions) {
    const knownGrade = targetGrade - 1;
    const topicList = topics.map(t => t.name).join(', ');
    const avoidSection = existingQuestions && existingQuestions.length > 0
      ? `\nНЕ повторюй і не перефразовуй ці питання:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
      : '';

    const prompt = `Ти екзаменатор, який приймає вступний іспит до ${targetGrade} класу ліцею.
Предмет: ${subject.name}.
Доступні теми (програма 1–${knownGrade} класів): ${topicList}.

Склади ${count} різноманітних відкритих питань для підготовки до іспиту.
Рівень: сильний фізмат ліцей, без простих завдань, частина питань — логічні або нестандартні.
Вибери теми рівномірно з усіх розділів, уникай повторів формулювань.${avoidSection}

Відповідь — лише JSON масив без будь-якого іншого тексту:
[{ "type": "question", "question": "...", "answer": "...", "hint": "...", "topic": "назва теми" }]
Питання українською мовою.`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text);
  },

  async generateEssayQuestion(apiKey, model, subject, targetGrade, essaySize) {
    const knownGrade = targetGrade - 1;
    const essaySizes = {
      short:  { range: '8–10',  label: 'невеликий' },
      medium: { range: '12–15', label: 'розгорнутий' },
      long:   { range: '18–22', label: 'детальний' },
    };
    const sz = essaySizes[essaySize] || essaySizes.medium;

    const prompt = `Ти екзаменатор, який приймає вступний іспит до ${targetGrade} класу ліцею.
Предмет: ${subject.name}.

Вигадай цікаву тему для ${sz.label} твору для учня який закінчує ${knownGrade} клас.

Відповідь — лише JSON без будь-якого іншого тексту:
{ "type": "essay", "question": "Напиши есе (${sz.range} речень) на тему: «...». Структуруй твір: вступ, основна думка, висновок.", "answer": "", "hint": "", "topic": "Есе" }`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text);
  },

  async checkAnswer(apiKey, model, question, expectedAnswer, studentAnswer, targetGrade, studentName) {
    const knownGrade = targetGrade - 1;
    const nameCtx = studentName ? ` Звертайся до учня на ім'я ${studentName}.` : '';
    const prompt = `Питання: ${question}
Правильна відповідь: ${expectedAnswer}
Відповідь учня: ${studentAnswer}

Оціни відповідь учня. Відповідь — лише JSON без будь-якого іншого тексту:
{ "correct": true, "explanation": "..." }
Пояснення українською, коротко і доброзичливо — учень закінчує ${knownGrade} клас і складає вступний іспит до ліцею.${nameCtx}`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text);
  },

  async evaluateEssay(apiKey, model, essayPrompt, studentEssay, targetGrade, studentName) {
    const knownGrade = targetGrade - 1;
    const nameCtx = studentName ? ` Звертайся до учня на ім'я ${studentName}.` : '';
    const prompt = `Оціни есе учня який вступає до ${targetGrade} класу ліцею (закінчує ${knownGrade} клас).
Завдання: ${essayPrompt}
Текст учня: ${studentEssay}

Оціни за критеріями: відповідність темі, структура (вступ/основна частина/висновок), грамотність, стиль.
Відповідь — лише JSON без будь-якого іншого тексту:
{ "correct": true, "explanation": "..." }
Пояснення українською, доброзичливо, з конкретними порадами що покращити.${nameCtx}`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text);
  },

  async disputeAnswer(apiKey, model, question, expectedAnswer, studentAnswer, argument, targetGrade, studentName) {
    const nameCtx = studentName ? ` Звертайся до учня на ім'я ${studentName}.` : '';
    const prompt = `Питання: ${question}
Правильна відповідь: ${expectedAnswer}
Відповідь учня: ${studentAnswer}
Аргумент учня: ${argument}

Правила розгляду аргументу:
1. Якщо учень просто повторює свою попередню відповідь без нових аргументів — не змінюй оцінку.
2. Якщо учень вказує на неточність або помилку в попередньому поясненні — розглянь серйозно і зміни оцінку якщо він правий.
3. Якщо аргумент містить нове обґрунтування яке дійсно підтверджує правильність відповіді — зміни оцінку.

Відповідь — лише JSON: { "correct": true, "explanation": "...", "revised": true }
revised = true якщо змінив оцінку на правильну, інакше false.
Пояснення українською, доброзичливо — поясни свою позицію.${nameCtx}`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text);
  },

  async explainQuestion(apiKey, model, question, answer, targetGrade) {
    const prompt = `Поясни детально цей матеріал учню який вступає до ${targetGrade} класу ліцею.
Питання: ${question}
Правильна відповідь: ${answer}

Дай розгорнуте пояснення: чому саме така відповідь, як це працює, наведи приклад.
Відповідь — лише JSON: { "explanation": "..." }
Пояснення українською, зрозуміло для учня.`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text).explanation;
  },

  async chatOnTopic(apiKey, model, question, answer, message, targetGrade) {
    const prompt = `Ти вчитель пояснюєш конкретне питання учню який вступає до ${targetGrade} класу ліцею.
Питання: ${question}
Правильна відповідь: ${answer}
Запит учня: ${message}

Відповідай тільки в контексті цього питання, не відволікайся на інше.
Відповідь — лише JSON: { "reply": "..." }
Відповідай українською, доброзичливо.`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text).reply;
  },

  async freeChat(apiKey, model, subjectName, questions, message, targetGrade, studentName) {
    const questionList = questions
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join('\n');

    const nameCtx = studentName ? ` Звертайся до учня на ім'я ${studentName}.` : '';
    const prompt = `Ти вчитель, який допомагає учню після вступного іспиту до ${targetGrade} класу ліцею.
Предмет: ${subjectName}.${nameCtx}

Питання що були на іспиті:
${questionList}

Учень запитує: ${message}

Відповідь — лише JSON: { "reply": "..." }
Відповідай українською, доброзичливо і зрозуміло.`;

    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text).reply;
  },

  async helpChat(apiKey, model, docText, question) {
    const prompt = `Ти асистент додатку Study Buddy — програми для підготовки до вступного іспиту в ліцей.
Ось документація додатку:
${docText}

Питання користувача: ${question}

Відповідай коротко і по суті, виключно про функціональність цього додатку.
Відповідь — лише JSON: { "reply": "..." }
Відповідь українською.`;
    const text = await this._call(apiKey, model, prompt);
    return JSON.parse(text).reply;
  },

  async _call(apiKey, model, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }
};
