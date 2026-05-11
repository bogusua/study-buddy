const Storage = {
  getApiKey() {
    return localStorage.getItem('sb_api_key') || '';
  },

  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('sb_settings')) || {};
    } catch {
      return {};
    }
  },

  saveSettings(settings) {
    localStorage.setItem('sb_settings', JSON.stringify(settings));
  },

  getProgress() {
    try {
      return JSON.parse(localStorage.getItem('sb_progress')) || { history: [], subjectStats: {} };
    } catch {
      return { history: [], subjectStats: {} };
    }
  },

  saveExamResult(subject, correct, total, time, startedAt, skipped, studentName, questionResults) {
    const progress = this.getProgress();
    const date = new Date().toISOString().split('T')[0];

    // questionResults: [{ topic, correct, skipped }] — основа для майбутнього режиму "слабкі місця"
    progress.history.push({ subject, date, correct, total, time: time || 0, startedAt: startedAt || null, skipped: skipped || 0, studentName: studentName || '', questionResults: questionResults || [] });

    if (!progress.subjectStats[subject]) {
      progress.subjectStats[subject] = { shown: 0, lastShown: date };
    }
    progress.subjectStats[subject].shown++;
    progress.subjectStats[subject].lastShown = date;

    localStorage.setItem('sb_progress', JSON.stringify(progress));
  },

  clearProgress() {
    localStorage.removeItem('sb_progress');
  },

  clearSubjectProgress(subject) {
    const progress = this.getProgress();
    progress.history = progress.history.filter(r => r.subject !== subject);
    delete progress.subjectStats[subject];
    localStorage.setItem('sb_progress', JSON.stringify(progress));
  },

  getTopicScores(subjectKey, targetGrade) {
    try {
      return JSON.parse(localStorage.getItem(`sb_topic_scores_${subjectKey}_g${targetGrade}`)) || {};
    } catch { return {}; }
  },

  updateTopicScores(subjectKey, targetGrade, questionResults) {
    const scores = this.getTopicScores(subjectKey, targetGrade);
    questionResults.forEach(qr => {
      if (!qr.topic || qr.topic === 'Есе') return;
      if (!scores[qr.topic]) scores[qr.topic] = { correct: 0, total: 0 };
      scores[qr.topic].total++;
      if (qr.correct) scores[qr.topic].correct++;
    });
    localStorage.setItem(`sb_topic_scores_${subjectKey}_g${targetGrade}`, JSON.stringify(scores));
  },

  clearTopicScores(subjectKey, targetGrade) {
    localStorage.removeItem(`sb_topic_scores_${subjectKey}_g${targetGrade}`);
  },

  getPool(subjectKey, targetGrade) {
    try {
      return JSON.parse(localStorage.getItem(`sb_pool_${subjectKey}_g${targetGrade}`)) || null;
    } catch { return null; }
  },

  savePool(subjectKey, targetGrade, pool) {
    localStorage.setItem(`sb_pool_${subjectKey}_g${targetGrade}`, JSON.stringify(pool));
  },

  clearPool(subjectKey, targetGrade) {
    localStorage.removeItem(`sb_pool_${subjectKey}_g${targetGrade}`);
  },

  clearAllPools() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb_pool_'))
      .forEach(k => localStorage.removeItem(k));
  },

  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem('sb_session')) || null;
    } catch {
      return null;
    }
  },

  saveSession(session) {
    sessionStorage.setItem('sb_session', JSON.stringify(session));
  },

  clearSession() {
    sessionStorage.removeItem('sb_session');
  },

  // ─── Chat log ────────────────────────────────────────────────────────────────

  getChatLog() {
    try { return JSON.parse(localStorage.getItem('sb_chat_log')) || []; } catch { return []; }
  },

  appendChatMessage(msg) {
    const log = this.getChatLog();
    log.push(msg);
    localStorage.setItem('sb_chat_log', JSON.stringify(log.slice(-300)));
  },

  clearChatLog() {
    localStorage.removeItem('sb_chat_log');
  },

  // ─── Session state ───────────────────────────────────────────────────────────
  // phase: 'subject_selection' | 'exam_active' | 'exam_complete'

  getSessionState() {
    try { return JSON.parse(localStorage.getItem('sb_session_state')) || null; } catch { return null; }
  },

  saveSessionState(state) {
    localStorage.setItem('sb_session_state', JSON.stringify(state));
  },

  clearSessionState() {
    localStorage.removeItem('sb_session_state');
  }
};
