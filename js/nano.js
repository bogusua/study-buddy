const Nano = {
  _session: null,
  available: false,

  // Повертає 'readily' | 'after-download' | 'no' | 'unavailable'
  // 'unavailable' — LanguageModel API взагалі відсутній у браузері
  async checkAvailability() {
    try {
      return await LanguageModel.availability({
        expectedInputLanguages: ['uk'],
        expectedOutputLanguages: ['uk']
      });
    } catch (e) {
      return 'unavailable';
    }
  },

  async init() {
    const status = await this.checkAvailability();
    if (status === 'readily') {
      this.available = true;
    }
  }
};
