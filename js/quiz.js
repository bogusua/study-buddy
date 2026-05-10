const Quiz = {
  session: null,

  start(subject, subjectName, questions) {
    this.session = {
      subject,
      subjectName,
      generated: new Date().toISOString().split('T')[0],
      questions,
      current: 0,
      correct: 0
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

  recordAnswer(wasCorrect) {
    if (wasCorrect) this.session.correct++;
    this.session.current++;
    Storage.saveSession(this.session);
  },

  finish() {
    const { subject, correct, questions } = this.session;
    const total = questions.length;
    Storage.saveExamResult(subject, correct, total);
    Storage.clearSession();
    return { correct, total };
  },

  progress() {
    if (!this.session) return 0;
    return this.session.current / this.session.questions.length;
  }
};
