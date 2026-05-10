const Quiz = {
  session: null,

  start(subject, subjectName, questions, studentName) {
    this.session = {
      subject,
      subjectName,
      studentName: studentName || '',
      generated: new Date().toISOString().split('T')[0],
      startedAt: new Date().toISOString(),
      questions,
      current: 0,
      correct: 0,
      skipped: 0
    };
    Storage.saveSession(this.session);
  },

  currentQuestion() {
    if (!this.session) return null;
    return this.session.questions[this.session.current] ?? null;
  },

  isFinished() {
    if (!this.session) return true;
    return this.session.current >= this.session.questions.length;
  },

  recordAnswer(wasCorrect, wasSkipped) {
    if (wasCorrect) this.session.correct++;
    if (wasSkipped) this.session.skipped++;
    this.session.current++;
    Storage.saveSession(this.session);
  },

  finish(timeSeconds) {
    const { subject, correct, skipped, questions, startedAt, studentName } = this.session;
    const total = questions.length;
    Storage.saveExamResult(subject, correct, total, timeSeconds, startedAt, skipped, studentName);
    Storage.clearSession();
    return { correct, total, skipped };
  },

  progress() {
    if (!this.session) return 0;
    return this.session.current / this.session.questions.length;
  }
};
