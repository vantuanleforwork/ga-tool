/**
 * SQUID GAME - RED LIGHT GREEN LIGHT MINI-GAME
 * Enhanced Logic: Dramatic Clustered Racing & Leader Fall Mechanics
 * Game nhúng cho Giveaway Live Tool
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
            this.grow = type === 'laser_ring' ? 140 : 0;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            if (this.type === 'dot') {
                this.vy += 120 * dt;
                this.vx *= 0.95;
                this.vy *= 0.95;
            }
            if (this.grow > 0) this.radius += this.grow * dt;
            this.life -= dt;
        }
        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            let alpha = Math.max(0, this.life / this.maxLife);

            if (this.type === 'laser_ring') {
                ctx.globalAlpha = alpha * 0.8;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function drawDoll(ctx, x, y, state, now) {
        ctx.save();
        ctx.translate(x, y);

        if (state === 'RED') {
            ctx.beginPath();
            ctx.arc(0, 0, 34 + Math.sin(now * 0.03) * 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 61, 138, 0.25)';
            ctx.fill();
        }

        ctx.fillStyle = '#1A1A24';
        ctx.beginPath();
        ctx.arc(-22, -10, 10, 0, Math.PI * 2);
        ctx.arc(22, -10, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF9100';
        ctx.fillRect(-16, 8, 32, 28);
        ctx.fillStyle = '#FFC93C';
        ctx.fillRect(-10, 8, 20, 28);

        ctx.beginPath();
        ctx.arc(0, -8, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD54F';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        ctx.stroke();

        if (state === 'GREEN') {
            ctx.fillStyle = '#1A1A24';
            ctx.beginPath();
            ctx.arc(0, -8, 19, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FF3D8A';
            ctx.fillRect(-8, -25, 16, 6);
        } else {
            ctx.fillStyle = '#1A1A24';
            ctx.beginPath();
            ctx.arc(-7, -10, 4, 0, Math.PI * 2);
            ctx.arc(7, -10, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FF5470';
            ctx.shadowColor = '#FF5470';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(-7, -10, 2, 0, Math.PI * 2);
            ctx.arc(7, -10, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255, 61, 138, 0.5)';
            ctx.beginPath();
            ctx.arc(-11, -4, 3.5, 0, Math.PI * 2);
            ctx.arc(11, -4, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(0, -1, 3, 0, Math.PI);
            ctx.strokeStyle = '#D81B60';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawPlayer(ctx, p, now) {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (p.isHit) {
            ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        }

        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        let legOffset = p.isMoving ? Math.sin(p.runCycle) * 8 : 0;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(-4 + legOffset, 18);
        ctx.moveTo(0, 8);
        ctx.lineTo(4 - legOffset, 18);
        ctx.stroke();

        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 8);
        ctx.stroke();

        let armOffset = p.isMoving ? Math.cos(p.runCycle) * 6 : 0;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(-7 + armOffset, 4);
        ctx.moveTo(0, -4);
        ctx.lineTo(7 - armOffset, 4);
        ctx.stroke();

        let headR = 8.5;
        ctx.beginPath();
        ctx.arc(0, -6 - headR, headR, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let face = p.isFinished ? '🏆' : (p.isHit ? '💀' : (p.isMoving ? '🏃' : '🥶'));
        ctx.fillText(face, 0, -6 - headR);

        ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = p.isFinished ? '#FFC93C' : '#F6F3FF';
        ctx.textAlign = 'center';
        let displayName = p.username.length > 9 ? p.username.substring(0, 7) + '..' : p.username;
        ctx.fillText(displayName, 0, 29);

        ctx.restore();
    }

    window.runSquidGame = function(users, containerEl, durationSec, onFinish) {
        if (!users || users.length === 0) return;

        let rawList = [...users];
        if (rawList.length > MAX_PLAYERS) {
            rawList = shuffle(rawList).slice(0, MAX_PLAYERS);
        }

        let winnerIdx = Math.floor(Math.random() * rawList.length);

        containerEl.innerHTML = `
            <div style="font-family:'Baloo 2',sans-serif; text-align:center; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; color:var(--text-mid); padding:0 8px;">
                    <span>🦑 Sống sót: <strong id="squidAlive" style="color:var(--cyan);font-weight:800;">${rawList.length}</strong>/${rawList.length}</span>
                    <span id="squidLightBadge" style="font-size:13px; font-weight:800; padding:3px 12px; border-radius:999px; background:rgba(0,230,118,0.2); color:#00E676; border:1px solid #00E676;">🟢 ĐÈN XANH</span>
                    <span>⏱️ <strong id="squidTimer" style="color:var(--yellow);font-weight:800;">${durationSec}s</strong></span>
                </div>
            </div>
            <div style="position:relative; width:100%; height:450px; overflow:hidden; border-radius:20px; background:linear-gradient(180deg, #180E29 0%, #090510 100%); border:1px solid rgba(34,242,200,0.25); box-shadow:0 12px 40px rgba(0,0,0,0.6);">
                <canvas id="squidCanvas" style="width:100%; height:100%; display:block;"></canvas>
            </div>
        `;

        const canvas = containerEl.querySelector('#squidCanvas');
        const ctx = canvas.getContext('2d');
        const aliveEl = containerEl.querySelector('#squidAlive');
        const timerEl = containerEl.querySelector('#squidTimer');
        const lightBadge = containerEl.querySelector('#squidLightBadge');

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const W = rect.width || 560;
        const H = rect.height || 450;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const startY = H - 55;
        const finishY = 75;
        const dollX = W / 2;
        const dollY = 40;

        let totalDurationMs = durationSec * 1000;
        let distanceToFinish = startY - finishY;

        // Tốc độ nền tiêu chuẩn đảm bảo vừa đủ cán đích ở những giây cuối
        let baseStandardSpeed = distanceToFinish / (durationSec * 0.75);

        let players = rawList.map((u, i) => {
            let col = i % 10;
            let row = Math.floor(i / 10);
            let spacingX = (W - 60) / 10;

            return {
                id: i,
                username: u.username,
                color: COLORS[i % COLORS.length],
                x: 30 + col * spacingX + (Math.random() - 0.5) * 12,
                y: startY + row * 12,
                speedOffset: (Math.random() - 0.5) * 12, // Dao động nhẹ để các xe giữ khoảng cách sát nhau
                wobblePhase: Math.random() * Math.PI * 2,
                isAlive: true,
                isHit: false,
                isFinished: false,
                isMoving: false,
                runCycle: Math.random() * Math.PI,
                opacity: 1
            };
        });

        let particles = [];
        let lightState = 'GREEN';
        let totalRedPhases = 3;
        let phaseInterval = totalDurationMs / (totalRedPhases + 0.6);
        let nextLightSwitchTime = phaseInterval * 0.7;

        let lastTime = performance.now();
        let startTime = lastTime;
        let isEnded = false;
        let currentPhaseShootingDone = false;
        let isFinalPurgeDone = false;

        function triggerLaserHit(p) {
            if (!p.isAlive) return;
            p.isAlive = false;
            p.isHit = true;
            p.isMoving = false;

            particles.push(new Particle(p.x, p.y - 12, '#FF5470', 0, 0, 4, 0.4, 'laser_ring'));

            for (let i = 0; i < 32; i++) {
                let ang = Math.random() * Math.PI * 2;
                let spd = 120 + Math.random() * 220;
                particles.push(new Particle(
                    p.x, p.y - 12, '#FF5470',
                    Math.cos(ang) * spd, Math.sin(ang) * spd,
                    Math.random() * 3.5 + 1.5, 0.5 + Math.random() * 0.3, 'dot'
                ));
            }
        }

        function frame(now) {
            let dt = (now - lastTime) / 1000;
            if (dt > 0.1) dt = 0.1;
            lastTime = now;
            let elapsed = now - startTime;
            let remainingMs = Math.max(0, totalDurationMs - elapsed);
            let progress = elapsed / totalDurationMs;

            timerEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;

            // 1. Quản lý trạng thái Đèn Xanh <-> Đèn Đỏ
            if (!isEnded && elapsed >= nextLightSwitchTime) {
                if (lightState === 'GREEN') {
                    lightState = 'RED';
                    currentPhaseShootingDone = false;
                    lightBadge.style.background = 'rgba(255,84,112,0.2)';
                    lightBadge.style.color = '#FF5470';
                    lightBadge.style.borderColor = '#FF5470';
                    lightBadge.textContent = '🔴 ĐÈN ĐỎ - ĐỨNG YÊN!';

                    nextLightSwitchTime = elapsed + 2200; // Đèn đỏ kéo dài 2.2 giây
                } else {
                    lightState = 'GREEN';
                    lightBadge.style.background = 'rgba(0,230,118,0.2)';
                    lightBadge.style.color = '#00E676';
                    lightBadge.style.borderColor = '#00E676';
                    lightBadge.textContent = '🟢 ĐÈN XANH - CHẠY!';

                    nextLightSwitchTime = elapsed + phaseInterval;
                }
            }

            // 2. Di chuyển tự nhiên & Cân bằng vị trí
            players.forEach(p => {
                if (!p.isAlive || p.isFinished) return;

                if (lightState === 'GREEN') {
                    p.isMoving = true;
                    
                    // Tính toán tốc độ nhịp nhàng:
                    // Mọi người chạy sát nhau (Clustered) bằng nhịp Sin ngẫu nhiên
                    let dynamicSpeed = baseStandardSpeed + p.speedOffset + Math.sin(now * 0.003 + p.wobblePhase) * 15;
                    
                    // Ở 25% chặng cuối, Winner bắt đầu nhỉnh hơn một chút để tiến vào vị trí số 1
                    if (progress > 0.75 && p.id === winnerIdx) {
                        dynamicSpeed += 22;
                    }

                    p.y -= dynamicSpeed * dt;
                    p.runCycle += dt * 13;

                    // Chỉ Winner mới được phép thực sự chạm vạch vàng
                    if (p.id === winnerIdx && p.y <= finishY) {
                        p.y = finishY;
                        p.isFinished = true;
                        p.isMoving = false;
                    } else if (p.id !== winnerIdx && p.y < finishY + 18) {
                        // Khóa các người chơi khác không cho chạm vạch vàng trước Winner
                        p.y = finishY + 18;
                    }
                } else {
                    p.isMoving = false;
                }
            });

            // 3. LOGIC HẠ GỤC ĐÈN ĐỎ: Bắn ngẫu nhiên 25-30% người chơi ĐANG DẪN ĐẦU TỐP!
            if (lightState === 'RED' && !currentPhaseShootingDone) {
                // Lọc những người còn sống và KHÔNG PHẢI winner
                let aliveNonWinners = players.filter(p => p.isAlive && p.id !== winnerIdx);
                
                // Sắp xếp theo vị trí Y (ai Y nhỏ hơn là người đứng càng cao / dẫn đầu)
                aliveNonWinners.sort((a, b) => a.y - b.y);

                // Lấy ra nhóm 50% người đứng cao nhất (Tốp dẫn đầu)
                let topLeaders = aliveNonWinners.slice(0, Math.ceil(aliveNonWinners.length * 0.5));
                topLeaders = shuffle(topLeaders);

                // Bắn gục khoảng 1/3 tốp dẫn đầu trong đợt này
                let killCount = Math.max(1, Math.floor(topLeaders.length * 0.6));
                for (let k = 0; k < killCount; k++) {
                    if (topLeaders[k]) {
                        triggerLaserHit(topLeaders[k]);
                    }
                }

                currentPhaseShootingDone = true;
            }

            // 4. BẮN SẠCH TẤT CẢ CÁC ĐỐI THỦ CÒN LẠI KHI WINNER CHẠM VẠCH ĐÍCH
            if (!isFinalPurgeDone && (elapsed >= totalDurationMs - 1000 || players[winnerIdx].isFinished)) {
                players.forEach(p => {
                    if (p.id !== winnerIdx && p.isAlive) {
                        triggerLaserHit(p);
                    }
                });
                isFinalPurgeDone = true;
            }

            aliveEl.textContent = players.filter(p => p.isAlive).length;

            particles.forEach(pt => pt.update(dt));
            particles = particles.filter(pt => pt.life > 0);

            // --- RENDER CANVAS ---
            ctx.clearRect(0, 0, W, H);

            ctx.save();
            ctx.fillStyle = 'rgba(255, 201, 60, 0.15)';
            ctx.fillRect(0, finishY - 10, W, 20);
            ctx.strokeStyle = '#FFC93C';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.moveTo(0, finishY);
            ctx.lineTo(W, finishY);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(0, startY + 15);
            ctx.lineTo(W, startY + 15);
            ctx.stroke();
            ctx.restore();

            drawDoll(ctx, dollX, dollY, lightState, now);

            if (lightState === 'RED') {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 84, 112, 0.22)';
                ctx.lineWidth = 1.5;
                for (let a = -0.7; a <= 0.7; a += 0.12) {
                    ctx.beginPath();
                    ctx.moveTo(dollX, dollY);
                    ctx.lineTo(dollX + Math.sin(a) * W, H);
                    ctx.stroke();
                }
                ctx.restore();
            }

            let sortedPlayers = [...players].sort((a, b) => a.y - b.y);
            sortedPlayers.forEach(p => {
                if (!p.isAlive) {
                    p.opacity = Math.max(0, p.opacity - dt * 2.2);
                    if (p.opacity <= 0) return;
                }
                ctx.save();
                ctx.globalAlpha = p.opacity;
                drawPlayer(ctx, p, now);
                ctx.restore();
            });

            particles.forEach(pt => pt.draw(ctx));

            // ĐIỀU KIỆN KẾT THÚC
            let winnerPlayer = players[winnerIdx];
            if (elapsed < totalDurationMs && !winnerPlayer.isFinished && !isEnded) {
                requestAnimationFrame(frame);
            } else {
                if (!isEnded) {
                    isEnded = true;
                    players.forEach(p => {
                        if (p.id !== winnerIdx && p.isAlive) {
                            triggerLaserHit(p);
                        }
                    });

                    setTimeout(() => {
                        let winner = rawList[winnerIdx];
                        if (onFinish) onFinish(winner);
                    }, 1200);
                }
            }
        }

        requestAnimationFrame(frame);
    };
})();