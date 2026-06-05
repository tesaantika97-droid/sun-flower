/* ==========================================
   FIND THE GOLDEN FLOWER - GAME MOTOR (JS)
   Clean, Optimized, Self-Contained
   ========================================== */

// Konfigurasi & Variabel State Game
const OTHER_FLOWERS = ['🌷', '🌹', '🌼', '🪻', '🌸', '🌺', '🏵️', '💮', '🪷', '💐'];
const TIME_LIMIT = 30.0; // Waktu awal permainan
const MATCH_POINTS = 10;
const TIME_BONUS = 3.0; // Bonus waktu saat level up
const TIME_PENALTY = 1.0; // Penalti waktu saat salah pilih

let score = 0;
let highScore = 0;
let level = 1;
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let isGameActive = false;
let isTransitioning = false;
let goldenFlowerIndex = -1;

// Web Audio API Context
let audioCtx = null;

// DOM Elements
const grid = document.getElementById('grid');
const scoreVal = document.getElementById('scoreVal');
const highScoreVal = document.getElementById('highScoreVal');
const levelVal = document.getElementById('levelVal');
const timerVal = document.getElementById('timerVal');
const timerBar = document.getElementById('timerBar');
const timerCard = document.querySelector('.timer-card');

// Modals & Notices
const startModal = document.getElementById('startModal');
const gameOverModal = document.getElementById('gameOverModal');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const levelNoticeOverlay = document.getElementById('levelNoticeOverlay');
const levelNotice = document.getElementById('levelNotice');
const levelNoticeBonus = document.getElementById('levelNoticeBonus');

const finalLevelVal = document.getElementById('finalLevel');
const finalScoreVal = document.getElementById('finalScore');
const newHighScoreAlert = document.getElementById('newHighScoreAlert');

// Inisialisasi awal saat load halaman
window.addEventListener('DOMContentLoaded', () => {
    loadHighScore();
    
    // Bind Event Listeners
    startButton.addEventListener('click', () => {
        playClickSound();
        hideModal(startModal);
        startGame();
    });
    
    restartButton.addEventListener('click', () => {
        playClickSound();
        hideModal(gameOverModal);
        startGame();
    });
});

// Load High Score dari localStorage
function loadHighScore() {
    const saved = localStorage.getItem('golden_flower_highscore');
    if (saved !== null) {
        highScore = parseInt(saved, 10);
    } else {
        highScore = 0;
    }
    highScoreVal.textContent = highScore;
}

// Update High Score jika skor sekarang lebih tinggi
function saveHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('golden_flower_highscore', highScore);
        highScoreVal.textContent = highScore;
        return true; // Menandakan ada rekor baru
    }
    return false;
}

// Inisialisasi Audio Context secara aman
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Helper Generator Nada Suara
function playTone(freq, duration, startTime, type = 'sine', volume = 0.15) {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.value = freq;
    
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
}

// Sound Effects
function playClickSound() {
    initAudio();
    if (!audioCtx) return;
    playTone(600, 0.08, audioCtx.currentTime, 'sine', 0.1);
}

function playSuccessChime() {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Arpeggio C Mayor ceria
    playTone(523.25, 0.12, now, 'triangle', 0.15); // C5
    playTone(659.25, 0.12, now + 0.08, 'triangle', 0.15); // E5
    playTone(783.99, 0.12, now + 0.16, 'triangle', 0.15); // G5
    playTone(1046.50, 0.25, now + 0.24, 'sine', 0.2); // C6
}

function playWrongBuzz() {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.2);
    
    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.linearRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
}

function playGameOverJingle() {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    playTone(349.23, 0.18, now, 'triangle', 0.15); // F4
    playTone(311.13, 0.18, now + 0.18, 'triangle', 0.15); // Eb4
    playTone(277.18, 0.22, now + 0.36, 'triangle', 0.15); // Db4
    playTone(220.00, 0.45, now + 0.58, 'sine', 0.2); // A3
}

// Inisialisasi Papan Permainan (Grid)
function initBoard() {
    grid.innerHTML = '';
    
    // Tentukan indeks acak untuk Bunga Emas
    goldenFlowerIndex = Math.floor(Math.random() * 16);
    
    for (let i = 0; i < 16; i++) {
        const card = document.createElement('button');
        card.className = 'card';
        card.dataset.index = i;
        card.setAttribute('aria-label', `Kartu bunga nomor ${i + 1}`);
        
        const inner = document.createElement('div');
        inner.className = 'card-inner';
        
        const cover = document.createElement('div');
        cover.className = 'card-face card-cover';
        cover.textContent = '🌿'; // Cover belakang kartu
        
        const value = document.createElement('div');
        value.className = 'card-face card-value';
        
        if (i === goldenFlowerIndex) {
            value.textContent = '🌻';
            card.classList.add('golden-flower');
        } else {
            // Pilih emoji bunga biasa acak
            const randFlower = OTHER_FLOWERS[Math.floor(Math.random() * OTHER_FLOWERS.length)];
            value.textContent = randFlower;
        }
        
        inner.appendChild(cover);
        inner.appendChild(value);
        card.appendChild(inner);
        
        // Event listener saat kartu di-klik
        card.addEventListener('click', () => handleCardClick(card, i));
        
        grid.appendChild(card);
    }
}

