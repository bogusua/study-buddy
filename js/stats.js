const Stats = {
  _modal: null,
  _tooltip: null,
  _confirmModal: null,
  _confirmCallback: null,

  init() {
    this._modal = document.getElementById('stats-modal');
    this._tooltip = document.getElementById('stats-tooltip');
    this._confirmModal = document.getElementById('confirm-modal');

    document.getElementById('btn-stats').addEventListener('click', () => this.open());
    document.getElementById('stats-close').addEventListener('click', () => this.close());
    this._modal.addEventListener('click', (e) => { if (e.target === this._modal) this.close(); });

    document.getElementById('confirm-yes').addEventListener('click', () => {
      if (this._confirmCallback) this._confirmCallback();
      this._confirmModal.classList.remove('visible');
      this._confirmCallback = null;
    });
    document.getElementById('confirm-no').addEventListener('click', () => {
      this._confirmModal.classList.remove('visible');
      this._confirmCallback = null;
    });
  },

  _showTooltip(e, html) {
    this._tooltip.innerHTML = html;
    this._tooltip.classList.add('visible');
    this._moveTooltip(e);
  },

  _moveTooltip(e) {
    const dialog = this._modal.querySelector('.settings-dialog');
    const rect = dialog.getBoundingClientRect();
    let x = e.clientX - rect.left + 10;
    let y = e.clientY - rect.top - 10;
    // не виходимо за праву межу
    if (x + 140 > rect.width) x = e.clientX - rect.left - 150;
    this._tooltip.style.left = x + 'px';
    this._tooltip.style.top = y + 'px';
  },

  _hideTooltip() {
    this._tooltip.classList.remove('visible');
  },

  open() {
    this._render();
    this._modal.classList.add('visible');
  },

  close() {
    this._modal.classList.remove('visible');
  },

  _render() {
    const content = document.getElementById('stats-content');
    const { history } = Storage.getProgress();
    content.innerHTML = '';

    if (!history || history.length === 0) {
      content.innerHTML = '<p class="stats-empty">Ще немає завершених іспитів.</p>';
      return;
    }

    // Group by subject
    const bySubject = {};
    history.forEach(r => {
      if (!bySubject[r.subject]) bySubject[r.subject] = [];
      bySubject[r.subject].push(r);
    });

    Object.entries(bySubject).forEach(([key, records]) => {
      content.appendChild(this._renderSubject(key, records));
    });

    // Секція по учнях
    const byStudent = {};
    history.forEach(r => {
      const name = r.studentName || '';
      if (!byStudent[name]) byStudent[name] = [];
      byStudent[name].push(r);
    });

    if (Object.keys(byStudent).length > 0) {
      const divider = document.createElement('div');
      divider.className = 'stats-divider';
      divider.textContent = 'По учнях';
      content.appendChild(divider);
      Object.entries(byStudent).forEach(([name, records]) => {
        content.appendChild(this._renderStudent(name, records));
      });
    }

    // Кнопка очищення всієї статистики
    const clearAll = document.createElement('button');
    clearAll.className = 'stats-clear-btn';
    clearAll.textContent = 'Очистити всю статистику';
    clearAll.addEventListener('click', () => this._confirmClear('Очистити всю статистику по всіх предметах?', () => {
      Storage.clearProgress();
      this._render();
    }));
    content.appendChild(clearAll);
  },

  _confirmClear(text, onConfirm) {
    document.getElementById('confirm-text').textContent = text;
    this._confirmCallback = onConfirm;
    this._confirmModal.classList.add('visible');
  },

  _renderSubject(key, records) {
    const block = document.createElement('div');
    block.className = 'stats-subject';

    const name = records[0] ? (subjects[key]?.name || key) : key;
    const count = records.length;
    const avgPct = Math.round(records.reduce((s, r) => s + (r.correct / r.total) * 100, 0) / count);
    const avgSec = Math.round(records.reduce((s, r) => s + (r.time || 0), 0) / count);
    const avgTime = avgSec > 0 ? this._formatTime(avgSec) : '—';
    const avgQ = Math.round(records.reduce((s, r) => s + r.total, 0) / count);
    const last = records[records.length - 1];
    const lastPct = Math.round((last.correct / last.total) * 100);

    const header = document.createElement('div');
    header.className = 'stats-subject-header';
    header.innerHTML = `<span class="stats-subject-name">${name}</span>`;

    const btnGroup = document.createElement('div');
    btnGroup.className = 'stats-subject-btns';

    if (records.length >= 5) {
      const weakBtn = document.createElement('button');
      weakBtn.className = 'stats-weak-btn';
      weakBtn.textContent = 'Слабкі теми →';
      weakBtn.addEventListener('click', () => {
        this.close();
        startWeakExam(key);
      });
      btnGroup.appendChild(weakBtn);
    }

    const clearBtn = document.createElement('button');
    clearBtn.className = 'stats-clear-subject';
    clearBtn.title = `Очистити статистику: ${name}`;
    clearBtn.textContent = 'Очистити';
    clearBtn.addEventListener('click', () => this._confirmClear(`Очистити статистику по предмету "${name}"?`, () => {
      Storage.clearSubjectProgress(key);
      this._render();
    }));
    btnGroup.appendChild(clearBtn);

    header.appendChild(btnGroup);
    block.appendChild(header);

    const summary = document.createElement('div');
    summary.className = 'stats-summary';
    summary.innerHTML = `
      <span><b>${count}</b> ${this._examWord(count)}</span>
      <span>·</span>
      <span>сер. питань: <b>${avgQ}</b></span>
      <span>·</span>
      <span>сер. результат: <b>${avgPct}%</b></span>
      <span>·</span>
      <span>сер. час: <b>~${avgTime}</b></span>
    `;
    block.appendChild(summary);

    const lastWrong = last.total - last.correct - (last.skipped || 0);
    const lastEl = document.createElement('div');
    lastEl.className = 'stats-last';
    lastEl.innerHTML = `Останній (${last.total} пит.): <span class="stats-correct">${last.correct}</span> / <span class="stats-wrong">${lastWrong}</span> / <span class="stats-skipped">${last.skipped || 0}</span> · ${this._formatStart(last)}`;
    block.appendChild(lastEl);

    if (records.length >= 2) {
      block.appendChild(this._renderChart(records));
      block.appendChild(this._renderLegend());
    }

    return block;
  },

  _renderStudent(name, records) {
    const block = document.createElement('div');
    block.className = 'stats-student';

    const displayName = name || 'Учень';
    const count = records.length;
    const avgPct = Math.round(records.reduce((s, r) => s + (r.correct / r.total) * 100, 0) / count);
    const avgSec = Math.round(records.reduce((s, r) => s + (r.time || 0), 0) / count);
    const avgTime = avgSec > 0 ? this._formatTime(avgSec) : '—';

    block.innerHTML = `
      <div class="stats-student-name">${displayName}</div>
      <div class="stats-summary">
        <span><b>${count}</b> ${this._examWord(count)}</span>
        <span>·</span>
        <span>сер. результат: <b>${avgPct}%</b></span>
        <span>·</span>
        <span>сер. час: <b>~${avgTime}</b></span>
      </div>
    `;
    return block;
  },

  _renderLegend() {
    const legend = document.createElement('div');
    legend.className = 'stats-legend';
    legend.innerHTML = `
      <span class="stats-legend-dot"></span>
      <span>% правильних відповідей · вісь X — іспити по порядку</span>
    `;
    return legend;
  },

  _renderChart(records) {
    const W = 280, H = 80;
    const padL = 24, padR = 8, padT = 8, padB = 20;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = records.length;

    const pcts = records.map(r => Math.round((r.correct / r.total) * 100));
    const slotW = chartW / n;
    const barW = Math.max(4, slotW * 0.65);
    const yOf = v => padT + chartH - (v / 100) * chartH;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'stats-chart');

    // Y grid lines: 0, 50, 100
    [0, 50, 100].forEach(v => {
      const y = yOf(v);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('class', 'stats-grid');
      svg.appendChild(line);

      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', padL - 3);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('class', 'stats-axis-label');
      label.textContent = v;
      svg.appendChild(label);
    });

    // Bars
    records.forEach((r, i) => {
      const pct = pcts[i];
      const barH = Math.max(3, (pct / 100) * chartH);
      const x = padL + i * slotW + (slotW - barW) / 2;
      const y = yOf(pct);

      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barH);
      rect.setAttribute('rx', 3);
      rect.setAttribute('fill', this._dotColor(pct));
      rect.setAttribute('opacity', '0.85');
      rect.setAttribute('class', 'stats-bar');

      const skipped = r.skipped || 0;
      const wrong = r.total - r.correct - skipped;
      const timeStr = r.time ? this._formatTime(r.time) : '0:00';
      const nameLabel = r.studentName || 'Учень';
      const tooltipHtml = [
        `<div class="stats-tip-date">${this._formatStart(r)}</div>`,
        `<div class="stats-tip-row"><span>Учень:</span> ${nameLabel}</div>`,
        `<div class="stats-tip-row"><span>Всього питань:</span> ${r.total}</div>`,
        `<div class="stats-tip-row"><span>Результат:</span> <span class="stats-correct">${r.correct}</span> / <span class="stats-wrong">${wrong}</span> / <span class="stats-skipped">${skipped}</span></div>`,
        `<div class="stats-tip-row"><span>Відсоток успіху:</span> ${pct}%</div>`,
        `<div class="stats-tip-row"><span>Час виконання:</span> ${timeStr}</div>`,
      ].join('');

      rect.addEventListener('mouseover', (e) => this._showTooltip(e, tooltipHtml));
      rect.addEventListener('mousemove', (e) => this._moveTooltip(e));
      rect.addEventListener('mouseout', () => this._hideTooltip());
      svg.appendChild(rect);
    });

    // X axis: перший і останній
    [[0, 'start'], [n - 1, 'end']].forEach(([i, anchor]) => {
      const x = padL + i * slotW + slotW / 2;
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', H - 4);
      label.setAttribute('text-anchor', anchor === 'start' ? 'start' : 'end');
      label.setAttribute('class', 'stats-axis-label');
      label.textContent = records[i].date.slice(5);
      svg.appendChild(label);
    });

    return svg;
  },

  _dotColor(pct) {
    if (pct >= 80) return 'var(--correct)';
    if (pct >= 50) return '#f59e0b';
    return 'var(--wrong)';
  },

  _formatStart(record) {
    if (record.startedAt) {
      const d = new Date(record.startedAt);
      const date = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      return `${date}, ${time}`;
    }
    return record.date;
  },

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  _examWord(n) {
    if (n % 10 === 1 && n % 100 !== 11) return 'іспит';
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'іспити';
    return 'іспитів';
  }
};
