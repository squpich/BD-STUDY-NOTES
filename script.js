(() => {
  'use strict';

  const STORAGE_KEY = 'istec-db-study-v1';
  const body = document.body;
  const notificationRegion = document.querySelector('[data-notification-region]');
  const topicCards = [...document.querySelectorAll('.topic-card[data-topic]')];
  const progressElement = document.querySelector('progress[data-progress="course"]');
  const progressOutputs = [...document.querySelectorAll('.progress-panel output, .floating-study-panel output')];

  const state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        completedTopics: Array.isArray(saved?.completedTopics) ? saved.completedTopics : [],
        finalChecklist: saved?.finalChecklist && typeof saved.finalChecklist === 'object' ? saved.finalChecklist : {}
      };
    } catch {
      return { completedTopics: [], finalChecklist: {} };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      notify('Не удалось сохранить прогресс в браузере.');
    }
  }

  function notify(message, duration = 2200) {
    if (!notificationRegion) return;
    notificationRegion.textContent = message;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      notificationRegion.textContent = '';
    }, duration);
  }

  function setTopicComplete(card, complete, announce = false) {
    const topic = card.dataset.topic;
    const button = card.querySelector('[data-action="complete-topic"]');

    card.dataset.complete = String(complete);
    if (button) {
      button.setAttribute('aria-pressed', String(complete));
      button.textContent = complete ? 'Изучено' : 'Отметить изученной';
    }

    const index = state.completedTopics.indexOf(topic);
    if (complete && index === -1) state.completedTopics.push(topic);
    if (!complete && index !== -1) state.completedTopics.splice(index, 1);

    saveState();
    updateProgress();
    if (announce) notify(complete ? 'Тема отмечена как изученная.' : 'Отметка темы снята.');
  }

  function updateProgress() {
    const total = topicCards.length;
    const completed = topicCards.filter(card => card.dataset.complete === 'true').length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;

    if (progressElement) {
      progressElement.value = percentage;
      progressElement.textContent = `${percentage}%`;
      progressElement.setAttribute('aria-valuenow', String(percentage));
    }

    progressOutputs.forEach(output => {
      output.textContent = output.closest('.floating-study-panel')
        ? `Прогресс: ${percentage}%`
        : `${percentage}%`;
    });

    body.dataset.progress = String(percentage);
  }

  function restoreTopicProgress() {
    topicCards.forEach(card => {
      const complete = state.completedTopics.includes(card.dataset.topic);
      setTopicComplete(card, complete, false);
    });
  }

  function initTopicButtons() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;

      if (action === 'complete-topic') {
        const card = button.closest('.topic-card');
        if (!card) return;
        setTopicComplete(card, card.dataset.complete !== 'true', true);
      }

      if (action === 'toggle-menu') {
        toggleMenu(button);
      }

      if (action === 'toggle-study-panel') {
        toggleStudyPanel(button);
      }
    });
  }

  function toggleMenu(button) {
    const nav = document.getElementById(button.getAttribute('aria-controls'));
    if (!nav) return;
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
    body.classList.toggle('menu-open', !open);
  }

  function closeMenu() {
    const button = document.querySelector('[data-action="toggle-menu"]');
    const nav = document.getElementById('primary-navigation');
    if (!button || !nav) return;
    button.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    body.classList.remove('menu-open');
  }

  function toggleStudyPanel(button) {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  }

  function normalize(value) {
    return value
      .toLocaleLowerCase('ru')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function initSearch() {
    const form = document.querySelector('[data-search-form]');
    const input = document.querySelector('[data-search-input]');
    const output = document.querySelector('[data-search-output]');
    if (!form || !input || !output) return;

    const runSearch = () => {
      const query = normalize(input.value);
      let matches = 0;

      topicCards.forEach(card => {
        const haystack = normalize(`${card.dataset.search || ''} ${card.textContent}`);
        const match = !query || haystack.includes(query);
        card.classList.toggle('is-hidden', !match);
        card.classList.toggle('search-match', Boolean(query && match));
        if (match) matches += 1;
      });

      document.querySelectorAll('.course-section').forEach(section => {
        const visibleCards = section.querySelectorAll('.topic-card:not(.is-hidden)').length;
        section.classList.toggle('is-hidden', Boolean(query) && visibleCards === 0 && section.id !== 'exam');
      });

      output.textContent = query
        ? `Найдено тем: ${matches}.`
        : 'Все темы показаны.';

      if (query && matches) {
        const first = document.querySelector('.topic-card.search-match');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    form.addEventListener('submit', event => {
      event.preventDefault();
      runSearch();
    });

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        topicCards.forEach(card => card.classList.remove('is-hidden', 'search-match'));
        document.querySelectorAll('.course-section').forEach(section => section.classList.remove('is-hidden'));
        output.textContent = 'Все темы показаны.';
      }, 0);
    });

    input.addEventListener('input', () => {
      runSearch();
    });
  }

  function initFilters() {
    const form = document.querySelector('[data-filter-form]');
    if (!form) return;
    const controls = [...form.querySelectorAll('[data-filter]')];

    function applyFilters() {
      const active = controls.filter(control => control.checked).map(control => control.dataset.filter);
      document.querySelectorAll('.course-section[data-category]').forEach(section => {
        const category = section.dataset.category;
        const visible = active.length === 0 || active.includes(category);
        section.classList.toggle('is-hidden', !visible);
      });
    }

    controls.forEach(control => control.addEventListener('change', applyFilters));
  }

  function initQuiz() {
    const form = document.querySelector('[data-quiz]');
    if (!form) return;
    const output = form.querySelector('[data-quiz-output]');

    form.addEventListener('submit', event => {
      event.preventDefault();
      const questions = [...form.querySelectorAll('[data-question]')];
      let correct = 0;
      let answered = 0;

      questions.forEach(question => {
        const answer = question.querySelector('[data-answer]')?.dataset.answer;
        const selected = question.querySelector('input[type="radio"]:checked');
        const isCorrect = Boolean(selected && selected.value === answer);

        if (selected) answered += 1;
        if (isCorrect) correct += 1;

        question.classList.toggle('is-correct', isCorrect);
        question.classList.toggle('is-incorrect', Boolean(selected && !isCorrect));

        const details = question.querySelector('details[data-answer]');
        if (details && selected) details.open = true;
      });

      const percentage = Math.round((correct / questions.length) * 100);
      output.textContent = `Результат: ${correct} из ${questions.length} (${percentage}%). Отвечено: ${answered}.`;
      notify(percentage >= 80 ? 'Хороший результат теста.' : 'Повтори темы с ошибками.');
    });

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        form.querySelectorAll('[data-question]').forEach(question => question.classList.remove('is-correct', 'is-incorrect'));
        form.querySelectorAll('details[data-answer]').forEach(details => { details.open = false; });
        if (output) output.textContent = 'Проверка готова.';
      }, 0);
    });
  }

  function initChecklist() {
    const form = document.querySelector('[data-checklist="final"]');
    if (!form) return;
    const controls = [...form.querySelectorAll('input[type="checkbox"][data-complete]')];

    controls.forEach(control => {
      const key = control.dataset.complete;
      control.checked = Boolean(state.finalChecklist[key]);
      control.addEventListener('change', () => {
        state.finalChecklist[key] = control.checked;
        saveState();
      });
    });
  }

  function initNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', () => closeMenu());
    });

    const sections = [...document.querySelectorAll('main section[id]')];
    const navLinks = [...document.querySelectorAll('#primary-navigation a[href^="#"]')];
    if (!('IntersectionObserver' in window) || !navLinks.length) return;

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      navLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-22% 0px -65% 0px', threshold: [0.01, 0.2, 0.5] });

    sections.forEach(section => observer.observe(section));
  }

  function initKeyboardSupport() {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMenu();
        const panelButton = document.querySelector('[data-action="toggle-study-panel"]');
        const panel = document.getElementById('floating-content');
        if (panelButton && panel && !panel.hidden) {
          panel.hidden = true;
          panelButton.setAttribute('aria-expanded', 'false');
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('[data-search-input]')?.focus();
      }
    });
  }

  restoreTopicProgress();
  initTopicButtons();
  initSearch();
  initFilters();
  initQuiz();
  initChecklist();
  initNavigation();
  initKeyboardSupport();
  updateProgress();
})();
