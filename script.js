// 설정 상수
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24;

// 캔버스 초기화
const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

// UI 엘리먼트
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const retryBtn = document.getElementById('retry-btn');
const overlay = document.getElementById('game-overlay');
const overlayMsg = document.getElementById('overlay-msg');

// 테트로미노 블록 색상
const COLORS = [
  null,
  '#00f0f0', // I - 시안
  '#0000f0', // J - 파랑
  '#f0a000', // L - 주황
  '#f0f000', // O - 노랑
  '#00f000', // S - 초록
  '#a000f0', // T - 보라
  '#f00000'  // Z - 빨강
];

// 테트로미노 모양 정의
const SHAPES = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 0, 0], [2, 2, 2], [0, 0, 0]],                         // J
  [[0, 0, 3], [3, 3, 3], [0, 0, 0]],                         // L
  [[4, 4], [4, 4]],                                           // O
  [[0, 5, 5], [5, 5, 0], [0, 0, 0]],                         // S
  [[0, 6, 0], [6, 6, 6], [0, 0, 0]],                         // T
  [[7, 7, 0], [0, 7, 7], [0, 0, 0]]                          // Z
];

// 게임 상태 변수
let board = [];
let score = 0;
let lines = 0;
let level = 1;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let isGameOver = false;
let animationId = null;

let currentPiece = null;
let nextPiece = null;

// 보드 생성 (2차원 배열)
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 새로운 블록 생성
function createPiece(type) {
  return {
    type: type,
    shape: SHAPES[type],
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: 0
  };
}

// 랜덤 블록 타입 (1~7)
function getRandomPieceType() {
  return Math.floor(Math.random() * 7) + 1;
}

// 충돌 감지
function collide(board, piece, offset = { x: 0, y: 0 }) {
  const { shape, x, y } = piece;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] !== 0) {
        const newX = x + c + offset.x;
        const newY = y + r + offset.y;

        // 벽 및 바닥 체크
        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return true;
        }
        // 기존 쌓인 블록 체크
        if (newY >= 0 && board[newY][newX] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// 블록 고정
function merge(board, piece) {
  piece.shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) {
        const targetY = piece.y + r;
        const targetX = piece.x + c;
        if (targetY >= 0 && targetY < ROWS && targetX >= 0 && targetX < COLS) {
          board[targetY][targetX] = value;
        }
      }
    });
  });
}

// 회전 (시계 방향)
function rotate(matrix) {
  const N = matrix.length;
  const result = matrix.map((row, i) =>
    row.map((val, j) => matrix[N - 1 - j][i])
  );
  return result;
}

// 플레이어 블록 회전 (월킥 기본 적용)
function playerRotate() {
  if (isPaused || isGameOver) return;
  const originalShape = currentPiece.shape;
  const rotated = rotate(currentPiece.shape);
  currentPiece.shape = rotated;

  // 회전 시 충돌 체크 및 옆으로 밀어넣기(Wall kick)
  let offset = 1;
  while (collide(board, currentPiece)) {
    currentPiece.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > currentPiece.shape[0].length) {
      currentPiece.shape = originalShape; // 되돌리기
      return;
    }
  }
}

// 블록 이동
function playerMove(dir) {
  if (isPaused || isGameOver) return;
  if (!collide(board, currentPiece, { x: dir, y: 0 })) {
    currentPiece.x += dir;
  }
}

// 줄 지우기 및 점수 계산
function clearLines() {
  let cleared = 0;
  outer: for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) {
        continue outer;
      }
    }

    const row = board.splice(r, 1)[0].fill(0);
    board.unshift(row);
    cleared++;
    r++; // 인덱스 유지
  }

  if (cleared > 0) {
    // 테트리스 점수 공식
    const lineScores = [0, 100, 300, 500, 800];
    score += (lineScores[cleared] || 800) * level;
    lines += cleared;

    // 레벨 업 (10줄마다)
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);

    updateScore();
  }
}

// 블록 떨어뜨리기 (소프트 드롭)
function playerDrop() {
  if (isPaused || isGameOver) return;
  if (!collide(board, currentPiece, { x: 0, y: 1 })) {
    currentPiece.y++;
  } else {
    // 고정 처리
    merge(board, currentPiece);
    clearLines();
    resetPiece();
  }
  dropCounter = 0;
}

// 즉시 떨어뜨리기 (하드 드롭)
function playerHardDrop() {
  if (isPaused || isGameOver) return;
  while (!collide(board, currentPiece, { x: 0, y: 1 })) {
    currentPiece.y++;
    score += 2; // 하드드롭 추가 점수
  }
  merge(board, currentPiece);
  clearLines();
  resetPiece();
  updateScore();
  dropCounter = 0;
}

