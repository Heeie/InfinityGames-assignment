(() => {
  'use strict';
  const SIZE = 10;
  const COLORS = ['#f3775b', '#f1c95c', '#71b8a5', '#aaa0d5'];
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
  let audio;
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
    const rows = [], cols = [];
    for (let r = 0; r < SIZE; r++) if (board.slice(r * SIZE, (r + 1) * SIZE).every(Boolean)) rows.push(r);
    for (let c = 0; c < SIZE; c++) if (Array.from({length: SIZE}, (_,r) => board[r * SIZE + c]).every(Boolean)) cols.push(c);
    const lineCount = rows.length + cols.length;
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
    const smiles = findSmiles();
    const smileCells = new Set(smiles.flat());
    gained += colorLinks * 25 + smiles.length * 250;
    if (lineCount) {
      combo++;
      gained += lineCount * 100 + (lineCount > 1 ? (lineCount - 1) * 50 : 0) + Math.max(0, combo - 1) * 50;
      comboEl.textContent = `× ${combo}`;
      comboCard.classList.add('active');
      const cleared = new Set(smileCells);
      rows.forEach(r => { for (let c = 0; c < SIZE; c++) cleared.add(r * SIZE + c); });
      cols.forEach(c => { for (let r = 0; r < SIZE; r++) cleared.add(r * SIZE + c); });
      cleared.forEach(i => cells[i].classList.add('clearing'));
      isResolving = true;
      setTimeout(() => {
        if (currentRun !== gameRun) return;
        cleared.forEach(i => { board[i] = null; cells[i].classList.remove('clearing'); });
        renderBoard();
        isResolving = false;
        checkGameOver();
      }, 260);
      showMessage(smiles.length ? `SORRISO! +${smiles.length * 250}` : colorLinks ? `LIGAÇÃO! +${colorLinks * 25}` : lineCount > 1 ? `${lineCount} LINHAS!` : combo > 1 ? `× ${combo} COMBO!` : 'BOA!');
      playTone(lineCount > 1 ? 720 : 570, .12);
      if (smiles.length) tipEl.textContent = 'Sorriso encontrado! Procura outra forma escondida.';
      else if (colorLinks) tipEl.textContent = `${colorLinks} ligação${colorLinks > 1 ? 'ões' : ''} de cor. Continua a ligar!`;
      else tipEl.textContent = lineCount > 1 ? 'Várias linhas de uma vez: isso é que é ritmo.' : combo > 1 ? `${combo} limpezas seguidas. Continua assim!` : 'Boa! Mantém as limpezas a acontecer.';
    } else {
      combo = 0;
      comboEl.textContent = '× 0';
      comboCard.classList.remove('active');
      if (smiles.length) {
        smileCells.forEach(i => cells[i].classList.add('clearing'));
        isResolving = true;
        setTimeout(() => {
          if (currentRun !== gameRun) return;
          smileCells.forEach(i => { board[i] = null; cells[i].classList.remove('clearing'); });
          renderBoard();
          isResolving = false;
          checkGameOver();
        }, 260);
        showMessage('SORRISO! +250');
        tipEl.textContent = 'Sorriso encontrado! Procura outra forma escondida.';
        playTone(760, .16);
      } else if (colorLinks) {
        showMessage(`LIGAÇÃO! +${colorLinks * 25}`);
        tipEl.textContent = `${colorLinks} ligação${colorLinks > 1 ? 'ões' : ''} de cor. Continua a ligar!`;
      }
    }
    if (lineCount && smiles.length) showMessage(`SORRISO! +${smiles.length * 250}`);
    if (lineCount && !smiles.length && !colorLinks) {
      tipEl.textContent = lineCount > 1 ? 'Várias linhas de uma vez: isso é que é ritmo.' : combo > 1 ? `${combo} limpezas seguidas. Continua assim!` : 'Boa! Mantém as limpezas a acontecer.';
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
  function findSmiles() {
    const pattern = [[0,1],[0,3],[2,0],[2,4],[3,1],[3,3],[4,2]];
    const found = [];
    for (let r = 0; r <= SIZE - 5; r++) for (let c = 0; c <= SIZE - 5; c++) {
      if (pattern.every(([dr, dc]) => board[(r + dr) * SIZE + c + dc])) {
        found.push(pattern.map(([dr, dc]) => (r + dr) * SIZE + c + dc));
      }
    }
    return found;
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
  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => messageEl.classList.remove('show'), 850);
  }
  function playTone(frequency, duration) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.055, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch { /* Audio is optional. */ }
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
    board = Array(SIZE * SIZE).fill(null); score = 0; combo = 0; isOver = false; selected = null;
    scoreEl.textContent = '0000'; comboEl.textContent = '× 0'; comboCard.classList.remove('active');
    messageEl.classList.remove('show'); tipEl.textContent = 'Liga blocos da mesma cor ou forma um sorriso.';
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
    event.currentTarget.setAttribute('aria-label', soundOn ? 'Desativar som' : 'Ativar som');
    event.currentTarget.classList.toggle('sound-on', soundOn);
    setToast(soundOn ? 'Som ativado.' : 'Som desativado.');
    if (soundOn) playTone(520, .08);
  });
  themeToggle.addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
  document.querySelector('#help-button').addEventListener('click', () => openModal());
  document.querySelector('#restart-button').addEventListener('click', () => openModal({ restart: true }));
  document.querySelector('#modal-close').addEventListener('click', () => { modalEl.hidden = true; });
  modalCta.addEventListener('click', () => { if (pendingRestart || isOver) newGame(); else modalEl.hidden = true; });
  modalEl.addEventListener('click', event => { if (event.target === modalEl && !isOver) modalEl.hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !isOver) modalEl.hidden = true; });
  bestEl.textContent = pad(best);
  setTheme(readTheme());
  makeBoard(); dealPieces();
})();
