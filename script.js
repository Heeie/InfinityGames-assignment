(() => {
  'use strict';
  const SIZE = 10;
  const COLORS = ['#f3775b', '#f1c95c', '#71b8a5', '#aaa0d5'];
  const AMBIENT_CHORDS = [[261.63,329.63,392.00],[196.00,246.94,293.66],[174.61,220.00,261.63],[196.00,246.94,293.66]];
  const AMBIENT_NOTES = [523.25,659.25,783.99,659.25,440.00,523.25,659.25,523.25,349.23,440.00,523.25,440.00,392.00,493.88,587.33,493.88];
  const SHAPES = [
    [[0,0]], [[0,0],[0,1]], [[0,0],[0,1],[0,2]], [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0]], [[0,0],[1,0],[2,0]], [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[1,0],[1,1]], [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[1,0],[1,1],[1,2]], [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[1,2]], [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,1]], [[0,0],[1,0],[1,1],[2,1]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]],
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
    [[0,0],[0,1],[0,2],[1,0],[1,1]],
  ];
  const boardEl = document.querySelector('#board');
  const trayEl = document.querySelector('#piece-tray');
  const scoreEl = document.querySelector('#score');
  const bestEl = document.querySelector('#best-score');
  const comboEl = document.querySelector('#combo');
  const comboCard = document.querySelector('#combo-card');
  const piecesLeftEl = document.querySelector('#pieces-left');
  const messageEl = document.querySelector('#board-message');
  const toastEl = document.querySelector('#toast');
  const tipEl = document.querySelector('#tip-text');
  const modalEl = document.querySelector('#modal');
  const modalTitle = document.querySelector('#modal-title');
  const modalKicker = document.querySelector('#modal-kicker');
  const modalCopy = document.querySelector('#modal-copy');
  const modalCta = document.querySelector('#modal-cta');
  const themeToggle = document.querySelector('#theme-toggle');
  const cells = [];
  let board = Array(SIZE * SIZE).fill(null);
  let pieces = [];
  let score = 0;
  let best = readNumber('gridpop-best');
  let combo = 0;
  let selected = null;
  let isOver = false;
  let isResolving = false;
  let gameRun = 0;
  let soundOn = false;
  let musicOn = false;
  let audio;
  let musicMaster = null;
  let musicOscillators = [];
  let musicBeatTimer = null;
  let musicChordTimer = null;
  let musicStep = 0;
  let musicChord = 0;
  let triggeredBalls = new Set();
  let toastTimer;
  let messageTimer;
  let pointerStart = null;
  let pendingRestart = false;

  function readNumber(key) { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } }
  function saveNumber(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Storage may be disabled. */ } }
  function readTheme() { try { return localStorage.getItem('gridpop-theme') === 'dark'; } catch { return false; } }
  function setTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    themeToggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
    themeToggle.title = isDark ? 'Modo claro' : 'Modo escuro';
    themeToggle.innerHTML = isDark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/></svg>';
    document.querySelector('meta[name="theme-color"]').content = isDark ? '#20221f' : '#fbf8f1';
    try { localStorage.setItem('gridpop-theme', isDark ? 'dark' : 'light'); } catch { /* Storage may be disabled. */ }
  }
  function pad(value) { return String(value).padStart(4, '0'); }
  function makeBoard() {
    boardEl.innerHTML = '';
    cells.length = 0;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.index = String(i);
      cell.setAttribute('aria-label', `Linha ${Math.floor(i / SIZE) + 1}, coluna ${i % SIZE + 1}, vazio`);
      cell.addEventListener('click', () => { if (selected !== null) placePiece(selected, i); });
      boardEl.append(cell);
      cells.push(cell);
    }
  }
  function makePiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return { shape: shape.map(([r,c]) => [r,c]), color: COLORS[Math.floor(Math.random() * COLORS.length)], used: false };
  }
  function dealPieces() { pieces = [makePiece(), makePiece(), makePiece()]; selected = null; renderTray(); }
  function renderTray() {
    trayEl.innerHTML = '';
    pieces.forEach((piece, index) => {
      const slot = document.createElement('div');
      slot.className = `piece-slot${piece.used ? ' used' : ''}${selected === index ? ' selected' : ''}`;
      slot.dataset.piece = String(index);
      slot.setAttribute('role', 'button');
      slot.setAttribute('tabindex', piece.used ? '-1' : '0');
      slot.setAttribute('aria-label', `Peça ${index + 1}, ${piece.shape.length} quadrados${piece.used ? ', usada' : ''}`);
      slot.setAttribute('aria-pressed', String(selected === index));
      const maxRow = Math.max(...piece.shape.map(([r]) => r));
      const maxCol = Math.max(...piece.shape.map(([,c]) => c));
      const shapeEl = document.createElement('div');
      shapeEl.className = 'piece-shape';
      shapeEl.style.gridTemplateColumns = `repeat(${maxCol + 1}, 19px)`;
      shapeEl.style.setProperty('--piece-color', piece.color);
      const occupied = new Set(piece.shape.map(([r,c]) => `${r}:${c}`));
      for (let r = 0; r <= maxRow; r++) for (let c = 0; c <= maxCol; c++) {
        const block = document.createElement('span');
        block.className = occupied.has(`${r}:${c}`) ? 'piece-block' : 'piece-empty';
        shapeEl.append(block);
      }
      slot.append(shapeEl);
      slot.addEventListener('pointerdown', (event) => {
        if (piece.used || isOver || isResolving) return;
        pointerStart = { id: index, x: event.clientX, y: event.clientY, dragging: false };
      });
      slot.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleSelected(index); }
      });
      trayEl.append(slot);
    });
    piecesLeftEl.textContent = String(pieces.filter(p => !p.used).length);
  }
  function toggleSelected(index) {
    if (isOver || isResolving || pieces[index]?.used) return;
    selected = selected === index ? null : index;
    renderTray();
    if (selected !== null) setToast('Agora escolhe onde encaixar.');
  }
  function renderBoard() {
    board.forEach((value, i) => {
      const cell = cells[i];
      cell.classList.remove('preview-valid', 'preview-invalid');
      cell.classList.toggle('filled', Boolean(value));
      if (value) cell.style.setProperty('--cell-color', value);
      else cell.style.removeProperty('--cell-color');
      cell.setAttribute('aria-label', `Linha ${Math.floor(i / SIZE) + 1}, coluna ${i % SIZE + 1}, ${value ? 'ocupado' : 'vazio'}`);
    });
  }
  function canPlace(piece, row, col) {
    return piece.shape.every(([dr,dc]) => row + dr >= 0 && row + dr < SIZE && col + dc >= 0 && col + dc < SIZE && !board[(row + dr) * SIZE + col + dc]);
  }
  function paintPreview(piece, row, col) {
    cells.forEach(cell => cell.classList.remove('preview-valid', 'preview-invalid'));
    const valid = canPlace(piece, row, col);
    piece.shape.forEach(([dr,dc]) => {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) cells[r * SIZE + c].classList.add(valid ? 'preview-valid' : 'preview-invalid');
    });
  }
  function clearPreview() { cells.forEach(cell => cell.classList.remove('preview-valid', 'preview-invalid')); }
  function placePiece(pieceIndex, index) {
    if (isOver || isResolving || pieces[pieceIndex]?.used) return;
    const currentRun = gameRun;
    const piece = pieces[pieceIndex];
    const row = Math.floor(index / SIZE), col = index % SIZE;
    if (!canPlace(piece, row, col)) { playTone(150, .07); setToast('Aqui não encaixa. Experimenta outro espaço.'); return; }
    piece.shape.forEach(([dr,dc]) => { const target = (row + dr) * SIZE + col + dc; board[target] = piece.color; cells[target].classList.add('placing'); });
    piece.used = true;
    selected = null;
    playTone(420, .07);
    let gained = piece.shape.length * 10;
    const placedIndices = piece.shape.map(([dr, dc]) => (row + dr) * SIZE + col + dc);
    const placedSet = new Set(placedIndices);
    const linkedCells = new Set();
    let colorLinks = 0;
    for (const index of placedIndices) {
      const r = Math.floor(index / SIZE), c = index % SIZE;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !placedSet.has(nr * SIZE + nc) && board[nr * SIZE + nc] === piece.color) {
          colorLinks++;
          linkedCells.add(index);
          linkedCells.add(nr * SIZE + nc);
        }
      }
    }
    const symbols = findNewSymbols();
    const symbolCells = new Set(symbols.filter(symbol => symbol.type !== 'ball').flatMap(symbol => symbol.cells));
    const ballCells = new Set(symbols.filter(symbol => symbol.type === 'ball').flatMap(symbol => symbol.cells));
    const arrowTargets = symbols.filter(symbol => symbol.target !== undefined).map(symbol => symbol.target);
    const symbolBonus = symbols.reduce((total, symbol) => total + symbol.bonus, 0);
    const resolvedBoard = board.slice();
    symbols.forEach(symbol => {
      if (symbol.target !== undefined) resolvedBoard[symbol.target] = symbol.color;
    });
    const ballRingCells = new Set();
    symbols.filter(symbol => symbol.type === 'ball').forEach(symbol => {
      const ballCells = new Set(symbol.cells);
      symbol.cells.forEach(index => {
        const r = Math.floor(index / SIZE), c = index % SIZE;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
          const target = nr * SIZE + nc;
          if (resolvedBoard[target] && !ballCells.has(target)) ballRingCells.add(target);
        }
      });
    });
    ballRingCells.forEach(index => { resolvedBoard[index] = null; });
    symbolCells.forEach(index => { resolvedBoard[index] = null; });
    const rows = [], cols = [];
    for (let r = 0; r < SIZE; r++) if (resolvedBoard.slice(r * SIZE, (r + 1) * SIZE).every(Boolean)) rows.push(r);
    for (let c = 0; c < SIZE; c++) if (Array.from({length: SIZE}, (_,r) => resolvedBoard[r * SIZE + c]).every(Boolean)) cols.push(c);
    const lineCount = rows.length + cols.length;
    gained += colorLinks * 25 + symbolBonus;
    const cleared = new Set([...symbolCells, ...ballRingCells]);
    rows.forEach(r => { for (let c = 0; c < SIZE; c++) cleared.add(r * SIZE + c); });
    cols.forEach(c => { for (let r = 0; r < SIZE; r++) cleared.add(r * SIZE + c); });
    if (lineCount) {
      combo++;
      gained += lineCount * 100 + (lineCount > 1 ? (lineCount - 1) * 50 : 0) + Math.max(0, combo - 1) * 50;
      comboEl.textContent = `× ${combo}`;
      comboCard.classList.add('active');
    } else {
      combo = 0;
      comboEl.textContent = '× 0';
      comboCard.classList.remove('active');
    }
    if (cleared.size) {
      cleared.forEach(i => cells[i].classList.add('clearing'));
      symbolCells.forEach((i, order) => {
        cells[i].classList.add('symbol-clearing');
        cells[i].style.setProperty('--symbol-delay', `${Math.min(order, 6) * 25}ms`);
      });
      ballRingCells.forEach((i, order) => {
        cells[i].classList.add('ball-clearing');
        cells[i].style.setProperty('--ball-delay', `${Math.min(order, 7) * 25}ms`);
      });
      ballCells.forEach(i => cells[i].classList.add('ball-source'));
      isResolving = true;
      setTimeout(() => {
        if (currentRun !== gameRun) return;
        board = resolvedBoard;
        cleared.forEach(i => {
          board[i] = null;
          cells[i].classList.remove('clearing', 'symbol-clearing', 'ball-clearing', 'ball-source');
          cells[i].style.removeProperty('--symbol-delay');
          cells[i].style.removeProperty('--ball-delay');
        });
        ballCells.forEach(i => cells[i].classList.remove('ball-source'));
        arrowTargets.filter(target => !cleared.has(target)).forEach(target => cells[target].classList.add('arrow-spawn'));
        renderBoard();
        arrowTargets.filter(target => !cleared.has(target)).forEach(target => setTimeout(() => cells[target].classList.remove('arrow-spawn'), 650));
        isResolving = false;
        pruneBallTriggers();
        checkGameOver();
      }, symbols.length ? 800 : 260);
    } else if (ballCells.size) {
      ballCells.forEach(i => cells[i].classList.add('ball-source'));
      setTimeout(() => { if (currentRun === gameRun) ballCells.forEach(i => cells[i].classList.remove('ball-source')); }, 850);
    }
    if (symbols.length) {
      const names = { smile: 'SORRISO', ball: 'BOLA', arrow: 'SETA' };
      const symbolLabel = symbols.length > 1 ? 'SÍMBOLOS' : names[symbols[0].type];
      showMessage(`${symbolLabel}! +${symbolBonus}`, true, symbols[0].icon);
      tipEl.textContent = symbols.some(symbol => symbol.type === 'arrow') ? 'A seta lançou um bloco na direção da ponta.' : symbols.some(symbol => symbol.type === 'ball') ? 'A bola limpou o anel à sua volta e ficou no tabuleiro.' : 'Símbolo monocromático encontrado! Procura outra forma.';
      const firstType = symbols[0].type;
      playNotes(firstType === 'arrow' ? [440, 587.33, 880] : firstType === 'ball' ? [392, 523.25, 659.25, 783.99] : [523.25, 659.25, 783.99, 1046.5], .08);
    } else if (lineCount) {
      showMessage(colorLinks ? `LINHAS! +${lineCount * 100} · CORES!` : lineCount > 1 ? `${lineCount} LINHAS!` : combo > 1 ? `× ${combo} COMBO!` : 'BOA!');
      playNotes(lineCount > 1 ? [523.25, 659.25, 783.99] : [659.25, 783.99], .08);
      tipEl.textContent = lineCount > 1 ? 'Várias linhas de uma vez: isso é que é ritmo.' : combo > 1 ? `${combo} limpezas seguidas. Continua assim!` : 'Boa! Mantém as limpezas a acontecer.';
    } else if (colorLinks) {
      showMessage(`LIGAÇÃO! +${colorLinks * 25}`);
      tipEl.textContent = `${colorLinks} ligação${colorLinks > 1 ? 'ões' : ''} de cor. Continua a ligar!`;
      playNotes([659.25, 880], .07);
    }
    score += gained;
    scoreEl.textContent = pad(score);
    if (score > best) { best = score; bestEl.textContent = pad(best); saveNumber('gridpop-best', best); }
    renderBoard();
    if (linkedCells.size) {
      linkedCells.forEach(i => cells[i].classList.add('color-linked'));
      setTimeout(() => linkedCells.forEach(i => cells[i].classList.remove('color-linked')), 650);
    }
    renderTray();
    if (pieces.every(p => p.used)) dealPieces();
    if (!isResolving) setTimeout(() => { if (currentRun === gameRun) checkGameOver(); }, 0);
  }
  function findSymbols() {
    const found = [];
    const reserved = new Set();
    const addPattern = (type, points, icon, height, width, pattern, directions = null) => {
      for (let r = 0; r <= SIZE - height; r++) for (let c = 0; c <= SIZE - width; c++) {
        const indices = pattern.map(([dr, dc]) => (r + dr) * SIZE + c + dc);
        if (indices.some(index => reserved.has(index))) continue;
        const color = board[indices[0]];
        if (!color || indices.some(index => board[index] !== color)) continue;
        let target;
        let arrow = icon;
        if (directions) {
          const [dr, dc, tr, tc, directionIcon] = directions;
          let targetRow = r + tr, targetCol = c + tc;
          while (targetRow >= 0 && targetRow < SIZE && targetCol >= 0 && targetCol < SIZE) {
            const candidate = targetRow * SIZE + targetCol;
            if (!board[candidate]) { target = candidate; break; }
            targetRow += dr;
            targetCol += dc;
          }
          if (target === undefined) continue;
          arrow = directionIcon;
        }
        indices.forEach(index => reserved.add(index));
        found.push({ type, bonus: points, icon: arrow, cells: indices, color, row: r, col: c, height, width, ...(target === undefined ? {} : { target }) });
      }
    };
    addPattern('smile', 250, '☺', 5, 5, [[0,1],[0,3],[2,0],[2,4],[3,1],[3,3],[4,2]]);
    const ball = [[0,1],[0,2], ...[0,1,2,3].map(c => [1,c]), ...[0,1,2,3].map(c => [2,c]), [3,1],[3,2]];
    addPattern('ball', 500, '⚽', 4, 4, ball);
    const right = [[2,2],[2,3],[2,4],[2,5],[2,6],[1,5],[3,5]];
    const left = right.map(([r,c]) => [r,6-c]);
    const down = right.map(([r,c]) => [c,r]);
    const up = right.map(([r,c]) => [6-c,r]);
    addPattern('arrow', 150, '→', 5, 7, right, [0,1,2,7,'→']);
    addPattern('arrow', 150, '←', 5, 7, left, [0,-1,2,-1,'←']);
    addPattern('arrow', 150, '↓', 7, 5, down, [1,0,7,2,'↓']);
    addPattern('arrow', 150, '↑', 7, 5, up, [-1,0,-1,2,'↑']);
    return found;
  }
  function ballKey(symbol) { return `${symbol.row}:${symbol.col}:${symbol.color}`; }
  function findNewSymbols() {
    const matches = findSymbols();
    const activeBallKeys = new Set(matches.filter(symbol => symbol.type === 'ball').map(ballKey));
    triggeredBalls = new Set([...triggeredBalls].filter(key => activeBallKeys.has(key)));
    const fresh = matches.filter(symbol => symbol.type !== 'ball' || !triggeredBalls.has(ballKey(symbol)));
    fresh.filter(symbol => symbol.type === 'ball').forEach(symbol => triggeredBalls.add(ballKey(symbol)));
    return fresh;
  }
  function pruneBallTriggers() {
    const activeBallKeys = new Set(findSymbols().filter(symbol => symbol.type === 'ball').map(ballKey));
    triggeredBalls = new Set([...triggeredBalls].filter(key => activeBallKeys.has(key)));
  }
  function hasMove() {
    return pieces.some(piece => !piece.used && Array.from({length: SIZE * SIZE}, (_, i) => canPlace(piece, Math.floor(i / SIZE), i % SIZE)).some(Boolean));
  }
  function checkGameOver() {
    if (isOver || isResolving || hasMove()) return;
    isOver = true;
    selected = null;
    renderTray();
    openModal({ over: true });
  }
  function setToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1700);
  }
  function showMessage(text, symbol = false, icon = '☺') {
    messageEl.textContent = text;
    messageEl.classList.toggle('symbol-message', symbol);
    if (symbol) messageEl.dataset.symbol = icon;
    else delete messageEl.dataset.symbol;
    messageEl.classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { messageEl.classList.remove('show', 'symbol-message'); delete messageEl.dataset.symbol; }, 1000);
  }
  function playTone(frequency, duration) {
    if (!soundOn) return;
    try {
      getAudioContext();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.055, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }
  function getAudioContext() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      audio.addEventListener('statechange', () => {
        if (audio.state === 'running' && musicOn) startAmbientLoops();
      });
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }
  function playNotes(frequencies, spacing = .08) {
    if (!soundOn) return;
    try {
      getAudioContext();
      frequencies.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const envelope = audio.createGain();
        const start = audio.currentTime + index * spacing;
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, start);
        envelope.gain.setValueAtTime(.0001, start);
        envelope.gain.exponentialRampToValueAtTime(.045, start + .012);
        envelope.gain.exponentialRampToValueAtTime(.0001, start + .13);
        oscillator.connect(envelope);
        envelope.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + .15);
      });
    } catch { /* Audio is optional. */ }
  }
  function startAmbientMusic() {
    try {
      getAudioContext();
      if (musicMaster) return;
      musicMaster = audio.createGain();
      musicMaster.gain.setValueAtTime(0, audio.currentTime);
      musicMaster.gain.linearRampToValueAtTime(.42, audio.currentTime + 1.4);
      musicMaster.connect(audio.destination);
      musicOscillators = AMBIENT_CHORDS[0].map((frequency, index) => {
        const oscillator = audio.createOscillator();
        const voiceGain = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        voiceGain.gain.value = [.08, .05, .035][index];
        oscillator.connect(voiceGain);
        voiceGain.connect(musicMaster);
        oscillator.start();
        return oscillator;
      });
      musicStep = 0;
      musicChord = 0;
      if (audio.state === 'running') startAmbientLoops();
    } catch {
      musicOn = false;
      const button = document.querySelector('#music-toggle');
      button.classList.remove('music-on');
      button.setAttribute('aria-label', 'Ativar música ambiente');
      button.setAttribute('aria-pressed', 'false');
      setToast('Não foi possível iniciar a música neste navegador.');
    }
  }
  function startAmbientLoops() {
    if (!musicOn || !musicMaster || audio.state !== 'running' || musicBeatTimer) return;
    musicChordTimer = setInterval(() => {
      if (!musicOn || !musicMaster) return;
      musicChord = (musicChord + 1) % AMBIENT_CHORDS.length;
      AMBIENT_CHORDS[musicChord].forEach((frequency, index) => {
        const parameter = musicOscillators[index].frequency;
        parameter.cancelScheduledValues(audio.currentTime);
        parameter.setValueAtTime(frequency, audio.currentTime);
      });
    }, 8000);
    const playAmbientNote = () => {
      if (!musicOn || !musicMaster || audio.state !== 'running') return;
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const now = audio.currentTime;
      oscillator.type = 'triangle';
      oscillator.frequency.value = AMBIENT_NOTES[musicStep % AMBIENT_NOTES.length];
      musicStep++;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(.075, now + .025);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + .18);
      oscillator.connect(envelope);
      envelope.connect(musicMaster);
      oscillator.start(now);
      oscillator.stop(now + .2);
    };
    playAmbientNote();
    musicBeatTimer = setInterval(playAmbientNote, 500);
  }
  function stopAmbientMusic() {
    clearInterval(musicBeatTimer);
    clearInterval(musicChordTimer);
    musicBeatTimer = musicChordTimer = null;
    if (!musicMaster || !audio) return;
    const master = musicMaster;
    const now = audio.currentTime;
    if (audio.state === 'suspended') {
      musicOscillators.forEach(oscillator => { try { oscillator.stop(); } catch { /* Already stopped. */ } });
      try { master.disconnect(); } catch { /* Already disconnected. */ }
      musicOscillators = [];
      musicMaster = null;
      return;
    }
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, .0001), now);
    master.gain.linearRampToValueAtTime(.0001, now + .55);
    musicOscillators.forEach(oscillator => { try { oscillator.stop(now + .6); } catch { /* Already stopped. */ } });
    setTimeout(() => { try { master.disconnect(); } catch { /* Already disconnected. */ } }, 700);
    musicOscillators = [];
    musicMaster = null;
  }
  function openModal({ over = false, restart = false } = {}) {
    pendingRestart = restart;
    modalKicker.textContent = over ? 'FIM DE JOGO' : restart ? 'NOVO JOGO' : 'GRIDPOP 101';
    modalTitle.textContent = over ? 'Boa jogada.' : restart ? 'Começar de novo?' : 'Como jogar';
    modalCopy.textContent = over ? `Fizeste ${pad(score)} pontos. O teu melhor é ${pad(best)}. Preparado para mais uma?` : restart ? 'A pontuação desta ronda será reposta. O teu recorde fica guardado.' : 'Arrasta uma peça para o tabuleiro ou toca primeiro numa peça e depois no sítio onde a queres colocar.';
    modalCta.innerHTML = over ? 'JOGAR OUTRA VEZ <span>↗</span>' : restart ? 'NOVO JOGO <span>↗</span>' : 'VAMOS A ISSO <span>↗</span>';
    modalEl.hidden = false;
    document.querySelector('#modal-close').focus();
  }
  function newGame() {
    gameRun++;
    isResolving = false;
    pointerStart = null;
    triggeredBalls.clear();
    board = Array(SIZE * SIZE).fill(null); score = 0; combo = 0; isOver = false; selected = null;
    scoreEl.textContent = '0000'; comboEl.textContent = '× 0'; comboCard.classList.remove('active');
    messageEl.classList.remove('show', 'symbol-message'); delete messageEl.dataset.symbol;
    tipEl.textContent = 'Liga blocos da mesma cor ou forma um sorriso monocromático.';
    makeBoard(); dealPieces(); modalEl.hidden = true;
  }
  document.addEventListener('pointermove', event => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
    if (!pointerStart.dragging && Math.hypot(dx, dy) > 7) {
      pointerStart.dragging = true;
      trayEl.querySelector(`[data-piece="${pointerStart.id}"]`)?.classList.add('dragging');
    }
    if (!pointerStart.dragging) return;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    if (under) {
      const index = Number(under.dataset.index);
      paintPreview(pieces[pointerStart.id], Math.floor(index / SIZE), index % SIZE);
    } else clearPreview();
  });
  document.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const pending = pointerStart; pointerStart = null;
    trayEl.querySelector(`[data-piece="${pending.id}"]`)?.classList.remove('dragging');
    if (pending.dragging) {
      const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
      clearPreview();
      if (under) placePiece(pending.id, Number(under.dataset.index));
      else renderTray();
    } else toggleSelected(pending.id);
  });
  document.querySelector('#sound-toggle').addEventListener('click', event => {
    soundOn = !soundOn;
    event.currentTarget.setAttribute('aria-label', soundOn ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros');
    event.currentTarget.setAttribute('aria-pressed', String(soundOn));
    event.currentTarget.classList.toggle('sound-on', soundOn);
    setToast(soundOn ? 'Efeitos sonoros ativados.' : 'Efeitos sonoros desativados.');
    if (soundOn) playTone(520, .08);
  });
  document.querySelector('#music-toggle').addEventListener('click', event => {
    musicOn = !musicOn;
    event.currentTarget.classList.toggle('music-on', musicOn);
    event.currentTarget.setAttribute('aria-label', musicOn ? 'Desativar música ambiente' : 'Ativar música ambiente');
    event.currentTarget.setAttribute('aria-pressed', String(musicOn));
    if (musicOn) {
      startAmbientMusic();
      if (musicOn) setToast('Música ambiente ativada.');
    } else {
      stopAmbientMusic();
      setToast('Música ambiente desativada.');
    }
  });
  themeToggle.addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
  document.querySelector('#help-button').addEventListener('click', () => openModal());
  document.querySelector('#restart-button').addEventListener('click', () => openModal({ restart: true }));
  document.querySelector('#modal-close').addEventListener('click', () => { modalEl.hidden = true; });
  modalCta.addEventListener('click', () => { if (pendingRestart || isOver) newGame(); else modalEl.hidden = true; });
  modalEl.addEventListener('click', event => { if (event.target === modalEl && !isOver) modalEl.hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !isOver) modalEl.hidden = true; });
  const unlockAudio = () => {
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  bestEl.textContent = pad(best);
  soundOn = true;
  musicOn = true;
  const soundToggle = document.querySelector('#sound-toggle');
  const musicToggle = document.querySelector('#music-toggle');
  soundToggle.classList.add('sound-on');
  soundToggle.setAttribute('aria-label', 'Desativar efeitos sonoros');
  soundToggle.setAttribute('aria-pressed', 'true');
  musicToggle.classList.add('music-on');
  musicToggle.setAttribute('aria-label', 'Desativar música ambiente');
  musicToggle.setAttribute('aria-pressed', 'true');
  setTheme(readTheme());
  startAmbientMusic();
  makeBoard(); dealPieces();
})();
