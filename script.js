(() => {
  'use strict';

  /* ---------- 1. Data ---------- */
  const cars = [
    {
      name: 'FITNESS',
      origin: 'Grow.',
      years: 'Explore.Thrive',
      description: 'THEY COMBINE GRACE, RHYTHM, MUSIC, AND EMOTION TO COMMUNICATE IDEAS AND FEELINGS WITHOUT WORDS. DANCERS FOCUS ON POSTURE, FLUIDITY, TIMING, AND PRECISION TO CREATE VISUALLY BEAUTIFUL AND MEANINGFUL PERFORMANCES. BEYOND PHYSICAL FITNESS, BALLET DEVELOPS CREATIVITY, DISCIPLINE, MUSICALITY, AND EMOTIONAL EXPRESSION, MAKING IT BOTH AN ART FORM AND A POWERFUL WAY TO CONNECT WITH AN AUDIENCE',
      image: './assets/fitness.png',
      bgColor: '#398c1e',
      accentColor: '#ffffff'
    },
    {
      name: 'Beauty',
      origin: 'Grow.',
      years: 'Explore. Thrive',
      description: 'La Nuova 500 turned narrow Italian alleys into its natural habitat. Rear-mounted twin-cylinder, a fold-back canvas roof, and more character per kilogram than almost anything else on the road.',
      image: './assets/beauty.png',
      bgColor: '#f4ebe2',
      accentColor: '#682a31'
    },
    {
      name: 'YOUTH',
      origin: 'Grow.',
      years: 'Explore. Thrive',
      description: 'Alec Issigonis packed a full car into 3 metres by turning the engine sideways. The Cooper version went on to win Monte Carlo three times — giant-killing, one hairpin at a time.',
      image: './assets/youth.png',
      bgColor: '#288dd3',
      accentColor: '#ffffff'
    }
  ];

  /* ---------- 2. State ---------- */
  let current = 0;
  let isTransitioning = false;
  let autoplayTimer = null;
  const AUTOPLAY_MS = 4800;
  const TEXT_SWAP_MS = 320;
  const SLIDE_MS = 850;
  const pendingTimeouts = []; // tracked so a new transition can cancel stale ones mid-flight

  /* ---------- 3. DOM refs ---------- */
  const slider = document.getElementById('slider');
  const carStage = document.getElementById('carStage');
  const carTitle = document.getElementById('carTitle');
  const originEl = document.getElementById('origin');
  const yearsEl = document.getElementById('years');
  const descriptionEl = document.getElementById('description');
  const pagination = document.getElementById('pagination');
  const paginationWrap = document.querySelector('.pagination-wrap');
  const ctaBtn = document.querySelector('.cta-btn');

  /* ---------- 4. Build DOM from data ---------- */
  const imageEls = cars.map((car, i) => {
    const img = document.createElement('img');
    img.src = car.image;
    img.alt = `${car.name} — ${car.origin}, ${car.years}`;
    img.className = 'car-image';
    img.draggable = false;
    img.dataset.index = i;
    carStage.appendChild(img);
    return img;
  });

  const dotEls = cars.map((car, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.type = 'button';
    dot.role = 'tab';
    dot.setAttribute('aria-label', `Show ${car.name}`);
    dot.addEventListener('click', () => goTo(i));
    pagination.appendChild(dot);
    return dot;
  });

  // Keep the progress bar modest and centered — it grows a little with more
  // cars but is capped well short of full width either way.
  const PAGINATION_MIN_WIDTH = 190;
  const PAGINATION_MAX_WIDTH = 380;
  const PAGINATION_PER_ITEM = 78;
  paginationWrap.style.width = `${Math.min(
    PAGINATION_MAX_WIDTH,
    Math.max(PAGINATION_MIN_WIDTH, cars.length * PAGINATION_PER_ITEM)
  )}px`;

  /* ---------- 5. Positioning (peek carousel) ---------- */
  const POS_CLASSES = ['pos-active', 'pos-prev', 'pos-next', 'pos-hidden-left', 'pos-hidden-right'];

  // Left-to-right visual order of roles. Adjacent roles in this list can
  // always animate directly into one another (that's a normal slide).
  // Anything else — prev↔next, prev↔hidden-right, next↔hidden-left,
  // hidden-left↔hidden-right — would have to visibly cross the centre to
  // animate directly, so those specific jumps snap instantly while
  // invisible instead, then fade in from the correct side. Jumps that
  // start or end at 'active' always animate normally regardless of
  // distance, since one end is visible and a fade+slide is exactly the
  // motion we want there.
  const ZONE_ORDER = ['hidden-left', 'prev', 'active', 'next', 'hidden-right'];

  function roleFromOffset(offset, n) {
    if (offset === 0) return 'active';
    if (offset === 1) return 'next';
    if (offset === n - 1) return 'prev';
    return offset <= n / 2 ? 'hidden-right' : 'hidden-left';
  }

  function currentRoleOf(el) {
    for (const cls of POS_CLASSES) {
      if (el.classList.contains(cls)) return cls.slice(4); // strip 'pos-'
    }
    return null;
  }

  function setRole(el, role, snap = false) {
    el.classList.remove(...POS_CLASSES);
    if (snap) el.classList.add('pos-snap');
    else el.classList.remove('pos-snap');
    el.classList.add(`pos-${role}`);
  }

  function updatePositions() {
    const n = cars.length;
    imageEls.forEach((el, i) => {
      const oldRole = currentRoleOf(el);
      const newRole = roleFromOffset((i - current + n) % n, n);

      const isSnap = oldRole && oldRole !== 'active' && newRole !== 'active' &&
        Math.abs(ZONE_ORDER.indexOf(newRole) - ZONE_ORDER.indexOf(oldRole)) > 1;

      if (isSnap) {
        setRole(el, newRole, true);
        void el.offsetWidth; // commit the snap before re-enabling transitions
        requestAnimationFrame(() => {
          el.classList.remove('pos-snap');
        });
      } else {
        setRole(el, newRole);
      }
    });
  }

  // Only the outgoing and incoming cars are allowed to cross the stage.
  // Every other car is parked at its final off-screen position first. This
  // prevents a distant slide from ever travelling through the centre when
  // the user selects a dot or clicks again quickly.
  function transitionCars(previous, direction) {
    const n = cars.length;
    const incoming = current;

    imageEls.forEach((el, i) => {
      if (i === previous || i === incoming) return;
      setRole(el, roleFromOffset((i - current + n) % n, n), true);
    });

    // Put the incoming car just beyond the appropriate edge without showing
    // the reset, then animate it into the full-width centre stage.
    setRole(imageEls[incoming], direction === 'next' ? 'next' : 'prev', true);
    setRole(imageEls[previous], 'active');
    void carStage.offsetWidth;

    imageEls.forEach(el => el.classList.remove('pos-snap'));
    requestAnimationFrame(() => {
      setRole(imageEls[incoming], 'active');
      setRole(imageEls[previous], direction === 'next' ? 'prev' : 'next');
    });

    track(() => {
      imageEls.forEach((el, i) => {
        setRole(el, roleFromOffset((i - current + n) % n, n), true);
      });
      void carStage.offsetWidth;
      imageEls.forEach(el => el.classList.remove('pos-snap'));
      isTransitioning = false;
    }, SLIDE_MS);
  }

  function updateDots() {
    dotEls.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  /* ---------- 6. Text / theme content swap ---------- */
  function track(fn, delay) {
    const id = setTimeout(fn, delay);
    pendingTimeouts.push(id);
    return id;
  }

  function clearPending() {
    pendingTimeouts.forEach(id => clearTimeout(id));
    pendingTimeouts.length = 0;
  }

  function swapField(el, newText, delay) {
    el.classList.add('fade-out');
    track(() => {
      el.textContent = newText;
      el.classList.remove('fade-out');
    }, TEXT_SWAP_MS * 0.55 + delay);
  }

  // Horizontal reveal used for the title, paragraph and button — same left/right
  // language as the car, but on its own class set so each element's exit/enter
  // states don't collide with unrelated CSS (like the button's hover transform).
  const REVEAL_CLASSES = ['reveal-exit-left', 'reveal-exit-right', 'reveal-enter-from-right', 'reveal-enter-from-left'];
  const TITLE_CLASSES = ['title-exit-left', 'title-exit-right', 'title-enter-from-right', 'title-enter-from-left'];

  function revealSwap(el, direction, { onSwap, delay = 0 } = {}) {
    const exitClass = direction === 'next' ? 'reveal-exit-left' : 'reveal-exit-right';
    const enterClass = direction === 'next' ? 'reveal-enter-from-right' : 'reveal-enter-from-left';

    el.classList.remove(...REVEAL_CLASSES);
    el.classList.add(exitClass);
    track(() => {
      if (onSwap) onSwap();
      el.classList.remove(exitClass);
      el.classList.add(enterClass);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.remove(enterClass);
        });
      });
    }, TEXT_SWAP_MS + delay);
  }

  function updateContent(direction) {
    const car = cars[current];

    slider.style.setProperty('--bg-color', car.bgColor);
    slider.style.setProperty('--accent-color', car.accentColor);

    const titleExit = direction === 'next' ? 'title-exit-left' : 'title-exit-right';
    const titleEnter = direction === 'next' ? 'title-enter-from-right' : 'title-enter-from-left';

    carTitle.classList.remove(...TITLE_CLASSES);
    carTitle.classList.add(titleExit);
    track(() => {
      carTitle.textContent = car.name;
      carTitle.classList.remove(titleExit);
      carTitle.classList.add(titleEnter);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          carTitle.classList.remove(titleEnter);
        });
      });
    }, TEXT_SWAP_MS);

    swapField(originEl, car.origin, 0);
    swapField(yearsEl, car.years, 40);

    revealSwap(descriptionEl, direction, {
      delay: 60,
      onSwap: () => { descriptionEl.textContent = car.description; }
    });
    revealSwap(ctaBtn, direction, { delay: 100 });

    updateDots();
  }

  /* ---------- 7. Navigation ---------- */
  function goTo(index, { restart = true } = {}) {
    const n = cars.length;
    index = ((index % n) + n) % n;
    if (index === current || isTransitioning) return;

    clearPending(); // cancel any half-finished transition so rapid clicks / loop wraps never leave stale classes behind

    const diff = (index - current + n) % n;
    const direction = diff <= n / 2 ? 'next' : 'prev';
    isTransitioning = true;

    // A distant dot selection is played as consecutive slides, never as a
    // jump. This keeps every car moving through the same left-to-right track.
    const steps = direction === 'next' ? diff : n - diff;
    const advance = (remaining) => {
      current = (current + (direction === 'next' ? 1 : -1) + n) % n;
      updatePositions();
      updateContent(direction);

      if (remaining > 1) track(() => advance(remaining - 1), SLIDE_MS);
      else track(() => { isTransitioning = false; }, SLIDE_MS);
    };
    advance(steps);

    if (restart) restartAutoplay();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  /* ---------- 8. Autoplay ---------- */
  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => goTo(current + 1, { restart: false }), AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  slider.addEventListener('mouseenter', stopAutoplay);
  slider.addEventListener('mouseleave', startAutoplay);
  slider.addEventListener('focusin', stopAutoplay);
  slider.addEventListener('focusout', startAutoplay);

  /* ---------- 9. Keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  /* ---------- 10. Touch swipe ---------- */
  let touchStartX = null;
  const SWIPE_THRESHOLD = 45;

  carStage.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  carStage.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (deltaX > SWIPE_THRESHOLD) prev();
    else if (deltaX < -SWIPE_THRESHOLD) next();
    touchStartX = null;
  });

  /* ---------- 10b. Mouse drag (desktop) ---------- */
  let mouseStartX = null;
  let isDragging = false;

  carStage.addEventListener('mousedown', (e) => {
    isDragging = true;
    mouseStartX = e.clientX;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const deltaX = e.clientX - mouseStartX;
    if (deltaX > SWIPE_THRESHOLD) prev();
    else if (deltaX < -SWIPE_THRESHOLD) next();
    mouseStartX = null;
  });

  carStage.addEventListener('dragstart', (e) => e.preventDefault());

  /* ---------- 11. Init ---------- */
  function init() {
    const car = cars[current];
    slider.style.setProperty('--bg-color', car.bgColor);
    slider.style.setProperty('--accent-color', car.accentColor);
    carTitle.textContent = car.name;
    originEl.textContent = car.origin;
    yearsEl.textContent = car.years;
    descriptionEl.textContent = car.description;
    updatePositions();
    updateDots();
    startAutoplay();
  }

  init();
})();
