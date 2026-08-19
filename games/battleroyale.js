// ===================================================================
// ⚔️ Đấu Trường Sinh Tồn — mini-game "Vui nhộn" cho Giveaway Live Tool
// Tải riêng khi người dùng chọn mode này (không nằm trong bundle chính).
//
// Cơ chế: mỗi người là 1 chiến binh cầm vũ khí ngẫu nhiên, đứng lang thang
// trong đấu trường. Lịch trình "hạ gục" được tính trước và chia đều đúng
// theo số giây (durationSec) người dùng đặt — giống Sàn Nham Thạch — để
// đảm bảo công bằng (ai cũng có xác suất thắng như nhau) và luôn kết thúc
// đúng lúc hết giờ. Có bảng lịch sử giao tranh (kill-feed) bên dưới đấu trường.
//
// API: window.runBattleRoyale(users, containerEl, durationSec, onFinish)
// ===================================================================
(function () {
    const ASPECT_RATIO = 460 / 760;
    const MAX_PLAYERS = 100;
    const MAX_WAVES = 20;
    const TELEGRAPH_MS = 550;   // thời gian "lao tới" trước khi ra đòn
    const FALL_DURATION_MS = 550;
    const FEED_MAX_ITEMS = 40;


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
    function lerp(a, b, p) { return a + (b - a) * p; }
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // --- Assets mascot (vẽ bởi Claude Design) — preload 1 lần, dùng chung cho mọi ván đấu ---
    function svgToImage(svgString) {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        return img;
    }

    // Nhân vật top-down giống hệt Sàn Nham Thạch để đồng bộ art style giữa các mini-game.
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

    const WEAPON_SVGS = [
        { name: 'Gậy', svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(35 32 32)">
    <rect x="27" y="34" width="10" height="26" rx="5" fill="#8B5A2B" stroke="#150C22" stroke-width="2.5"/>
    <path d="M20 14 Q32 4 44 14 Q46 26 32 30 Q18 26 20 14 Z" fill="#A9713F" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="26" cy="18" rx="2.5" ry="4" fill="#7A4A22" opacity="0.5"/>
  </g>
</svg>` },
        { name: 'Cung', svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(35 32 32)">
    <path d="M24 6 Q40 32 24 58" fill="none" stroke="#150C22" stroke-width="7" stroke-linecap="round"/>
    <path d="M24 6 Q40 32 24 58" fill="none" stroke="#C9975E" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="24" y1="6" x2="24" y2="58" stroke="#EFE3C8" stroke-width="1.8"/>
    <line x1="10" y1="32" x2="46" y2="32" stroke="#150C22" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 32 L38 28 L38 36 Z" fill="#8B5A2B" stroke="#150C22" stroke-width="2" stroke-linejoin="round"/>
  </g>
</svg>` },
        { name: 'Nỏ', svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(35 32 32)">
    <line x1="10" y1="20" x2="54" y2="20" stroke="#150C22" stroke-width="7" stroke-linecap="round"/>
    <line x1="10" y1="20" x2="54" y2="20" stroke="#9AA1AD" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="14" y1="20" x2="50" y2="20" stroke="#D8DCE2" stroke-width="1.2"/>
    <rect x="29" y="18" width="6" height="40" rx="3" fill="#6B7280" stroke="#150C22" stroke-width="2.5"/>
    <rect x="27" y="50" width="10" height="10" rx="3" fill="#4B5563" stroke="#150C22" stroke-width="2"/>
  </g>
</svg>` },
        { name: 'Súng', svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(35 32 32)">
    <rect x="24" y="10" width="10" height="26" rx="4" fill="#5B6472" stroke="#150C22" stroke-width="2.5"/>
    <rect x="24" y="8" width="10" height="6" rx="2" fill="#FF8C14" stroke="#150C22" stroke-width="2"/>
    <rect x="20" y="34" width="18" height="10" rx="4" fill="#3F4652" stroke="#150C22" stroke-width="2.5"/>
    <path d="M22 44 Q20 56 26 60 Q30 58 28 44 Z" fill="#3F4652" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="30" cy="38" r="2" fill="#150C22"/>
  </g>
</svg>` },
        { name: 'Kiếm', svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(35 32 32)">
    <path d="M30 6 L34 6 L35 38 L29 38 Z" fill="#D9DEE6" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="32" y1="8" x2="32" y2="36" stroke="#9AA3B0" stroke-width="1.5"/>
    <rect x="22" y="38" width="20" height="5" rx="2" fill="#B8860B" stroke="#150C22" stroke-width="2.5"/>
    <rect x="29" y="43" width="6" height="14" rx="3" fill="#7A4A22" stroke="#150C22" stroke-width="2.5"/>
    <circle cx="32" cy="59" r="4" fill="#B8860B" stroke="#150C22" stroke-width="2"/>
  </g>
</svg>` },
        { name: 'Thương', svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(35 32 32)">
    <rect x="29" y="20" width="6" height="40" rx="3" fill="#8B5A2B" stroke="#150C22" stroke-width="2.5"/>
    <path d="M32 4 L40 22 L24 22 Z" fill="#9AA1AD" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 8 L36 22 L28 22 Z" fill="#D8DCE2" opacity="0.6"/>
  </g>
</svg>` }
    ];

    const HIT_BURST_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 4 L36 24 L56 20 L38 32 L56 44 L36 40 L32 60 L28 40 L8 44 L26 32 L8 20 L28 24 Z" fill="#FF8C14" stroke="#150C22" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M32 14 L34 28 L48 26 L36 34 L48 42 L34 38 L32 50 L30 38 L16 42 L28 34 L16 26 L30 28 Z" fill="#FFC93C"/>
  <circle cx="32" cy="32" r="5" fill="#FF5470" opacity="0.9"/>
</svg>`;

    // 10 màu áo nhân vật (giống Sàn Nham Thạch) + 6 vũ khí + 1 particle va chạm — preload sẵn
    const PLAYER_COLORS = ['#22D3EE', '#EC4899', '#8B5CF6', '#FFC93C', '#34D399', '#FB923C', '#60A5FA', '#F43F5E', '#A3E635', '#E879F9'];
    const playerImages = PLAYER_COLORS.map(c => svgToImage(playerSvgString(c)));
    const WEAPON_IMAGES = WEAPON_SVGS.map(w => svgToImage(w.svg));
    const WEAPON_DATA_URIS = WEAPON_SVGS.map(w => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(w.svg));
    const hitBurstImg = svgToImage(HIT_BURST_SVG);

    window.runBattleRoyale = function (users, containerEl, durationSec, onFinish) {
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
            <h3 style="margin:0 0 6px;font-family:'Baloo 2', sans-serif;font-size:16px;color:var(--pink);">⚔️ Đấu Trường Sinh Tồn — còn <span id="brTimeLeft">${duration}</span>s | Sống sót: <span id="brAliveCount">${n}</span></h3>
            ${sampled ? `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">Danh sách có ${users.length} người, đã chọn ngẫu nhiên ${MAX_PLAYERS} người để chơi.</div>` : ''}
            <canvas id="brCanvas" style="width:100%; display:block; border-radius:16px 16px 0 0; border:1px solid var(--border); border-bottom:none;"></canvas>
            <div id="brFeed" style="max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.32); border:1px solid var(--border); border-top:none; border-radius:0 0 16px 16px; padding:8px 10px; font-size:12px; line-height:1.7; color:var(--text-mid);"></div>
        `;

        const canvas = containerEl.querySelector('#brCanvas');
        const ctx = canvas.getContext('2d');
        const timeLeftEl = containerEl.querySelector('#brTimeLeft');
        const aliveCountEl = containerEl.querySelector('#brAliveCount');
        const feedEl = containerEl.querySelector('#brFeed');

        // --- Canvas theo đúng mật độ điểm ảnh màn hình để hết mờ/nhòe ---
        const dpr = window.devicePixelRatio || 1;
        const W = Math.max(320, containerEl.clientWidth || 760);
        const H = Math.round(W * ASPECT_RATIO);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const MARGIN = Math.round(Math.min(W, H) * 0.09);
        const figSize = clamp(Math.min(W, H) / Math.sqrt(Math.max(n, 1)) * 0.9, 14, 30);
        const nameSize = clamp(figSize * 0.5, 8, 13);

        const weaponOf = players.map(() => Math.floor(Math.random() * WEAPON_SVGS.length));
        const playerColorIdx = players.map(() => Math.floor(Math.random() * PLAYER_COLORS.length));

        // Vị trí neo cố định + lang thang nhẹ quanh đó (sine, không tích luỹ -> không lỗi trôi dạt)
        const anchorX = players.map(() => randRange(MARGIN, W - MARGIN));
        const anchorY = players.map(() => randRange(MARGIN, H - MARGIN));
        const wPhaseX = players.map(() => randRange(0, Math.PI * 2));
        const wPhaseY = players.map(() => randRange(0, Math.PI * 2));
        const wFreqX = players.map(() => randRange(0.3, 0.6));
        const wFreqY = players.map(() => randRange(0.3, 0.6));
        const wAmp = Math.min(W, H) * 0.05;

        function wanderPos(i, t) {
            return {
                x: anchorX[i] + Math.sin(t * wFreqX[i] + wPhaseX[i]) * wAmp,
                y: anchorY[i] + Math.cos(t * wFreqY[i] + wPhaseY[i]) * wAmp
            };
        }

        // --- Lịch trình hạ gục: giống Sàn Nham Thạch, chia đều đúng theo durationMs ---
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
            // Mô phỏng trước tập "còn sống" theo đúng lịch để chọn killer hợp lệ cho từng nạn nhân
            let aliveSim = players.map((_, i) => i);
            let cursor = 0;
            for (let w = 0; w < waveCount; w++) {
                const size = waveSizes[w];
                const victims = eliminationOrder.slice(cursor, cursor + size);
                cursor += size;
                const victimSet = new Set(victims);
                const pool = shuffle(aliveSim.filter(idx => !victimSet.has(idx)));
                const killers = victims.map((_, j) => pool.length > 0 ? pool[j % pool.length] : victims[(j + 1) % victims.length]);
                const time = durationMs * (w + 1) / waveCount;
                waves.push({ time, victims, killers, triggeredTelegraph: false, triggeredHit: false });
                aliveSim = aliveSim.filter(idx => !victimSet.has(idx));
            }
        }
        const winnerIdx = eliminationOrder[n - 1] !== undefined ? eliminationOrder[n - 1] : 0;

        // status: 'alive' | 'targeted' | 'falling' | 'dead'
        const status = players.map(() => 'alive');
        const fallStart = players.map(() => 0);
        const attackTarget = players.map(() => -1);   // idx đối thủ đang lao tới (nếu đang là killer)
        const attackStart = players.map(() => -1);
        const attackFromPos = players.map(() => null);

        // --- Hạt hiệu ứng va chạm ---
        let particles = [];
        function spawnHit(x, y) {
            for (let i = 0; i < 8; i++) {
                const ang = randRange(0, Math.PI * 2);
                const speed = randRange(50, 140);
                particles.push({
                    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
                    life: 0, maxLife: randRange(300, 520),
                    size: randRange(10, 18),
                    rot: randRange(0, Math.PI * 2),
                    spin: randRange(-5, 5)
                });
            }
        }
        function updateParticles(dt) {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.rot += p.spin * dt;
                p.life += dt * 1000;
                if (p.life >= p.maxLife) particles.splice(i, 1);
            }
        }
        function drawParticles() {
            if (!hitBurstImg || !hitBurstImg.complete || hitBurstImg.naturalWidth === 0) return;
            for (const p of particles) {
                const ratio = clamp(1 - p.life / p.maxLife, 0, 1);
                ctx.save();
                ctx.globalAlpha = ratio * 0.95;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.drawImage(hitBurstImg, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        }

        function addFeed(html) {
            const line = document.createElement('div');
            line.innerHTML = html;
            feedEl.appendChild(line);
            while (feedEl.children.length > FEED_MAX_ITEMS) feedEl.removeChild(feedEl.firstChild);
            feedEl.scrollTop = feedEl.scrollHeight;
        }

        function drawArenaBg(t) {
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(139,92,246,0.14)');
            grad.addColorStop(1, 'rgba(255,61,138,0.12)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        function currentPos(i, t, elapsed) {
            const base = wanderPos(i, t);
            if (attackTarget[i] >= 0) {
                const p = clamp((elapsed - attackStart[i]) / TELEGRAPH_MS, 0, 1);
                const targetNow = wanderPos(attackTarget[i], t);
                const from = attackFromPos[i] || base;
                return { x: lerp(from.x, targetNow.x, p), y: lerp(from.y, targetNow.y, p) };
            }
            return base;
        }

        function draw(t, elapsed) {
            ctx.clearRect(0, 0, W, H);
            drawArenaBg(t);

            const positions = new Array(n);
            for (let i = 0; i < n; i++) positions[i] = currentPos(i, t, elapsed);

            for (let i = 0; i < n; i++) {
                if (status[i] === 'dead') continue;
                const pos = positions[i];
                let alpha = 1;
                let scale = 1;
                if (status[i] === 'falling') {
                    const p = clamp((elapsed - fallStart[i]) / FALL_DURATION_MS, 0, 1);
                    alpha = 1 - p;
                    scale = 1 - p * 0.4;
                }

                ctx.globalAlpha = alpha;

                if (status[i] === 'targeted') {
                    const flick = 0.5 + 0.5 * Math.sin(t * 20 + i);
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, figSize * 0.85, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255,84,112,${0.4 + flick * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                if (i === winnerIdx && status[i] === 'alive' && elapsed >= durationMs) {
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, figSize * 0.9, 0, Math.PI * 2);
                    ctx.strokeStyle = '#FFC93C';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }

                const pImg = playerImages[playerColorIdx[i]];
                const pSize = figSize * 1.6 * scale;
                if (pImg && pImg.complete && pImg.naturalWidth > 0) {
                    ctx.drawImage(pImg, pos.x - pSize / 2, pos.y + figSize * 0.05 - pSize / 2, pSize, pSize);
                }
                const wImg = WEAPON_IMAGES[weaponOf[i]];
                const wSize = figSize * 0.95 * scale;
                if (wImg && wImg.complete && wImg.naturalWidth > 0) {
                    ctx.drawImage(wImg, pos.x + figSize * 0.55 - wSize / 2, pos.y + figSize * 0.15 - wSize / 2, wSize, wSize);
                }

                if (status[i] !== 'falling') {
                    ctx.font = `700 ${nameSize}px "Plus Jakarta Sans", sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = (elapsed >= durationMs && i === winnerIdx) ? '#FFC93C' : '#F6F3FF';
                    const label = players[i].username.length > 12 ? players[i].username.slice(0, 12) + '…' : players[i].username;
                    ctx.fillText(label, pos.x, pos.y - figSize * 0.72);
                }
                ctx.globalAlpha = 1;
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            drawParticles();
        }

        let startTs = null, lastTs = null, aliveCount = n, finished = false;

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
                if (!wave.triggeredHit && elapsed >= wave.time) {
                    wave.victims.forEach((victimIdx, j) => {
                        if (status[victimIdx] !== 'dead') {
                            status[victimIdx] = 'falling';
                            fallStart[victimIdx] = elapsed;
                            aliveCount--;
                            const pos = currentPos(victimIdx, t, elapsed);
                            spawnHit(pos.x, pos.y);
                            const killerIdx = wave.killers[j];
                            const killerName = esc(players[killerIdx] ? players[killerIdx].username : '???');
                            const victimName = esc(players[victimIdx].username);
                            const weaponIconHtml = (killerIdx != null && WEAPON_DATA_URIS[weaponOf[killerIdx]])
                                ? `<img src="${WEAPON_DATA_URIS[weaponOf[killerIdx]]}" width="16" height="16" style="vertical-align:-3px;">`
                                : '💥';
                            addFeed(`${weaponIconHtml} <b style="color:#F6F3FF;">${killerName}</b> hạ gục <b style="color:var(--danger);">${victimName}</b>`);
                        }
                        attackTarget[wave.killers[j]] = -1;
                    });
                    wave.triggeredHit = true;
                }
            }
            for (let w = 0; w < waves.length; w++) {
                const wave = waves[w];
                if (!wave.triggeredTelegraph && elapsed >= wave.time - TELEGRAPH_MS) {
                    wave.victims.forEach((victimIdx, j) => {
                        if (status[victimIdx] === 'alive') status[victimIdx] = 'targeted';
                        const killerIdx = wave.killers[j];
                        if (status[killerIdx] === 'alive' || status[killerIdx] === 'targeted') {
                            attackTarget[killerIdx] = victimIdx;
                            attackStart[killerIdx] = elapsed;
                            attackFromPos[killerIdx] = wanderPos(killerIdx, t);
                        }
                    });
                    wave.triggeredTelegraph = true;
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

            const allDone = waves.every(w => w.triggeredHit);
            const noneFalling = players.every((_, i) => status[i] !== 'falling');

            if (!finished && allDone && noneFalling && elapsed >= durationMs) {
                finished = true;
                addFeed(`🏆 <b style="color:#FFC93C;">${esc(players[winnerIdx].username)}</b> là chiến binh sống sót cuối cùng!`);
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