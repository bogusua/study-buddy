const Settings = {
  _modal: null,

  init() {
    this._modal = document.getElementById('settings-modal');
    document.getElementById('btn-settings').addEventListener('click', () => this.open());
    document.getElementById('settings-close').addEventListener('click', () => this.close());
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    document.getElementById('settings-apikey-toggle').addEventListener('click', () => {
      const input = document.getElementById('settings-apikey');
      const btn = document.getElementById('settings-apikey-toggle');
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? 'Сховати' : 'Показати';
    });

    this._modal.addEventListener('click', (e) => {
      if (e.target === this._modal) this.close();
    });
  },

  open() {
    document.getElementById('settings-apikey').value = config.apiKey || '';
    document.getElementById('settings-apikey').type = 'password';
    document.getElementById('settings-apikey-toggle').textContent = 'Показати';
    document.getElementById('settings-name').value = config.studentName || '';
    document.getElementById('settings-grade').value = config.targetGrade || 8;
    document.getElementById('settings-questions').value = config.questionsPerSession || 7;
    document.getElementById('settings-model').value = config.model || DEFAULT_CONFIG.model;
    document.getElementById('settings-nano').checked = config.useNano || false;
    this._modal.classList.add('visible');
    this._checkNanoAvailability();
  },

  async _checkNanoAvailability() {
    const checkbox = document.getElementById('settings-nano');
    const hint = document.getElementById('settings-nano-hint');
    const status = await Nano.checkAvailability();

    if (status === 'readily' || status === 'after-download') {
      checkbox.disabled = false;
      hint.classList.add('hidden');
    } else {
      checkbox.disabled = true;
      checkbox.checked = false;
      config.useNano = false;
      Storage.saveSettings({ ...config, useNano: false });
      hint.textContent = status === 'no'
        ? 'Gemini Nano недоступний на цьому пристрої.'
        : 'Gemini Nano API не підтримується цим браузером.';
      hint.classList.remove('hidden');
    }
  },

  close() {
    this._modal.classList.remove('visible');
  },

  save() {
    const newConfig = {
      apiKey:              document.getElementById('settings-apikey').value.trim(),
      studentName:         document.getElementById('settings-name').value.trim(),
      targetGrade:         parseInt(document.getElementById('settings-grade').value) || 8,
      questionsPerSession: parseInt(document.getElementById('settings-questions').value) || 7,
      model:               document.getElementById('settings-model').value.trim() || DEFAULT_CONFIG.model,
      useNano:             !document.getElementById('settings-nano').disabled && document.getElementById('settings-nano').checked,
    };

    Storage.saveSettings(newConfig);
    Object.assign(config, newConfig);
    this.close();
    UI.addSystem('Налаштування збережено.');
  }
};
