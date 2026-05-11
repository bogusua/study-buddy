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
    this._initAppearance();
    document.getElementById('settings-apikey').value = config.apiKey || '';
    document.getElementById('settings-apikey').type = 'password';
    document.getElementById('settings-apikey-toggle').textContent = 'Показати';
    document.getElementById('settings-name').value = config.studentName || '';
    document.getElementById('settings-grade').value = config.targetGrade || 8;
    document.getElementById('settings-questions').value = config.questionsPerSession || 7;
    document.getElementById('settings-essay-size').value = config.essaySize || 'medium';
    document.getElementById('settings-model').value = config.model || DEFAULT_CONFIG.model;
    document.getElementById('settings-nano').checked = config.useNano || false;
    this._renderPoolInfo();
    this._modal.classList.add('visible');
    this._checkNanoAvailability();
  },

  _initAppearance() {
    const currentTheme = UI.getThemeSetting();
    const currentFont = UI.getCurrentFontSize();

    document.querySelectorAll('#settings-theme-seg .settings-seg-btn').forEach(btn => {
      btn.classList.toggle('settings-seg-btn--active', btn.dataset.theme === currentTheme);
      btn.onclick = () => {
        UI.setTheme(btn.dataset.theme);
        document.querySelectorAll('#settings-theme-seg .settings-seg-btn')
          .forEach(b => b.classList.toggle('settings-seg-btn--active', b === btn));
      };
    });

    document.querySelectorAll('#settings-font-seg .settings-seg-btn').forEach(btn => {
      btn.classList.toggle('settings-seg-btn--active', btn.dataset.size === currentFont);
      btn.onclick = () => {
        UI.setFontSize(btn.dataset.size);
        document.querySelectorAll('#settings-font-seg .settings-seg-btn')
          .forEach(b => b.classList.toggle('settings-seg-btn--active', b === btn));
      };
    });
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

  _renderPoolInfo() {
    const container = document.getElementById('settings-pool-info');
    container.innerHTML = '';

    Object.entries(subjects).forEach(([key, subject]) => {
      const pool = Storage.getPool(key, config.targetGrade);
      const row = document.createElement('div');
      row.className = 'settings-pool-row';

      const info = document.createElement('span');
      info.className = 'settings-pool-text';
      if (pool) {
        const inRotation = pool.questions.filter(q => q.usedCount < 3).length;
        info.textContent = `${subject.name}: ${pool.questions.length} питань (${inRotation} в ротації)`;
      } else {
        info.textContent = `${subject.name}: немає`;
        info.classList.add('settings-pool-empty');
      }

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'settings-pool-reset';
      resetBtn.textContent = 'Скинути';
      resetBtn.disabled = !pool;
      resetBtn.addEventListener('click', () => {
        Storage.clearPool(key, config.targetGrade);
        this._renderPoolInfo();
      });

      row.appendChild(info);
      row.appendChild(resetBtn);
      container.appendChild(row);
    });
  },

  save() {
    const newConfig = {
      apiKey:              document.getElementById('settings-apikey').value.trim(),
      studentName:         document.getElementById('settings-name').value.trim(),
      targetGrade:         parseInt(document.getElementById('settings-grade').value) || 8,
      questionsPerSession: parseInt(document.getElementById('settings-questions').value) || 7,
      essaySize:           document.getElementById('settings-essay-size').value || 'medium',
      model:               document.getElementById('settings-model').value.trim() || DEFAULT_CONFIG.model,
      useNano:             !document.getElementById('settings-nano').disabled && document.getElementById('settings-nano').checked,
    };

    Storage.saveSettings(newConfig);
    Object.assign(config, newConfig);
    this.close();
    UI.addSystem('Налаштування збережено.');
  }
};
