const UI = {
  messagesEl: null,
  inputEl: null,
  sendBtn: null,
  _typingEl: null,
  _skipCallback: null,
  _explainButtons: [],
  _stopwatchEl: null,
  _stopwatchInterval: null,
  _stopwatchSeconds: 0,
  _stopwatchVisible: false,
  _actionsVisible: false,

  init() {
    this.messagesEl = document.getElementById('messages');
    this.inputEl = document.getElementById('user-input');
    this.sendBtn = document.getElementById('send-btn');
    this._stopwatchEl = document.getElementById('stopwatch');
    this._initTheme();
    this._initFontSize();
    this._initInputResize();
  },

  _initInputResize() {
    this.inputEl.addEventListener('input', () => this._resizeInput());
  },

  _resizeInput() {
    const el = this.inputEl;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 120);
    el.style.height = next + 'px';
    el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
  },

  _initTheme() {
    const saved = localStorage.getItem('sb_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    this._applyTheme(isDark);

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark';
      this._applyTheme(!current);
      localStorage.setItem('sb_theme', !current ? 'dark' : 'light');
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('sb_theme')) this._applyTheme(e.matches);
    });
  },

  _applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  },

  _initFontSize() {
    const saved = localStorage.getItem('sb_font') || 'small';
    this._applyFontSize(saved);

    const trigger = document.getElementById('font-size-trigger');
    const menu = document.getElementById('font-size-menu');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    document.querySelectorAll('.font-size-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this._applyFontSize(btn.dataset.size);
        localStorage.setItem('sb_font', btn.dataset.size);
        menu.classList.remove('open');
      });
    });

    document.addEventListener('click', () => menu.classList.remove('open'));
  },

  _applyFontSize(size) {
    document.documentElement.setAttribute('data-font', size);
    const sizes = { small: '11px', medium: '14px', large: '17px' };
    document.getElementById('font-size-trigger').style.fontSize = sizes[size];
    document.querySelectorAll('.font-size-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
  },

  _updateSubheader() {
    document.getElementById('subheader').classList.toggle(
      'visible', this._stopwatchVisible || this._actionsVisible
    );
  },

  startStopwatch() {
    this._stopwatchSeconds = 0;
    this._stopwatchEl.textContent = '0:00';
    this._stopwatchVisible = true;
    this._updateSubheader();
    clearInterval(this._stopwatchInterval);
    this._stopwatchInterval = setInterval(() => {
      this._stopwatchSeconds++;
      const m = Math.floor(this._stopwatchSeconds / 60);
      const s = this._stopwatchSeconds % 60;
      this._stopwatchEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  },

  stopStopwatch() {
    clearInterval(this._stopwatchInterval);
    this._stopwatchInterval = null;
  },

  getStopwatchSeconds() {
    return this._stopwatchSeconds;
  },

  getStopwatchTime() {
    const m = Math.floor(this._stopwatchSeconds / 60);
    const s = this._stopwatchSeconds % 60;
    return m > 0
      ? `${m} хв ${s} сек`
      : `${s} сек`;
  },

  hideStopwatch() {
    this.stopStopwatch();
    this._stopwatchVisible = false;
    this._updateSubheader();
    this.hideProgress();
  },

  setProgress(value) {
    document.getElementById('exam-progress').classList.remove('hidden');
    document.getElementById('exam-progress-fill').style.width = `${Math.round(value * 100)}%`;
  },

  hideProgress() {
    document.getElementById('exam-progress').classList.add('hidden');
    document.getElementById('exam-progress-fill').style.width = '0%';
  },

  showHeaderActions(onNewExam, onChangeSubject, onWeakExam) {
    document.getElementById('btn-new-exam').onclick = onNewExam;
    document.getElementById('btn-change-subject').onclick = onChangeSubject;
    const weakBtn = document.getElementById('btn-weak-exam');
    if (onWeakExam) {
      weakBtn.onclick = onWeakExam;
      weakBtn.classList.remove('hidden');
    } else {
      weakBtn.classList.add('hidden');
    }
    document.getElementById('exam-btns').classList.add('visible');
    this._actionsVisible = true;
    this._updateSubheader();
  },

  hideHeaderActions() {
    document.getElementById('exam-btns').classList.remove('visible');
    document.getElementById('btn-weak-exam').classList.add('hidden');
    this._actionsVisible = false;
    this._updateSubheader();
  },

  // System notice
  addSystem(text) {
    const el = document.createElement('div');
    el.className = 'system-notice';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this._scrollToBottom();
  },

  // Bot message bubble
  addBot(text, opts = {}) {
    this._removeTyping();
    const msg = document.createElement('div');
    msg.className = 'message bot';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (opts.correct === true) bubble.classList.add('correct');
    if (opts.correct === false) bubble.classList.add('wrong');
    bubble.innerHTML = this._escape(text);
    msg.appendChild(bubble);

    if (opts.buttons) {
      const group = document.createElement('div');
      group.className = 'btn-group';
      opts.buttons.forEach(({ label, value, onClick }) => {
        const btn = document.createElement('button');
        btn.className = 'chat-btn';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          btn.classList.add('chat-btn--selected');
          group.querySelectorAll('.chat-btn').forEach(b => b.disabled = true);
          onClick(value ?? label);
        });
        group.appendChild(btn);
      });
      msg.appendChild(group);
    }

    // Skip button — subtle, right-aligned, below question
    if (opts.skipBtn) {
      const skip = document.createElement('button');
      skip.className = 'skip-link';
      skip.textContent = 'далі →';
      skip.addEventListener('click', () => {
        if (this._skipCallback) {
          skip.disabled = true;
          this._skipCallback();
        }
      });
      msg.appendChild(skip);
    }

    this.messagesEl.appendChild(msg);
    this._scrollToBottom();
    return bubble;
  },

  // Explanation block after answer evaluation
  addExplanation({ text, correct, showDispute, onDispute, onExplain, onTopicChat, onScoreUpdate }) {
    this._removeTyping();
    const msg = document.createElement('div');
    msg.className = 'message bot';

    const bubble = document.createElement('div');
    bubble.className = `bubble ${correct ? 'correct' : 'wrong'}`;
    bubble.innerHTML = this._escape(text);
    msg.appendChild(bubble);

    // Action buttons row
    const actions = document.createElement('div');
    actions.className = 'answer-actions';

    if (showDispute) {
      const disputeBtn = document.createElement('button');
      disputeBtn.className = 'action-btn';
      disputeBtn.textContent = 'Не згоден';
      disputeBtn.addEventListener('click', () => {
        disputeBtn.disabled = true;
        this._openDisputeForm(bubble, onDispute, onScoreUpdate);
      });
      actions.appendChild(disputeBtn);
    }

    const explainBtn = document.createElement('button');
    explainBtn.className = 'action-btn';
    explainBtn.textContent = 'Поясни детальніше';
    explainBtn.disabled = true;
    explainBtn.addEventListener('click', () => {
      explainBtn.disabled = true;
      this._openExplainPanel(msg, onExplain, onTopicChat);
    });
    actions.appendChild(explainBtn);
    this._explainButtons.push(explainBtn);

    msg.appendChild(actions);
    this.messagesEl.appendChild(msg);
    this._scrollToBottom();
  },

  // Activate all "Поясни детальніше" buttons after exam ends
  enableExplainButtons() {
    this._explainButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.add('action-btn--active');
    });
    this._explainButtons = [];
  },

  // Inline dispute form inside the explanation bubble
  _openDisputeForm(bubble, onDispute, onScoreUpdate) {
    const form = document.createElement('div');
    form.className = 'dispute-form';

    const input = document.createElement('input');
    input.className = 'dispute-input';
    input.type = 'text';
    input.placeholder = 'Напиши свій аргумент...';

    const btn = document.createElement('button');
    btn.className = 'dispute-submit';
    btn.textContent = '→';

    form.appendChild(input);
    form.appendChild(btn);
    bubble.appendChild(form);
    input.focus();
    this._ensureVisible(form);

    const submit = async () => {
      const val = input.value.trim();
      if (!val) return;
      input.disabled = true;
      btn.disabled = true;
      btn.textContent = '→';

      const loading = document.createElement('div');
      loading.className = 'dispute-loading';
      loading.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      bubble.appendChild(loading);
      this._ensureVisible(loading);

      try {
        const result = await onDispute(val);
        loading.remove();

        const resultEl = document.createElement('div');
        resultEl.className = 'dispute-result';
        const icon = result.correct ? '✅' : '❌';
        const prefix = result.revised ? '<strong>Оцінку переглянуто.</strong> ' : '';
        resultEl.innerHTML = `${prefix}${icon} ${this._escape(result.explanation)}`;
        bubble.appendChild(resultEl);
        this._ensureVisible(resultEl);

        if (result.revised && result.correct && onScoreUpdate) {
          onScoreUpdate();
        }
      } catch {
        loading.remove();
        btn.disabled = false;
        input.disabled = false;
      }
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  },

  // Inline explain panel that expands below the message
  async _openExplainPanel(msgEl, onExplain, onTopicChat) {
    const panel = document.createElement('div');
    panel.className = 'explain-panel';

    const title = document.createElement('div');
    title.className = 'explain-panel-title';
    title.textContent = 'Пояснення';
    panel.appendChild(title);

    const content = document.createElement('div');
    content.className = 'explain-panel-content';
    content.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    content.style.display = 'flex';
    content.style.gap = '4px';
    content.style.alignItems = 'center';
    panel.appendChild(content);

    msgEl.appendChild(panel);

    try {
      const explanation = await onExplain();
      content.style.display = '';
      content.style.gap = '';
      content.style.alignItems = '';
      content.innerHTML = this._escape(explanation);
    } catch {
      content.style.display = '';
      content.textContent = 'Не вдалося завантажити пояснення.';
    }

    // Mini chat for follow-up
    const chatEl = document.createElement('div');
    chatEl.className = 'explain-chat';

    const inputArea = document.createElement('div');
    inputArea.className = 'explain-mini-input';

    const miniInput = document.createElement('input');
    miniInput.type = 'text';
    miniInput.placeholder = 'Запитай більше...';

    const miniBtn = document.createElement('button');
    miniBtn.textContent = '→';

    inputArea.appendChild(miniInput);
    inputArea.appendChild(miniBtn);

    panel.appendChild(chatEl);
    panel.appendChild(inputArea);

    const submitMini = async () => {
      const val = miniInput.value.trim();
      if (!val) return;
      miniInput.value = '';
      miniInput.disabled = true;
      miniBtn.disabled = true;

      const userMsg = document.createElement('div');
      userMsg.className = 'explain-chat-user';
      userMsg.textContent = val;
      chatEl.appendChild(userMsg);

      const botMsg = document.createElement('div');
      botMsg.className = 'explain-chat-bot';
      botMsg.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      botMsg.style.display = 'flex';
      botMsg.style.gap = '4px';
      botMsg.style.alignItems = 'center';
      chatEl.appendChild(botMsg);
      this._ensureVisible(botMsg);

      try {
        const reply = await onTopicChat(val);
        botMsg.style.display = '';
        botMsg.style.gap = '';
        botMsg.style.alignItems = '';
        botMsg.innerHTML = this._escape(reply);
      } catch {
        botMsg.style.display = '';
        botMsg.textContent = 'Помилка.';
      }

      miniInput.disabled = false;
      miniBtn.disabled = false;
      miniInput.focus();
      this._ensureVisible(botMsg);
    };

    miniBtn.addEventListener('click', submitMini);
    miniInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitMini(); });
  },

  // User message bubble
  addUser(text) {
    const msg = document.createElement('div');
    msg.className = 'message user';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = this._escape(text);
    msg.appendChild(bubble);
    this.messagesEl.appendChild(msg);
    this._scrollToBottom();
  },

  showTyping() {
    this._removeTyping();
    const msg = document.createElement('div');
    msg.className = 'message bot typing';
    msg.innerHTML = `<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
    this._typingEl = msg;
    this.messagesEl.appendChild(msg);
    this._scrollToBottom();
  },

  _removeTyping() {
    if (this._typingEl) {
      this._typingEl.remove();
      this._typingEl = null;
    }
  },

  setInputEnabled(enabled) {
    this.inputEl.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
    if (enabled) this.inputEl.focus();
  },

  clearInput() {
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
  },

  getInput() {
    return this.inputEl.value.trim();
  },

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  },

  _ensureVisible(el) {
    requestAnimationFrame(() => {
      const containerRect = this.messagesEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (elRect.bottom > containerRect.bottom) {
        this.messagesEl.scrollTop += elRect.bottom - containerRect.bottom + 8;
      }
    });
  },


  _escape(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
};
