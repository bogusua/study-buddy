const Nano = {
  _session: null,
  available: false,

  // Повертає 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'no-api'
  // 'no-api' — LanguageModel API взагалі відсутній у браузері
  async checkAvailability() {
    try {
      return await LanguageModel.availability({ languages: ['uk', 'en'] });
    } catch (e) {
      return 'no-api';
    }
  },

  async init() {
    const status = await this.checkAvailability();
    if (status === 'available') {
      this._session = await LanguageModel.create();
      this.available = true;
    }
  },

  // Повертає 'YES' якщо відповідь осмислена, 'NO' якщо nonsense
  async validate(subject, question, answer) {
    if (!this._session) {
      this._session = await LanguageModel.create();
      this.available = true;
    }
    const prompt = `Subject: ${subject}\nQuestion: ${question}\nStudent answer: ${answer}\n\nIs this a meaningful attempt to answer the question (not random text, gibberish, or completely off-topic)? Reply YES or NO.`;
    try {
      return await this._session.prompt(prompt);
    } catch (e) {
      // Контекст переповнений або сесія впала — перестворюємо і пробуємо ще раз
      this._session = await LanguageModel.create();
      return await this._session.prompt(prompt);
    }
  },

  destroy() {
    if (this._session) {
      this._session.destroy();
      this._session = null;
    }
    this.available = false;
  }
};