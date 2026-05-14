const Nano = {
  _session: null,
  available: false,

  // Повертає 'available' | 'downloadable' | 'downloading' | 'unavailable'
  // 'unavailable' — модель не підтримується або LanguageModel API відсутній
  async checkAvailability() {
    try {
      return await LanguageModel.availability({
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }]
      });
    } catch (e) {
      return 'unavailable';
    }
  },

  async init() {
    const status = await this.checkAvailability();
    if (status === 'available') {
      this.available = true;
    }
  }
};
