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
  }
};
