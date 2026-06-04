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
      this.available = true;
    }
  },

  // Повертає 'YES' якщо відповідь осмислена, 'NO' якщо nonsense
  async validate(subject, question, answer) {
    const session = await LanguageModel.create();
    const prompt = `Subject: ${subject}\nQuestion: ${question}\nStudent answer: ${answer}\n\nIs this a meaningful attempt to answer the question (not random text, gibberish, or completely off-topic)? Reply YES or NO.`;
    const result = await session.prompt(prompt);
    session.destroy();
    return result;
  }
};