// Handle Klik Kartu
function handleCardClick(card, index) {
    // Abaikan jika game tidak aktif, sedang transisi, atau kartu sudah terbuka
    if (!isGameActive || isTransitioning || card.classList.contains('flipped')) {
        return;
    }
    
    // Balik kartu
    card.classList.add('flipped');
    
    if (index === goldenFlowerIndex) {
        // MENEMUKAN BUNGA EMAS!
        isTransitioning = true;
        playSuccessChime();
        spawnParticles(card);
        card.classList.add('found-splash');
        
        // Tambah skor dan level
        score += MATCH_POINTS;
        level += 1;
        
        // Tambah bonus waktu (maksimal 30 detik)
        timeLeft = Math.min(TIME_LIMIT, timeLeft + TIME_BONUS);
        
        updateHUD();
        
        // Tampilkan pemberitahuan level up
        showLevelUpNotice();
        
        // Transisi ke level berikutnya setelah delay visual
        setTimeout(() => {
            if (isGameActive) {
                initBoard();
                isTransitioning = false;
            }
        }, 1200);
        
    } else {
        // SALAH PILIH
        playWrongBuzz();
        card.classList.add('wrong-flower');
        
        // Kurangi waktu sebagai penalti
        timeLeft = Math.max(0, timeLeft - TIME_PENALTY);
        updateHUD();
        
        // Animasi goyang (shake)
        card.classList.add('shake');
        card.addEventListener('animationend', () => {
            card.classList.remove('shake');
        }, { once: true });
        
        // Cek jika waktu langsung habis akibat penalti
        if (timeLeft <= 0) {
            endGame();
        }
    }
}

// Update Tampilan Stats Panel & Progress Bar
function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = level;
    
    // Tampilkan integer detik di teks
    const roundedTime = Math.ceil(timeLeft);
    timerVal.textContent = `${roundedTime}s`;
    
    // Update persentase progress bar
    const progressPercent = (timeLeft / TIME_LIMIT) * 100;
    timerBar.style.width = `${progressPercent}%`;
    
    // Beri sinyal warning jika waktu menipis (<= 5 detik)
    if (timeLeft <= 5) {
        timerCard.classList.add('warning');
        timerBar.classList.add('warning');
    } else {
        timerCard.classList.remove('warning');
        timerBar.classList.remove('warning');
    }
}

// Efek Partikel
function spawnParticles(cardElement) {
    const rect = cardElement.getBoundingClientRect();
    // Koordinat relatif terhadap dokumen
    const cardCenterX = rect.left + rect.width / 2 + window.scrollX;
    const cardCenterY = rect.top + rect.height / 2 + window.scrollY;
    
    const colors = ['#FFE066', '#FFD3DA', '#FFFFFF', '#FFB7B2', '#FFDAC1', '#FFF9E6'];
    
    for (let i = 0; i < 24; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Ukuran acak
        const size = Math.floor(Math.random() * 8) + 6;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Warna acak
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Posisi awal di tengah kartu
        particle.style.left = `${cardCenterX - size / 2}px`;
        particle.style.top = `${cardCenterY - size / 2}px`;
        
        // Lintasan terbang acak ke segala arah
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.floor(Math.random() * 90) + 40;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        document.body.appendChild(particle);
        
        // Hapus elemen setelah selesai animasi
        setTimeout(() => {
            particle.remove();
        }, 800);
    }
}

// Level Up Announcement
function showLevelUpNotice() {
    levelNoticeOverlay.classList.remove('hidden');
    levelNotice.classList.add('animate');
    
    // Reset kelas animasi setelah durasinya selesai
    levelNotice.addEventListener('animationend', () => {
        levelNotice.classList.remove('animate');
        levelNoticeOverlay.classList.add('hidden');
    }, { once: true });
}

// Memulai Game Baru
function startGame() {
    // Inisialisasi ulang game state
    score = 0;
    level = 1;
    timeLeft = TIME_LIMIT;
    isGameActive = true;
    isTransitioning = false;
    
    updateHUD();
    initBoard();
    
    // Mulai loop timer 100ms untuk kelancaran progress bar
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(gameTick, 100);
}

// Loop Timer (Jalan setiap 100ms)
function gameTick() {
    if (!isGameActive) return;
    
    // Kurangi waktu
    timeLeft -= 0.1;
    
    if (timeLeft <= 0) {
        timeLeft = 0;
        updateHUD();
        endGame();
    } else {
        updateHUD();
    }
}

// Mengakhiri Game
function endGame() {
    isGameActive = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Play Game Over Jingle
    playGameOverJingle();
    
    // Cek dan simpan rekor high score
    const isNewRecord = saveHighScore();
    
    // Isi data di modal game over
    finalLevelVal.textContent = level;
    finalScoreVal.textContent = score;
    
    if (isNewRecord) {
        newHighScoreAlert.classList.remove('hidden');
    } else {
        newHighScoreAlert.classList.add('hidden');
    }
    
    // Tampilkan modal game over
    showModal(gameOverModal);
}

// Helper Pengaturan Modal
function showModal(modalElement) {
    modalElement.classList.add('show');
}

function hideModal(modalElement) {
    modalElement.classList.remove('show');
}
