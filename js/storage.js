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
  }
};
