/**
 * PASS BOMB MINI-GAME (Truyền Bom Nổ Chậm - 2 Giai Đoạn Kịch Tính)
 * - Đoạn đầu: Loại nhanh về top 3-4 người.
 * - 5 giây cuối: Chậm lại, chuyền qua lại kịch tính hồi hộp.
 */
(function() {
    'use strict';

    const MAX_PLAYERS = 100;
    const COLORS = [
        '#FF3D8A', '#22F2C8', '#8B5CF6', '#FFC93C', '#FF5470',
        '#4285F4', '#00E676', '#FF9100', '#E040FB', '#00E5FF'
    ];

    function shuffle(arr) {
        let a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    class Particle {
        constructor(x, y, color, vx, vy, radius, life, type = 'dot') {
            this.x = x;
            this.y = y;
            this.color = color;
            this.vx = vx;
            this.vy = vy;
            this.radius = radius;
            this.life = life;
            this.maxLife = life;
            this.type = type;
            this.grow = type === 'shockwave' ? 240 : (type === 'smoke' ? 20 : 0);
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            if (this.type === 'dot' || this.type === 'smoke') {
                this.vy += 90 * dt;
                this.vx *= 0.96;
                this.vy *= 0.96;
            }
            if (this.grow > 0) {
                this.radius += this.grow * dt;
            }
            this.life -= dt;
        }
        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            let alpha = Math.max(0, this.life / this.maxLife);

            if (this.type === 'shockwave') {
                ctx.globalAlpha = alpha * 0.85;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.type === 'smoke') {
                ctx.globalAlpha = alpha * 0.35;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function drawCharacter(ctx, p, now) {
        let headRadius = p.isHolder ? 13 : 10;
        let bodyLength = 16;
        let color = p.color;

        ctx.save();
        ctx.translate(p.x, p.y);

        if (p.isHolder) {
            ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
            ctx.beginPath();
            ctx.arc(0, -6, 28 + Math.sin(now * 0.03) * 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 61, 138, 0.3)';
            ctx.fill();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, bodyLength);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, bodyLength);
        ctx.lineTo(-6, bodyLength + 10);
        ctx.moveTo(0, bodyLength);
        ctx.lineTo(6, bodyLength + 10);
        ctx.stroke();

        let armY = 4;
        ctx.beginPath();
        if (p.armPose === 'toss') {
            ctx.moveTo(0, armY);
            ctx.lineTo(-12, armY - 12);
            ctx.moveTo(0, armY);
            ctx.lineTo(12, armY - 12);
        } else if (p.isHolder) {
            let wave = Math.sin(now * 0.035) * 5;
            ctx.moveTo(0, armY);
            ctx.lineTo(-10, armY - 8 + wave);
            ctx.moveTo(0, armY);
            ctx.lineTo(10, armY - 8 - wave);
        } else {
            ctx.moveTo(0, armY);
            ctx.lineTo(-8, armY + 8);
            ctx.moveTo(0, armY);
            ctx.lineTo(8, armY + 8);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -headRadius, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = p.isHolder ? '#FF3D8A' : color;
        ctx.shadowBlur = p.isHolder ? 18 : 6;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = p.isHolder ? '12px sans-serif' : '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.isHolder ? '😱' : '🙂', 0, -headRadius);

        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = p.isHolder ? '#FF5470' : '#F6F3FF';
        ctx.textAlign = 'center';
        ctx.fillText(p.displayName, 0, bodyLength + 22);

        ctx.restore();
    }

    window.runPassBomb = function(users, containerEl, durationSec, onFinish) {
        if (!users || users.length === 0) return;

        let rawList = [...users];
        if (rawList.length > MAX_PLAYERS) {
            rawList = shuffle(rawList).slice(0, MAX_PLAYERS);
        }

        let totalDurationMs = durationSec * 1000;
        let totalCount = rawList.length;

        // Xác định số lượng người vào vòng chung kết (3-4 người, hoặc 2 người nếu ban đầu ít)
        let finalSurvivorsCount = Math.min(totalCount, Math.max(2, Math.min(4, Math.floor(totalCount / 2))));
        if (totalCount <= 3) finalSurvivorsCount = totalCount;

        // Phân bổ thời gian: 5 giây cuối cho vòng chung kết
        let finalPhaseDurationMs = Math.min(totalDurationMs * 0.45, 5000);
        let earlyPhaseDurationMs = Math.max(500, totalDurationMs - finalPhaseDurationMs);

        // Thứ tự loại trừ
        let eliminationOrder = shuffle(rawList.map((_, i) => i));
        let winnerIdx = eliminationOrder[eliminationOrder.length - 1];

        // Lập lịch nổ chính xác 2 giai đoạn:
        let eliminationSchedule = [];
        let earlyElimCount = totalCount - finalSurvivorsCount;
        let finalElimCount = finalSurvivorsCount - 1;

        // 1. Lập lịch cho đợt loại sớm (Early Phase)
        for (let i = 0; i < earlyElimCount; i++) {
            let f = (i + 1) / (earlyElimCount + 1);
            let time = f * earlyPhaseDurationMs;
            eliminationSchedule.push({
                victimIdx: eliminationOrder[i],
                time: time
            });
        }

        // 2. Lập lịch cho đợt chung kết 3-4 người cuối (Final Phase - chậm & kịch tính)
        for (let i = 0; i < finalElimCount; i++) {
            let f = (i + 1) / (finalElimCount + 1);
            let time = earlyPhaseDurationMs + (f * (finalPhaseDurationMs - 600));
            eliminationSchedule.push({
                victimIdx: eliminationOrder[earlyElimCount + i],
                time: time
            });
        }

        containerEl.innerHTML = `
            <div style="font-family:'Baloo 2',sans-serif; text-align:center; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; color:var(--text-mid); padding:0 8px;">
                    <span>💣 Sống sót: <strong id="bombAlive" style="color:var(--cyan);font-weight:800;">${rawList.length}</strong>/${rawList.length}</span>
                    <span>⏱️ <strong id="bombTimer" style="color:var(--yellow);font-weight:800;">${durationSec}s</strong></span>
                </div>
            </div>
            <div style="position:relative; width:100%; height:370px; overflow:hidden; border-radius:20px; background:radial-gradient(circle at center, #261642 0%, #0D0716 100%); border:1px solid rgba(255,61,138,0.25); box-shadow:0 12px 40px rgba(0,0,0,0.6);">
                <canvas id="bombCanvas" style="width:100%; height:100%; display:block;"></canvas>
            </div>
            <!-- BẢNG KILL-FEED MỞ RỘNG GỌN GÀNG -->
            <div id="bombKillFeed" style="margin-top:12px; height:120px; overflow-y:auto; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 14px; font-size:12.5px; font-family:'Plus Jakarta Sans',sans-serif; display:flex; flex-direction:column; gap:6px; box-shadow:inset 0 2px 10px rgba(0,0,0,0.5);">
                <div style="color:var(--text-dim); text-align:center; font-size:11.5px;">🔥 Trận đấu bắt đầu! Kíp nổ đang cháy xèo xèo...</div>
            </div>
        `;

        const canvas = containerEl.querySelector('#bombCanvas');
        const ctx = canvas.getContext('2d');
        const aliveEl = containerEl.querySelector('#bombAlive');
        const timerEl = containerEl.querySelector('#bombTimer');
        const killFeedEl = containerEl.querySelector('#bombKillFeed');

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const W = rect.width || 560;
        const H = rect.height || 370;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const centerX = W / 2;
        const centerY = H / 2;
        const radius = Math.min(W, H) * 0.36;

        let players = rawList.map((u, i) => {
            let angle = (i / rawList.length) * Math.PI * 2 - Math.PI / 2;
            let name = u.username || u.name || `Player ${i + 1}`;
            return {
                id: i,
                raw: u,
                displayName: name,
                color: COLORS[i % COLORS.length],
                angle: angle,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                isAlive: true,
                isHolder: false,
                opacity: 1,
                armPose: 'normal'
            };
        });

        function logKill(killer, victim, remaining) {
            if (!killFeedEl) return;
            const item = document.createElement('div');
            item.style.lineHeight = '1.4';
            item.innerHTML = `💣 <strong style="color:${killer.color};">${escHtml(killer.displayName)}</strong> đã chuyền bom hạ <strong style="color:${victim.color};">${escHtml(victim.displayName)}</strong> <span style="color:var(--danger);font-size:11px;">[Còn ${remaining}]</span>`;
            killFeedEl.appendChild(item);
            killFeedEl.scrollTop = killFeedEl.scrollHeight;
        }

        let particles = [];
        let currentElimStep = 0;
        let totalElims = eliminationSchedule.length;

        let currentHolderIdx = eliminationSchedule.length > 0 ? eliminationSchedule[0].victimIdx : winnerIdx;
        let lastPasserIdx = currentHolderIdx;
        players[currentHolderIdx].isHolder = true;

        let bombPos = { x: players[currentHolderIdx].x, y: players[currentHolderIdx].y - 12 };
        let bombStartPos = { ...bombPos };
        let bombTargetPos = { ...bombPos };
        let bombArcProgress = 1;
        let bombArcHeight = 0;
        let bombRotation = 0;

        let lastTime = performance.now();
        let startTime = lastTime;
        let isEnded = false;
        let lastTossTime = 0;

        function spawnSpark(x, y, isFinal) {
            let count = isFinal ? 5 : 2;
            for (let i = 0; i < count; i++) {
                let angle = Math.random() * Math.PI * 2;
                let spd = (isFinal ? 90 : 60) + Math.random() * 90;
                particles.push(new Particle(
                    x, y, '#FFC93C',
                    Math.cos(angle) * spd, Math.sin(angle) * spd,
                    Math.random() * 2.5 + 1, 0.3, 'spark'
                ));
            }
        }

        function spawnExplosion(x, y) {
            particles.push(new Particle(x, y, '#FF3D8A', 0, 0, 5, 0.45, 'shockwave'));
            particles.push(new Particle(x, y, '#FFC93C', 0, 0, 2, 0.35, 'shockwave'));

            for (let i = 0; i < 14; i++) {
                let ang = Math.random() * Math.PI * 2;
                let spd = 20 + Math.random() * 45;
                particles.push(new Particle(
                    x, y, '#3A1C54',
                    Math.cos(ang) * spd, Math.sin(ang) * spd,
                    8 + Math.random() * 8, 0.6 + Math.random() * 0.3, 'smoke'
                ));
            }

            const expColors = ['#FF5470', '#FF3D8A', '#FFC93C', '#FFFFFF', '#FF9100', '#22F2C8'];
            for (let i = 0; i < 60; i++) {
                let col = expColors[Math.floor(Math.random() * expColors.length)];
                let ang = Math.random() * Math.PI * 2;
                let spd = 130 + Math.random() * 280;
                particles.push(new Particle(
                    x, y, col,
                    Math.cos(ang) * spd, Math.sin(ang) * spd,
                    Math.random() * 3.5 + 2, 0.6 + Math.random() * 0.4, 'dot'
                ));
            }
        }

        function updatePositions() {
            let alivePlayers = players.filter(p => p.isAlive);
            let count = alivePlayers.length;
            alivePlayers.forEach((p, index) => {
                let targetAngle = (index / count) * Math.PI * 2 - Math.PI / 2;
                p.angle += (targetAngle - p.angle) * 0.12;
                p.x = centerX + Math.cos(p.angle) * radius;
                p.y = centerY + Math.sin(p.angle) * radius;
            });
        }

        function passBombTo(nextIdx, isFinalPhase) {
            let tosser = players[currentHolderIdx];
            tosser.isHolder = false;
            tosser.armPose = 'toss';
            setTimeout(() => { tosser.armPose = 'normal'; }, isFinalPhase ? 700 : 350);

            lastPasserIdx = currentHolderIdx;
            currentHolderIdx = nextIdx;
            let receiver = players[nextIdx];
            receiver.isHolder = true;

            bombStartPos = { x: bombPos.x, y: bombPos.y };
            bombTargetPos = { x: receiver.x, y: receiver.y - 12 };

            let dist = Math.hypot(bombTargetPos.x - bombStartPos.x, bombTargetPos.y - bombStartPos.y);
            // Ở vòng chung kết, vòng cung bay cao hơn để tạo cảm giác chậm rãi
            bombArcHeight = isFinalPhase ? Math.min(160, dist * 0.65) : Math.min(110, dist * 0.4);
            bombArcProgress = 0;
        }

        function frame(now) {
            let dt = (now - lastTime) / 1000;
            if (dt > 0.1) dt = 0.1;
            lastTime = now;
            let elapsed = now - startTime;
            let remainingMs = Math.max(0, totalDurationMs - elapsed);

            timerEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;

            let isFinalPhase = elapsed >= earlyPhaseDurationMs;
            let currentSched = eliminationSchedule[currentElimStep];

            // 1. Logic chuyền bom qua lại giữa những người còn sống
            if (!isEnded && currentSched) {
                let timeToNextExplosion = currentSched.time - elapsed;

                // Khoảng cách nhịp chuyền: Vòng chung kết 5s cuối thì chuyền chậm rãi (1200ms - 1800ms)
                let tossCooldown = isFinalPhase ? (1200 + Math.random() * 600) : (450 + Math.random() * 300);

                if (timeToNextExplosion > 800) {
                    if (now - lastTossTime > tossCooldown && bombArcProgress >= 1) {
                        let candidates = players.filter(p => p.isAlive && p.id !== currentHolderIdx);
                        if (candidates.length > 0) {
                            let randomNext = candidates[Math.floor(Math.random() * candidates.length)].id;
                            passBombTo(randomNext, isFinalPhase);
                            lastTossTime = now;
                        }
                    }
                } else if (timeToNextExplosion <= 800 && timeToNextExplosion > 0) {
                    // Trước khi nổ 0.8s: Ép chuyền chính xác về tay nạn nhân theo lịch
                    if (currentHolderIdx !== currentSched.victimIdx && bombArcProgress >= 1) {
                        passBombTo(currentSched.victimIdx, isFinalPhase);
                    }
                }
            }

            // 2. Logic nổ bom
            if (!isEnded && currentSched && elapsed >= currentSched.time) {
                let victim = players[currentSched.victimIdx];
                let killer = players[lastPasserIdx] && lastPasserIdx !== currentSched.victimIdx 
                    ? players[lastPasserIdx] 
                    : players.find(p => p.isAlive && p.id !== currentSched.victimIdx) || victim;

                victim.isAlive = false;
                victim.isHolder = false;

                spawnExplosion(victim.x, victim.y - 10);

                currentElimStep++;
                let aliveCount = totalCount - currentElimStep;
                aliveEl.textContent = aliveCount;

                logKill(killer, victim, aliveCount);

                if (currentElimStep < totalElims) {
                    let nextSched = eliminationSchedule[currentElimStep];
                    let aliveList = players.filter(p => p.isAlive);
                    let nextHolder = aliveList[Math.floor(Math.random() * aliveList.length)].id;

                    currentHolderIdx = nextHolder;
                    lastPasserIdx = nextHolder;
                    players[nextHolder].isHolder = true;

                    bombPos = { x: victim.x, y: victim.y - 10 };
                    bombStartPos = { ...bombPos };
                    bombTargetPos = { x: players[nextHolder].x, y: players[nextHolder].y - 12 };
                    bombArcProgress = 0;
                    bombArcHeight = isFinalPhase ? 90 : 50;

                    lastTossTime = now;
                } else {
                    // Chỉ còn đúng 1 người chiến thắng
                    currentHolderIdx = winnerIdx;
                    players[winnerIdx].isHolder = false;
                    isEnded = true;
                    if (killFeedEl) {
                        const winItem = document.createElement('div');
                        winItem.style.color = '#FFC93C';
                        winItem.style.fontWeight = 'bold';
                        winItem.innerHTML = `👑 <strong>${escHtml(players[winnerIdx].displayName)}</strong> là người sống sót duy nhất thoát khỏi quả bom! 🎉`;
                        killFeedEl.appendChild(winItem);
                        killFeedEl.scrollTop = killFeedEl.scrollHeight;
                    }
                }
                updatePositions();
            }

            // 3. Tốc độ bay của quả bom (Vòng chung kết bay chậm & mượt hơn)
            if (bombArcProgress < 1) {
                let flightSpeed = isFinalPhase ? 2.4 : 4.8;
                bombArcProgress += dt * flightSpeed;
                if (bombArcProgress > 1) bombArcProgress = 1;

                let p = bombArcProgress;
                let currX = bombStartPos.x + (bombTargetPos.x - bombStartPos.x) * p;
                let currY = bombStartPos.y + (bombTargetPos.y - bombStartPos.y) * p;
                let arcOffset = -4 * bombArcHeight * p * (p - 1);

                bombPos.x = currX;
                bombPos.y = currY - arcOffset;
                bombRotation += dt * (isFinalPhase ? 10 : 18);
            } else {
                let targetP = players[currentHolderIdx];
                bombPos.x += (targetP.x - bombPos.x) * 0.3;
                bombPos.y += ((targetP.y - 12) - bombPos.y) * 0.3;
                bombRotation += dt * 4;
            }

            let fuseX = bombPos.x + Math.cos(bombRotation - Math.PI / 4) * 16;
            let fuseY = bombPos.y + Math.sin(bombRotation - Math.PI / 4) * 16;
            spawnSpark(fuseX, fuseY, isFinalPhase);

            particles.forEach(p => p.update(dt));
            particles = particles.filter(p => p.life > 0);

            // --- RENDER ---
            ctx.clearRect(0, 0, W, H);

            // Vòng đài Neon
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = isFinalPhase ? 'rgba(255, 61, 138, 0.4)' : 'rgba(139, 92, 246, 0.22)';
            ctx.lineWidth = 5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(34, 242, 200, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 10]);
            ctx.stroke();
            ctx.restore();

            // Nhân vật
            players.forEach(p => {
                if (!p.isAlive) {
                    p.opacity = Math.max(0, p.opacity - dt * 2.5);
                    if (p.opacity <= 0) return;
                }
                drawCharacter(ctx, p, now);
            });

            // Hiệu ứng nổ / tia lửa
            particles.forEach(p => p.draw(ctx));

            // Quả Bom 3D
            if (!isEnded || currentElimStep < totalElims) {
                ctx.save();
                let bx = bombPos.x;
                let by = bombPos.y;
                let pulse = Math.sin(now * (isFinalPhase ? 0.04 : 0.02)) * (isFinalPhase ? 4 : 2.5);

                ctx.translate(bx, by);
                ctx.rotate(bombRotation);

                ctx.beginPath();
                ctx.ellipse(0, 16, 13, 4.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(0, 0, 15 + pulse, 0, Math.PI * 2);
                let grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 17);
                grad.addColorStop(0, '#666677');
                grad.addColorStop(0.5, '#1A1A24');
                grad.addColorStop(1, '#09090D');
                ctx.fillStyle = grad;
                ctx.shadowColor = '#FF3D8A';
                ctx.shadowBlur = isFinalPhase ? 24 : 16;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#FF5470';
                ctx.stroke();

                ctx.fillStyle = '#AAAABB';
                ctx.fillRect(-4, -19, 8, 5);

                ctx.beginPath();
                ctx.moveTo(0, -19);
                ctx.quadraticCurveTo(12, -27, 10, -21);
                ctx.strokeStyle = '#FFC93C';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                ctx.font = '13px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('💀', 0, 1);

                ctx.restore();
            }

            if (elapsed < totalDurationMs && !isEnded) {
                requestAnimationFrame(frame);
            } else if (!isEnded) {
                isEnded = true;
                let winner = rawList[winnerIdx];
                if (onFinish) onFinish(winner);
            }
        }

        requestAnimationFrame(frame);
    };
})();