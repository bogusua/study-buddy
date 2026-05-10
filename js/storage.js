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

  saveExamResult(subject, correct, total) {
    const progress = this.getProgress();
    const date = new Date().toISOString().split('T')[0];

    progress.history.push({ subject, date, correct, total });

    if (!progress.subjectStats[subject]) {
      progress.subjectStats[subject] = { shown: 0, lastShown: date };
    }
    progress.subjectStats[subject].shown++;
    progress.subjectStats[subject].lastShown = date;

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