// 새 블록 설정
function resetPiece() {
  currentPiece = nextPiece || createPiece(getRandomPieceType());
  nextPiece = createPiece(getRandomPieceType());

  // 게임 오버 체크
  if (collide(board, currentPiece)) {
    gameOver();
  }
  drawNextPiece();
}

// 고스트 피스(떨어질 위치 미리보기) 위치 계산
function getGhostY() {
  let ghostY = currentPiece.y;
  while (!collide(board, currentPiece, { x: 0, y: ghostY - currentPiece.y + 1 })) {
    ghostY++;
  }
  return ghostY;
}

// 사각형 그리기 (단색 + 테두리 광택 효과)
function drawBlock(context, x, y, colorId, isGhost = false) {
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE;
  const color = COLORS[colorId];

  if (isGhost) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    context.lineWidth = 1;
    context.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    return;
  }

  // 메인 블록
  context.fillStyle = color;
  context.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

  // 상단/좌측 하이라이트
  context.fillStyle = 'rgba(255, 255, 255, 0.3)';
  context.fillRect(px, py, BLOCK_SIZE, 3);
  context.fillRect(px, py, 3, BLOCK_SIZE);

  // 하단/우측 그림자
  context.fillStyle = 'rgba(0, 0, 0, 0.3)';
  context.fillRect(px, py + BLOCK_SIZE - 3, BLOCK_SIZE, 3);
  context.fillRect(px + BLOCK_SIZE - 3, py, 3, BLOCK_SIZE);

  // 경계선
  context.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  context.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
}

// 보드 및 말 그리기
function draw() {
  // 메인 보드 클리어
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 보드 격자선(미세하게)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  for (let c = 0; c < COLS; c++) {
    ctx.strokeRect(c * BLOCK_SIZE, 0, BLOCK_SIZE, canvas.height);
  }

  // 쌓여 있는 블록 그리기
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(ctx, x, y, value);
      }
    });
  });

  if (currentPiece) {
    // 고스트 피스 그리기
    const ghostY = getGhostY();
    currentPiece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== 0) {
          drawBlock(ctx, currentPiece.x + c, ghostY + r, value, true);
        }
      });
    });

    // 현재 조작 중인 블록 그리기
    currentPiece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== 0) {
          drawBlock(ctx, currentPiece.x + c, currentPiece.y + r, value);
        }
      });
    });
  }
}

// Next 블록 그리기
function drawNextPiece() {
  nextCtx.fillStyle = '#0b0e14';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) return;

  const shape = nextPiece.shape;
  const offsetX = (nextCanvas.width - shape[0].length * BLOCK_SIZE) / 2;
  const offsetY = (nextCanvas.height - shape.length * BLOCK_SIZE) / 2;

  shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) {
        const px = offsetX + c * BLOCK_SIZE;
        const py = offsetY + r * BLOCK_SIZE;

        nextCtx.fillStyle = COLORS[value];
        nextCtx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

        nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        nextCtx.fillRect(px, py, BLOCK_SIZE, 2);
        nextCtx.fillRect(px, py, 2, BLOCK_SIZE);

        nextCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        nextCtx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
      }
    });
  });
}

// 점수판 갱신
function updateScore() {
  scoreEl.innerText = score;
  levelEl.innerText = level;
  linesEl.innerText = lines;
}

// 게임 오버
function gameOver() {
  isGameOver = true;
  overlayMsg.innerText = '게임 종료';
  overlay.classList.remove('hidden');
  cancelAnimationFrame(animationId);
}

// 일시정지 토글
function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    overlayMsg.innerText = '일시 정지';
    overlay.classList.remove('hidden');
    retryBtn.style.display = 'none';
  } else {
    overlay.classList.add('hidden');
    retryBtn.style.display = 'block';
    lastTime = performance.now();
    update();
  }
}

// 게임 리셋 및 시작
function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  isGameOver = false;
  isPaused = false;
  retryBtn.style.display = 'block';
  overlay.classList.add('hidden');

  updateScore();
  nextPiece = createPiece(getRandomPieceType());
  resetPiece();

  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  update();
}

// 게임 메인 루프
function update(time = 0) {
  if (isPaused || isGameOver) return;

  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  animationId = requestAnimationFrame(update);
}

// 키보드 컨트롤
document.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault(); // 스크롤 방지
  }

  if (e.key === 'p' || e.key === 'P') {
    togglePause();
    return;
  }

  if (isPaused || isGameOver) return;

  switch (e.key) {
    case 'ArrowLeft':
      playerMove(-1);
      break;
    case 'ArrowRight':
      playerMove(1);
      break;
    case 'ArrowDown':
      playerDrop();
      break;
    case 'ArrowUp':
      playerRotate();
      break;
    case ' ':
      playerHardDrop();
      break;
  }
  draw();
});

// 버튼 이벤트
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
retryBtn.addEventListener('click', startGame);

// 초기 실행
startGame();
