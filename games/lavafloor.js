// ===================================================================
// 🌋 Sàn Nham Thạch — mini-game "Vui nhộn" cho Giveaway Live Tool
// Tải riêng khi người dùng chọn mode Sàn Nham Thạch (không nằm trong bundle chính).
//
// Cơ chế: mỗi người đứng trên 1 ô sàn phía trên biển nham thạch. Từng đợt,
// một số ô sàn được chọn ngẫu nhiên để sập — người đứng trên đó rơi xuống
// nham thạch (kèm hiệu ứng bắn tung) và bị loại. Lịch trình sập ô được canh
// đều trong đúng số giây (durationSec) người dùng đặt, để đúng lúc hết giờ
// chỉ còn lại đúng 1 người.
//
// API: window.runLavaFloor(users, containerEl, durationSec, onFinish)
// ===================================================================
(function () {
    const ASPECT_RATIO = 420 / 760;  // tỉ lệ khung hình (cao/rộng), giữ cố định
    const MAX_PLAYERS = 100;
    const MAX_WAVES = 20;
    const CRACK_LEAD_MS = 500;
    const FALL_DURATION_MS = 700;
    const GRAVITY = 420; // px/s^2 cho hiệu ứng hạt bắn tung

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function randRange(min, max) { return min + Math.random() * (max - min); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // --- Assets mascot (vẽ bởi Claude Design) — preload 1 lần, dùng chung cho mọi ván chơi ---
    function svgToImage(svgString) {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        return img;
    }

    // Nhân vật nhìn từ trên xuống (top-down) khớp góc camera của game. fill="currentColor" ăn
    // theo style="color:..." nên chỉ cần đổi màu là ra 1 màu áo mới, viền/mặt luôn giữ tông tối.
    function playerSvgString(color) {
        return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="color:${color}">
  <ellipse cx="32" cy="46" rx="15" ry="6" fill="#000000" opacity="0.35"/>
  <path d="M18 42 C17 32 22 25 32 25 C42 25 47 32 46 42 C46 48 40 51 32 51 C24 51 18 48 18 42 Z" fill="currentColor" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
  <ellipse cx="24" cy="30" rx="4" ry="6" fill="currentColor" stroke="#150C22" stroke-width="2" transform="rotate(-18 24 30)"/>
  <ellipse cx="40" cy="30" rx="4" ry="6" fill="currentColor" stroke="#150C22" stroke-width="2" transform="rotate(18 40 30)"/>
  <circle cx="32" cy="20" r="12" fill="#F2C38A" stroke="#150C22" stroke-width="2.5"/>
  <path d="M20 17 Q32 5 44 17 Q44 10 32 9 Q20 10 20 17 Z" fill="currentColor" stroke="#150C22" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="27" cy="21" r="2.2" fill="#150C22"/>
  <circle cx="37" cy="21" r="2.2" fill="#150C22"/>
  <circle cx="27.7" cy="20.3" r="0.7" fill="#FFFFFF"/>
  <circle cx="37.7" cy="20.3" r="0.7" fill="#FFFFFF"/>
  <path d="M28 26 Q32 28 36 26" stroke="#150C22" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;
    }

    const CRACKED_TILE_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="6" width="52" height="52" rx="8" fill="#4A3B63" stroke="#150C22" stroke-width="2.5"/>
  <rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#FF5470" stroke-width="2.5" stroke-dasharray="6 5"/>
  <path d="M14 14 L26 26 L20 32 L36 40 L30 50 L48 50" fill="none" stroke="#150C22" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M14 14 L26 26 L20 32 L36 40 L30 50 L48 50" fill="none" stroke="#FF8C14" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M40 10 L46 20 L38 24 L48 32" fill="none" stroke="#150C22" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M40 10 L46 20 L38 24 L48 32" fill="none" stroke="#FFC93C" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

    // Giọt nham thạch bắn tung — đổi màu ngoài (đỏ/cam/vàng) để tạo cảm giác đa dạng như hạt lửa thật
    function lavaParticleSvgString(outerColor) {
        return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8 C40 22 46 30 46 40 C46 49 40 55 32 55 C24 55 18 49 18 40 C18 30 24 22 32 8 Z" fill="${outerColor}" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M32 18 C37 28 41 33 41 40 C41 46 37 50 32 50 C27 50 23 46 23 40 C23 33 27 28 32 18 Z" fill="#FFC93C" opacity="0.85"/>
  <ellipse cx="27" cy="38" rx="3.5" ry="5" fill="#FFFFFF" opacity="0.55"/>
</svg>`;
    }

    // 10 màu áo — mỗi người chơi được gán ngẫu nhiên 1 trong 10 ảnh này
    const PLAYER_COLORS = ['#22D3EE', '#EC4899', '#8B5CF6', '#FFC93C', '#34D399', '#FB923C', '#60A5FA', '#F43F5E', '#A3E635', '#E879F9'];
    const playerImages = PLAYER_COLORS.map(c => svgToImage(playerSvgString(c)));
    const crackedTileImg = svgToImage(CRACKED_TILE_SVG);
    const LAVA_PARTICLE_COLORS = ['#FF5470', '#FF8C14', '#FFC93C'];
    const lavaParticleImages = LAVA_PARTICLE_COLORS.map(c => svgToImage(lavaParticleSvgString(c)));

    window.runLavaFloor = function (users, containerEl, durationSec, onFinish) {
        const duration = (typeof durationSec === 'number' && durationSec > 0) ? durationSec : 15;
        const durationMs = duration * 1000;

        let players = users.slice();
        let sampled = false;
        if (players.length > MAX_PLAYERS) {
            players = shuffle(players).slice(0, MAX_PLAYERS);
            sampled = true;
        }
        players = shuffle(players);
        const n = players.length;

        containerEl.innerHTML = `
            <h3 style="margin:0 0 6px;font-family:'Baloo 2', sans-serif;font-size:16px;color:var(--pink);">🌋 Sàn Nham Thạch — còn <span id="lavaTimeLeft">${duration}</span>s | Sống sót: <span id="lavaAliveCount">${n}</span></h3>
            ${sampled ? `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">Danh sách có ${users.length} người, đã chọn ngẫu nhiên ${MAX_PLAYERS} người để chơi.</div>` : ''}
            <canvas id="lavaCanvas" style="width:100%; display:block; border-radius:16px; border:1px solid var(--border);"></canvas>
        `;

        const canvas = containerEl.querySelector('#lavaCanvas');
        const ctx = canvas.getContext('2d');
        const timeLeftEl = containerEl.querySelector('#lavaTimeLeft');
        const aliveCountEl = containerEl.querySelector('#lavaAliveCount');

        // --- Thiết lập canvas theo đúng mật độ điểm ảnh màn hình để hết mờ/nhòe ---
        const dpr = window.devicePixelRatio || 1;
        const W = Math.max(320, containerEl.clientWidth || 760); // chiều rộng logic theo khung hiển thị thật
        const H = Math.round(W * ASPECT_RATIO);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // vẽ theo toạ độ logic W×H, canvas tự nét trên màn Retina

        // --- Bố cục lưới ô sàn theo tỉ lệ W×H, không phụ thuộc số lượng ---
        const cols = Math.max(1, Math.round(Math.sqrt(n * (W / H))));
        const rows = Math.max(1, Math.ceil(n / cols));
        const tileW = W / cols;
        const tileH = H / rows;
        const emojiSize = clamp(Math.min(tileW, tileH) * 0.62, 14, 40);
        const nameSize = clamp(tileW * 0.17, 8, 14);
        const nameMaxChars = Math.max(4, Math.round(tileW / (nameSize * 0.62)));

        // --- Lịch trình loại người ---
        const eliminationOrder = shuffle(players.map((_, i) => i));
        const totalEliminations = n - 1;
        const waveCount = Math.max(1, Math.min(totalEliminations, MAX_WAVES));
        const waveSizes = [];
        {
            const base = Math.floor(totalEliminations / waveCount);
            let remainder = totalEliminations % waveCount;
            for (let w = 0; w < waveCount; w++) {
                waveSizes.push(base + (remainder > 0 ? 1 : 0));
                if (remainder > 0) remainder--;
            }
        }
        const waves = [];
        {
            let cursor = 0;
            for (let w = 0; w < waveCount; w++) {
                const size = waveSizes[w];
                const indices = eliminationOrder.slice(cursor, cursor + size);
                cursor += size;
                const time = durationMs * (w + 1) / waveCount;
                waves.push({ time, indices, triggeredCrack: false, triggeredFall: false });
            }
        }
        const winnerIdx = eliminationOrder[n - 1] !== undefined ? eliminationOrder[n - 1] : 0;

        // status: 'alive' | 'cracking' | 'falling' | 'dead'
        const status = players.map(() => 'alive');
        const fallStart = players.map(() => 0);
        // Mỗi người chơi được gán ngẫu nhiên 1 trong 10 màu áo mascot đã vẽ sẵn (preload ở đầu file)
        const playerColorIdx = players.map(() => Math.floor(Math.random() * PLAYER_COLORS.length));

        function tileRect(i) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            return { x: col * tileW, y: row * tileH, w: tileW, h: tileH };
        }

        // --- Hạt nham thạch bắn tung khi sập sàn ---
        let particles = [];
        function spawnSplash(x, y) {
            const count = 10;
            for (let i = 0; i < count; i++) {
                const ang = randRange(Math.PI * 1.15, Math.PI * 1.85); // hướng chủ yếu lên trên
                const speed = randRange(70, 190);
                particles.push({
                    x, y,
                    vx: Math.cos(ang) * speed,
                    vy: Math.sin(ang) * speed,
                    life: 0,
                    maxLife: randRange(380, 680),
                    size: randRange(9, 17),
                    rot: randRange(0, Math.PI * 2),
                    spin: randRange(-4, 4),
                    imgIdx: Math.floor(Math.random() * lavaParticleImages.length)
                });
            }
        }
        function updateParticles(dt) {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.vy += GRAVITY * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.rot += p.spin * dt;
                p.life += dt * 1000;
                if (p.life >= p.maxLife) particles.splice(i, 1);
            }
        }
        function drawParticles() {
            for (const p of particles) {
                const ratio = clamp(1 - p.life / p.maxLife, 0, 1);
                const img = lavaParticleImages[p.imgIdx];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.globalAlpha = ratio * 0.95;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                }
            }
        }

        function drawLava(t) {
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(255,84,112,0.20)');
            grad.addColorStop(1, 'rgba(255,140,20,0.30)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            const rowsWave = 6;
            for (let r = 0; r < rowsWave; r++) {
                const baseY = (r + 0.5) * (H / rowsWave);
                const amp = 5 + (r % 3) * 2;
                const speed = 0.8 + (r % 3) * 0.35;
                const freq = 0.03 + (r % 2) * 0.007;
                ctx.beginPath();
                for (let x = 0; x <= W; x += 14) {
                    const y = baseY + Math.sin(x * freq + t * speed) * amp;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = `rgba(255,201,60,${0.10 + (r % 3) * 0.03})`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
            const embers = 10;
            for (let e = 0; e < embers; e++) {
                const ex = (e * 97 + (t * 40) % W) % W;
                const ey = H - ((e * 53 + t * 60) % H);
                const alpha = 0.15 + 0.15 * Math.abs(Math.sin(t * 1.3 + e));
                ctx.fillStyle = `rgba(255,201,60,${alpha})`;
                ctx.beginPath();
                ctx.arc(ex, ey, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function draw(t, elapsed) {
            ctx.clearRect(0, 0, W, H);
            drawLava(t);

            for (let i = 0; i < n; i++) {
                const rect = tileRect(i);
                const st = status[i];
                const cx = rect.x + rect.w / 2;
                const cy = rect.y + rect.h / 2;

                if (st === 'dead') continue; // hố trống, để lộ nham thạch bên dưới

                let tileColor = 'rgba(255,255,255,0.08)';
                if (st === 'cracking') {
                    const flick = 0.5 + 0.5 * Math.sin(t * 22 + i);
                    tileColor = `rgba(255,84,112,${0.20 + flick * 0.25})`;
                }
                ctx.fillStyle = tileColor;
                const pad = 2;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2, 6);
                else ctx.rect(rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2);
                ctx.fill();
                ctx.strokeStyle = (i === winnerIdx && st === 'alive' && elapsed >= durationMs) ? '#FFC93C' : 'rgba(255,255,255,0.10)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (st === 'cracking' && crackedTileImg && crackedTileImg.complete && crackedTileImg.naturalWidth > 0) {
                    const flick = 0.55 + 0.45 * Math.sin(t * 22 + i);
                    ctx.globalAlpha = flick;
                    ctx.drawImage(crackedTileImg, rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2);
                    ctx.globalAlpha = 1;
                }

                let figY = cy - rect.h * 0.08;
                let alpha = 1;
                if (st === 'falling') {
                    const p = clamp((elapsed - fallStart[i]) / FALL_DURATION_MS, 0, 1);
                    figY = figY + p * rect.h * 1.6;
                    alpha = 1 - p;
                }

                ctx.globalAlpha = alpha;
                const pImg = playerImages[playerColorIdx[i]];
                const pSize = emojiSize * 1.5;
                if (pImg && pImg.complete && pImg.naturalWidth > 0) {
                    ctx.drawImage(pImg, cx - pSize / 2, figY - pSize / 2, pSize, pSize);
                }

                if (st !== 'falling') {
                    ctx.font = `700 ${nameSize}px "Plus Jakarta Sans", sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillStyle = (elapsed >= durationMs && i === winnerIdx) ? '#FFC93C' : '#F6F3FF';
                    const label = players[i].username.length > nameMaxChars ? players[i].username.slice(0, nameMaxChars) + '…' : players[i].username;
                    const nameY = Math.min(figY + emojiSize * 0.72, rect.y + rect.h - 3);
                    ctx.fillText(label, cx, nameY);
                }
                ctx.globalAlpha = 1;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            }

            drawParticles();
        }

        let startTs = null;
        let lastTs = null;
        let aliveCount = n;
        let finished = false;

        function frame(ts) {
            if (startTs === null) { startTs = ts; lastTs = ts; }
            const dt = Math.min((ts - lastTs) / 1000, 0.05);
            lastTs = ts;
            const elapsed = ts - startTs;
            const t = elapsed / 1000;

            const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
            if (timeLeftEl) timeLeftEl.textContent = secondsLeft;

            for (let w = 0; w < waves.length; w++) {
                const wave = waves[w];
                if (!wave.triggeredCrack && elapsed >= wave.time - CRACK_LEAD_MS) {
                    wave.indices.forEach(idx => { if (status[idx] === 'alive') status[idx] = 'cracking'; });
                    wave.triggeredCrack = true;
                }
            }
            for (let w = 0; w < waves.length; w++) {
                const wave = waves[w];
                if (!wave.triggeredFall && elapsed >= wave.time) {
                    wave.indices.forEach(idx => {
                        if (status[idx] !== 'dead') {
                            status[idx] = 'falling';
                            fallStart[idx] = elapsed;
                            aliveCount--;
                            const rect = tileRect(idx);
                            spawnSplash(rect.x + rect.w / 2, rect.y + rect.h * 0.9);
                        }
                    });
                    wave.triggeredFall = true;
                }
            }
            for (let i = 0; i < n; i++) {
                if (status[i] === 'falling' && elapsed - fallStart[i] >= FALL_DURATION_MS) {
                    status[i] = 'dead';
                }
            }

            if (aliveCountEl) aliveCountEl.textContent = Math.max(1, aliveCount);

            updateParticles(dt);
            draw(t, elapsed);

            const allWavesDone = waves.every(w => w.triggeredFall);
            const noOneFalling = players.every((_, i) => status[i] !== 'falling');

            if (!finished && allWavesDone && noOneFalling && elapsed >= durationMs) {
                finished = true;
                setTimeout(() => onFinish(players[winnerIdx]), 500);
                return;
            }

            requestAnimationFrame(frame);
        }

        if (n === 1) {
            draw(0, 0);
            setTimeout(() => onFinish(players[0]), 400);
            return;
        }

        draw(0, 0);
        requestAnimationFrame(frame);
    };
})();