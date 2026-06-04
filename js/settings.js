const Settings = {
  _modal: null,
  onSave: null,

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

    const popup = document.getElementById('apikey-info-popup');
    document.getElementById('apikey-info-btn').addEventListener('click', () => {
      popup.classList.remove('hidden');
    });
    document.getElementById('apikey-info-close').addEventListener('click', () => {
      popup.classList.add('hidden');
    });
    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.classList.add('hidden');
    });
  },

  open() {
    this._initAppearance();
    document.getElementById('settings-version').textContent = `Study Buddy v${APP_VERSION}`;
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
    const existingBtn = document.getElementById('settings-nano-download');
    if (existingBtn) existingBtn.remove();

    const status = await Nano.checkAvailability();

    if (status === 'available' || status === 'downloadable') {
      checkbox.disabled = false;
      if (status === 'downloadable') {
        const btn = document.createElement('button');
        btn.id = 'settings-nano-download';
        btn.className = 'settings-nano-download-btn';
        btn.textContent = 'Завантажити (~1.7 ГБ)';
        btn.onclick = () => this._downloadNano(btn, hint);
        hint.textContent = '';
        hint.appendChild(btn);
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    } else {
      checkbox.disabled = true;
      checkbox.checked = false;
      config.useNano = false;
      Storage.saveSettings({ ...config, useNano: false });
      if (status === 'downloading') {
        hint.textContent = 'Модель завантажується, спробуйте пізніше.';
      } else if (status === 'unavailable') {
        hint.textContent = 'Gemini Nano недоступний на цьому пристрої.';
      } else {
        hint.textContent = 'Gemini Nano API не підтримується цим браузером.';
      }
      hint.classList.remove('hidden');
    }
  },

  async _downloadNano(btn, hint) {
    btn.disabled = true;
    hint.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
    const progress = document.createTextNode('Завантаження: 0%');
    hint.appendChild(progress);
    try {
      const session = await LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            progress.textContent = `Завантаження: ${Math.round(e.loaded * 100)}%`;
          });
        }
      });
      Nano._session = session;
      Nano.available = true;
      hint.classList.add('hidden');
      btn.remove();
    } catch (e) {
      progress.textContent = ' Помилка. Спробуйте ще раз.';
      btn.textContent = 'Повторити';
      btn.disabled = false;
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
    if (this.onSave) this.onSave();
  }
};
