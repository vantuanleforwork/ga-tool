/**
 * THREE KINGDOMS CLASH - ĐẠI CHIẾN TAM QUỐC (FIXED HITBOX & PROJECTILE/DASH ATTACKS)
 * Game nhúng cho Giveaway Live Tool
 */
(function() {
    'use strict';

    const MAX_PLAYERS = 100;
    const NEON_COLORS = ['#22D3EE', '#EC4899', '#8B5CF6', '#FFC93C', '#22F2C8', '#FF5470'];

    const WEAPON_TYPES = [
        { id: 'blade', name: 'Thanh Long Đao', range: 'melee', glow: '#22F2C8' },
        { id: 'serpent_spear', name: 'Bát Xà Mâu', range: 'melee', glow: '#FF3D8A' },
        { id: 'halberd', name: 'Họa Kích', range: 'melee', glow: '#FFC93C' },
        { id: 'fan', name: 'Vũ Phiến', range: 'ranged', glow: '#8B5CF6' },
        { id: 'bow', name: 'Thần Cung', range: 'ranged', glow: '#22D3EE' },
        { id: 'sword', name: 'Thần Kiếm', range: 'melee', glow: '#FF5470' }
    ];

    const MOUNT_TYPES = [
        { id: 'red_hare', name: 'Xích Thố', color: '#EF4444', maneColor: '#FFC93C' },
        { id: 'dilu', name: 'Đích Lô', color: '#F3F4F6', maneColor: '#22D3EE' },
        { id: 'shadowless', name: 'Tuyệt Ảnh', color: '#1F2937', maneColor: '#8B5CF6' },
        { id: 'white_lion', name: 'Bạch Long Mã', color: '#E0E7FF', maneColor: '#FFFFFF' },
        { id: 'lightning', name: 'Phi Điện', color: '#F59E0B', maneColor: '#EC4899' }
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

    // Đạn bắn xa (Mũi tên / Lôi Tiễn / Lốc xoáy của Vũ Phiến & Thần Cung)
    class ArrowProjectile {
        constructor(sx, sy, tx, ty, color, type = 'arrow') {
            this.x = sx;
            this.y = sy;
            this.tx = tx;
            this.ty = ty;
            this.color = color;
            this.type = type;
            this.progress = 0;
            this.isDone = false;
            this.angle = Math.atan2(ty - sy, tx - sx);
        }
        update(dt) {
            this.progress += dt * 3.2;
            if (this.progress >= 1) {
                this.progress = 1;
                this.isDone = true;
            }
            this.currX = this.x + (this.tx - this.x) * this.progress;
            this.currY = this.y + (this.ty - this.y) * this.progress;
        }
        draw(ctx) {
            if (this.isDone) return;
            ctx.save();
            ctx.translate(this.currX, this.currY);
            ctx.rotate(this.angle);

            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 14;

            // Vẽ mũi tên năng lượng bay
            ctx.beginPath();
            ctx.moveTo(-16, 0);
            ctx.lineTo(12, 0);
            ctx.stroke();

            // Mũi nhọn
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(4, -5);
            ctx.lineTo(4, 5);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    class CrescentSlash {
        constructor(x, y, color, angle, radius = 50, arc = Math.PI * 0.8) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.angle = angle;
            this.radius = radius;
            this.arc = arc;
            this.life = 0.35;
            this.maxLife = 0.35;
        }
        update(dt) {
            this.life -= dt;
            this.radius += 45 * dt;
        }
        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            let alpha = Math.max(0, this.life / this.maxLife);
            ctx.globalAlpha = alpha;

            ctx.beginPath();
            ctx.arc(0, 0, this.radius, -this.arc / 2, this.arc / 2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 5.5;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 16;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, this.radius, -this.arc / 2.5, this.arc / 2.5);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }
    }

    class ShockwaveRing {
        constructor(x, y, color, maxRadius = 80) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.radius = 10;
            this.maxRadius = maxRadius;
            this.life = 0.4;
            this.maxLife = 0.4;
        }
        update(dt) {
            this.life -= dt;
            this.radius += (this.maxRadius - 10) * (dt / this.maxLife);
        }
        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            let alpha = Math.max(0, this.life / this.maxLife);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.restore();
        }
    }

    class EnergyOrb {
        constructor(x, y, tx, ty, color) {
            this.x = x;
            this.y = y;
            this.tx = tx;
            this.ty = ty;
            this.color = color;
            this.progress = 0;
            this.isDone = false;
        }
        update(dt) {
            this.progress += dt * 2.2;
            if (this.progress >= 1) {
                this.progress = 1;
                this.isDone = true;
            }
            this.currX = this.x + (this.tx - this.x) * this.progress;
            this.currY = this.y + (this.ty - this.y) * this.progress;
        }
        draw(ctx) {
            if (this.isDone) return;
            ctx.save();
            ctx.translate(this.currX, this.currY);

            let grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.4, this.color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for(let i=0; i<4; i++) {
                let ang = Math.random() * Math.PI * 2;
                let r = 8 + Math.random() * 10;
                ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    class SparkParticle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            const ang = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 180;
            this.vx = Math.cos(ang) * spd;
            this.vy = Math.sin(ang) * spd;
            this.life = 0.45 + Math.random() * 0.35;
            this.maxLife = this.life;
            this.size = 2.5 + Math.random() * 3;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vx *= 0.93;
            this.vy *= 0.93;
            this.life -= dt;
        }
        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawHorse(ctx, mount, walk, now) {
        ctx.save();
        ctx.translate(0, 10);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#150C22';

        ctx.save();
        ctx.strokeStyle = mount.maneColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, 2);
        ctx.quadraticCurveTo(-26, 6 + Math.sin(now * 0.015) * 6, -30, 18);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = mount.color;
        ctx.fillStyle = mount.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-12, 4);
        ctx.lineTo(-15 + walk * 5, 14);
        ctx.lineTo(-12 + walk * 6, 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8, 4);
        ctx.lineTo(-10 - walk * 5, 14);
        ctx.lineTo(-6 - walk * 6, 22);
        ctx.stroke();

        ctx.fillStyle = mount.color;
        ctx.beginPath();
        ctx.ellipse(0, 2, 18, 9, -Math.PI / 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = mount.maneColor;
        ctx.fillRect(-4, -4, 8, 4);
        ctx.strokeStyle = mount.maneColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(16, 4); ctx.stroke();

        ctx.strokeStyle = mount.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(8, 4);
        ctx.lineTo(12 - walk * 6, 14);
        ctx.lineTo(15 - walk * 6, 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12, 4);
        ctx.lineTo(15 + walk * 6, 14);
        ctx.lineTo(18 + walk * 6, 22);
        ctx.stroke();

        ctx.fillStyle = mount.color;
        ctx.beginPath();
        ctx.moveTo(10, -2);
        ctx.lineTo(18, -14);
        ctx.lineTo(26, -10);
        ctx.lineTo(24, -4);
        ctx.lineTo(14, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(18, -14); ctx.lineTo(20, -18); ctx.lineTo(22, -13); ctx.fill();

        ctx.strokeStyle = mount.maneColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(12, -4); ctx.lineTo(14, -8);
        ctx.moveTo(14, -8); ctx.lineTo(17, -12);
        ctx.moveTo(17, -12); ctx.lineTo(19, -15);
        ctx.stroke();

        ctx.restore();
    }

    function drawWeapon(ctx, weapon) {
        ctx.save();
        ctx.shadowColor = weapon.glow;
        ctx.shadowBlur = 10;

        if (weapon.id === 'blade') {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(22, -18); ctx.stroke();
            ctx.fillStyle = weapon.glow;
            ctx.beginPath();
            ctx.moveTo(16, -12);
            ctx.quadraticCurveTo(34, -28, 28, -8);
            ctx.lineTo(20, -4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(14, -2); ctx.stroke();
        } else if (weapon.id === 'serpent_spear') {
            ctx.strokeStyle = '#D1D5DB';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-12, 16); ctx.lineTo(18, -14); ctx.stroke();
            ctx.strokeStyle = weapon.glow;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(18, -14); ctx.lineTo(22, -18); ctx.lineTo(20, -22); ctx.lineTo(26, -26);
            ctx.stroke();
        } else if (weapon.id === 'halberd') {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(22, -18); ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.moveTo(22, -18); ctx.lineTo(28, -24); ctx.lineTo(24, -16); ctx.fill();
            ctx.strokeStyle = weapon.glow;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(18, -12, 7, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
        } else if (weapon.id === 'fan') {
            ctx.fillStyle = weapon.glow;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(16, -14); ctx.quadraticCurveTo(24, -8, 14, 4); ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(18, -10);
            ctx.moveTo(0, 0); ctx.lineTo(16, -4);
            ctx.stroke();
        } else if (weapon.id === 'bow') {
            ctx.strokeStyle = weapon.glow;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(8, -6, 14, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, -20); ctx.lineTo(8, 8); ctx.stroke();
            ctx.strokeStyle = '#FFC93C';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(22, -6); ctx.stroke();
        } else {
            ctx.strokeStyle = '#F3F4F6';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(20, -18); ctx.stroke();
            ctx.fillStyle = weapon.glow;
            ctx.fillRect(0, 0, 6, 4);
        }

        ctx.restore();
    }

    function drawWarrior(ctx, p, now) {
        ctx.save();
        ctx.translate(p.x, p.y);

        const walk = Math.sin(now * 0.008 * p.speed + p.walkCycle);
        const facing = p.facing;

        if (p.isCharging) {
            ctx.beginPath();
            ctx.arc(0, -8, 30 + Math.sin(now * 0.04) * 6, 0, Math.PI * 2);
            ctx.fillStyle = p.color === '#22D3EE' ? 'rgba(34,211,238,0.25)' : 'rgba(236,72,153,0.25)';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 24;
            ctx.fill();

            ctx.save();
            ctx.rotate(now * 0.005);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.stroke();
            ctx.restore();
        }

        if (p.mount) {
            ctx.save();
            ctx.scale(facing, 1);
            drawHorse(ctx, p.mount, walk, now);
            ctx.restore();
        }

        const bodyYOffset = p.mount ? -10 : 0;
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        ctx.save();
        ctx.translate(0, bodyYOffset);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(-facing * 16 + Math.sin(now * 0.01) * 4, 12);
        ctx.lineTo(-facing * 4, 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, bodyYOffset - 20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFC93C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, bodyYOffset - 26);
        ctx.quadraticCurveTo(-facing * 8, bodyYOffset - 34, -facing * 14, bodyYOffset - 28);
        ctx.stroke();

        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, bodyYOffset - 14);
        ctx.lineTo(0, bodyYOffset + 4);
        ctx.stroke();

        if (!p.mount) {
            ctx.beginPath();
            ctx.moveTo(0, bodyYOffset + 4);
            ctx.lineTo(walk * 6 - 4, bodyYOffset + 18);
            ctx.moveTo(0, bodyYOffset + 4);
            ctx.lineTo(-walk * 6 + 4, bodyYOffset + 18);
            ctx.stroke();
        }

        const handX = facing * 10;
        const handY = bodyYOffset - 6 + Math.sin(now * 0.008) * 2;
        ctx.beginPath();
        ctx.moveTo(0, bodyYOffset - 10);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        ctx.save();
        ctx.translate(handX, handY);
        ctx.scale(facing, 1);
        ctx.rotate(-Math.PI / 5 + (p.isAttacking ? Math.sin(now * 0.04) * 1.4 : 0));
        drawWeapon(ctx, p.weapon);
        ctx.restore();

        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(p.displayName, 1, bodyYOffset + 32);
        ctx.fillStyle = '#F6F3FF';
        ctx.fillText(p.displayName, 0, bodyYOffset + 31);

        ctx.restore();
    }

    window.runThreeKingdoms = function(users, containerEl, durationSec, onFinish) {
        if (!users || users.length === 0) return;

        let rawList = [...users];
        if (rawList.length > MAX_PLAYERS) {
            rawList = shuffle(rawList).slice(0, MAX_PLAYERS);
        }

        const totalDurationMs = durationSec * 1000;
        const activePlayTime = Math.max(1500, totalDurationMs - 5200);

        const shuffled = shuffle(rawList.map((u, i) => ({ u, i })));
        const winnerObj = shuffled.pop();
        const runnerUpObj = shuffled.length > 0 ? shuffled.pop() : null;
        
        const losers = shuffled;
        const totalLosers = losers.length;

        const eliminationSchedule = [];
        for (let i = 0; i < totalLosers; i++) {
            const f = (i + 1) / (totalLosers || 1);
            const timeToDie = Math.pow(f, 1.6) * activePlayTime;
            eliminationSchedule.push({
                idx: losers[i].i,
                time: timeToDie
            });
        }

        containerEl.innerHTML = `
            <div style="font-family:'Baloo 2',sans-serif; text-align:center; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; color:var(--text-mid); padding:0 8px;">
                    <span>⚔️ Tướng sĩ còn lại: <strong id="tkAlive" style="color:var(--cyan);font-weight:800;">${rawList.length}</strong>/${rawList.length}</span>
                    <span>⏱️ <strong id="tkTimer" style="color:var(--yellow);font-weight:800;">${durationSec}s</strong></span>
                </div>
            </div>
            <div style="position:relative; width:100%; height:350px; overflow:hidden; border-radius:20px; background:radial-gradient(circle at center, #1E1035 0%, #0B0713 100%); border:1px solid rgba(139,92,246,0.3); box-shadow:0 12px 40px rgba(0,0,0,0.6);">
                <canvas id="tkCanvas" style="width:100%; height:100%; display:block;"></canvas>
            </div>
            <div id="tkKillFeed" style="margin-top:12px; height:140px; overflow-y:auto; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:10px 14px; font-size:12.5px; font-family:'Plus Jakarta Sans',sans-serif; display:flex; flex-direction:column; gap:7px; box-shadow:inset 0 2px 10px rgba(0,0,0,0.5);">
                <div style="color:var(--text-dim); text-align:center; font-size:12px;">🚩 Tiếng trống trận vang lên! Các lộ anh hùng bắt đầu phân tranh...</div>
            </div>
        `;

        const canvas = containerEl.querySelector('#tkCanvas');
        const ctx = canvas.getContext('2d');
        const aliveEl = containerEl.querySelector('#tkAlive');
        const timerEl = containerEl.querySelector('#tkTimer');
        const killFeedEl = containerEl.querySelector('#tkKillFeed');

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const W = rect.width || 560;
        const H = rect.height || 350;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        function logBattle(html) {
            if (!killFeedEl) return;
            const item = document.createElement('div');
            item.style.lineHeight = '1.4';
            item.innerHTML = html;
            killFeedEl.appendChild(item);
            killFeedEl.scrollTop = killFeedEl.scrollHeight;
        }

        let players = rawList.map((u, i) => {
            const sched = eliminationSchedule.find(e => e.idx === i);
            const isFinalist = (i === winnerObj.i || (runnerUpObj && i === runnerUpObj.i));
            const name = u.username || u.name || `Tướng #${i + 1}`;
            return {
                id: i,
                raw: u,
                displayName: name,
                color: NEON_COLORS[i % NEON_COLORS.length],
                weapon: WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)],
                mount: Math.random() > 0.45 ? MOUNT_TYPES[Math.floor(Math.random() * MOUNT_TYPES.length)] : null,
                x: Math.random() * (W - 120) + 60,
                y: Math.random() * (H - 140) + 70,
                targetX: Math.random() * (W - 120) + 60,
                targetY: Math.random() * (H - 140) + 70,
                speed: 1.3 + Math.random() * 1.6,
                facing: Math.random() > 0.5 ? 1 : -1,
                isAlive: true,
                isAttacking: false,
                isCharging: false,
                deathTime: isFinalist ? Infinity : (sched ? sched.time : 0),
                walkCycle: Math.random() * Math.PI * 2
            };
        });

        let particles = [];
        let slashes = [];
        let shockwaves = [];
        let orbs = [];
        let projectiles = [];
        const startTime = performance.now();
        let lastTime = startTime;
        let isEnded = false;
        let finalDuelPhase = 0;

        function frame(now) {
            const dt = Math.min(0.1, (now - lastTime) / 1000);
            lastTime = now;
            const elapsed = now - startTime;
            const remainingMs = Math.max(0, totalDurationMs - elapsed);

            timerEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;

            // 1. Loại trừ vòng loại thường (Dash tiếp cận hoặc Bắn tên trực tiếp)
            players.forEach(p => {
                if (p.isAlive && elapsed >= p.deathTime) {
                    p.isAlive = false;

                    const aliveKillers = players.filter(k => k.isAlive && k.id !== p.id);
                    const killer = aliveKillers.length > 0 
                        ? aliveKillers[Math.floor(Math.random() * aliveKillers.length)] 
                        : players[winnerObj.i];

                    // Quay mặt hung thủ về phía nạn nhân
                    killer.facing = p.x >= killer.x ? 1 : -1;
                    killer.isAttacking = true;
                    setTimeout(() => { killer.isAttacking = false; }, 400);

                    if (killer.weapon.range === 'ranged') {
                        // BẮN XA: Phóng mũi tên từ killer tới p
                        projectiles.push(new ArrowProjectile(killer.x, killer.y - 10, p.x, p.y - 10, killer.weapon.glow));
                        setTimeout(() => {
                            slashes.push(new CrescentSlash(p.x, p.y, killer.weapon.glow, Math.random() * Math.PI, 40));
                            shockwaves.push(new ShockwaveRing(p.x, p.y, killer.color, 45));
                            for (let j = 0; j < 16; j++) particles.push(new SparkParticle(p.x, p.y, p.color));
                        }, 280);
                    } else {
                        // CẬN CHIẾN: Phi thân áp sát p chém trực diện
                        killer.x = p.x - killer.facing * 28;
                        killer.y = p.y;
                        slashes.push(new CrescentSlash(p.x, p.y, killer.weapon.glow, killer.facing === 1 ? -Math.PI / 4 : Math.PI * 0.75, 48));
                        shockwaves.push(new ShockwaveRing(p.x, p.y, killer.color, 50));
                        for (let j = 0; j < 18; j++) particles.push(new SparkParticle(p.x, p.y, p.color));
                    }

                    const aliveCount = players.filter(a => a.isAlive).length;
                    aliveEl.textContent = aliveCount;
                    logBattle(`⚔️ <strong style="color:${killer.color};">${escHtml(killer.displayName)}</strong> đã hạ gục <strong style="color:${p.color};">${escHtml(p.displayName)}</strong> <span style="color:var(--danger);font-size:11px;">[Còn ${aliveCount}]</span>`);
                }
            });

            // 2. SOLO ĐẠI CHUNG KẾT 2 NGƯỜI CUỐI (Luôn nhìn nhau trực diện)
            if (elapsed >= activePlayTime && finalDuelPhase === 0) {
                finalDuelPhase = 1;
                const winner = players[winnerObj.i];
                const runnerUp = runnerUpObj ? players[runnerUpObj.i] : null;

                if (runnerUp && runnerUp.isAlive) {
                    winner.targetX = W / 2 - 45;
                    winner.targetY = H / 2;
                    winner.speed = 4.5;
                    runnerUp.targetX = W / 2 + 45;
                    runnerUp.targetY = H / 2;
                    runnerUp.speed = 4.5;

                    logBattle(`🔥 <strong style="color:var(--yellow);">[CHUNG KẾT - HIỆP 1]</strong> <strong style="color:${winner.color};">${escHtml(winner.displayName)}</strong> và <strong style="color:${runnerUp.color};">${escHtml(runnerUp.displayName)}</strong> so tài đao kiếm tóe lửa!`);

                    setTimeout(() => {
                        winner.isAttacking = true;
                        runnerUp.isAttacking = true;
                        
                        slashes.push(new CrescentSlash(W / 2, H / 2, winner.color, -Math.PI / 4, 75, Math.PI));
                        slashes.push(new CrescentSlash(W / 2, H / 2, runnerUp.color, Math.PI * 0.75, 75, Math.PI));
                        shockwaves.push(new ShockwaveRing(W / 2, H / 2, '#FFFFFF', 100));
                        for (let k = 0; k < 30; k++) particles.push(new SparkParticle(W / 2, H / 2, '#FFC93C'));

                        winner.targetX = W / 2 - 130;
                        runnerUp.targetX = W / 2 + 130;

                        setTimeout(() => {
                            finalDuelPhase = 2;
                            winner.isCharging = true;
                            runnerUp.isCharging = true;

                            logBattle(`⚡ <strong style="color:var(--pink);">[CHUNG KẾT - HIỆP 2]</strong> Cả hai cùng vận nội công phóng Chưởng đối kháng dữ dội!`);

                            orbs.push(new EnergyOrb(winner.x, winner.y, W / 2, H / 2, winner.color));
                            orbs.push(new EnergyOrb(runnerUp.x, runnerUp.y, W / 2, H / 2, runnerUp.color));

                            setTimeout(() => {
                                winner.isCharging = false;
                                runnerUp.isCharging = false;
                                
                                shockwaves.push(new ShockwaveRing(W / 2, H / 2, '#22D3EE', 140));
                                shockwaves.push(new ShockwaveRing(W / 2, H / 2, '#EC4899', 110));
                                slashes.push(new CrescentSlash(W / 2, H / 2, '#FFFFFF', 0, 85, Math.PI * 1.2));
                                for (let k = 0; k < 45; k++) particles.push(new SparkParticle(W / 2, H / 2, '#22F2C8'));

                                setTimeout(() => {
                                    finalDuelPhase = 3;
                                    winner.speed = 10.0;
                                    winner.targetX = runnerUp.x + 55;
                                    
                                    setTimeout(() => {
                                        runnerUp.isAlive = false;

                                        slashes.push(new CrescentSlash(runnerUp.x, runnerUp.y, '#FFC93C', -Math.PI / 4, 110, Math.PI * 1.5));
                                        slashes.push(new CrescentSlash(runnerUp.x, runnerUp.y, '#FF5470', Math.PI * 0.75, 110, Math.PI * 1.5));
                                        shockwaves.push(new ShockwaveRing(runnerUp.x, runnerUp.y, '#FFC93C', 160));
                                        for (let k = 0; k < 60; k++) {
                                            particles.push(new SparkParticle(runnerUp.x, runnerUp.y, '#FFC93C'));
                                        }
                                        aliveEl.textContent = 1;

                                        logBattle(`👑 <strong style="color:var(--cyan);">[TUYỆT KỸ KẾT LIỄU]</strong> <strong style="color:${winner.color};">${escHtml(winner.displayName)}</strong> đã hạ gục <strong style="color:${runnerUp.color};">${escHtml(runnerUp.displayName)}</strong>!`);
                                        logBattle(`🏆 <strong style="color:var(--yellow); font-size:13.5px;">👑 ${escHtml(winner.displayName)} thống nhất Tam Quốc, đoạt giải Giveaway! 🎉</strong>`);
                                    }, 400);

                                }, 1300);

                            }, 700);

                        }, 1200);

                    }, 800);
                }
            }

            // 3. Cập nhật vị trí & Khóa hướng mặt (Facing)
            players.forEach(p => {
                if (!p.isAlive) return;

                const dx = p.targetX - p.x;
                const dy = p.targetY - p.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 6) {
                    p.x += (dx / dist) * p.speed;
                    p.y += (dy / dist) * p.speed;
                } else if (finalDuelPhase === 0 && Math.random() < 0.02) {
                    p.targetX = Math.random() * (W - 120) + 60;
                    p.targetY = Math.random() * (H - 140) + 70;
                }

                if (finalDuelPhase > 0) {
                    const other = (p.id === winnerObj.i && runnerUpObj) ? players[runnerUpObj.i] : players[winnerObj.i];
                    if (other) {
                        p.facing = other.x >= p.x ? 1 : -1;
                    }
                } else {
                    if (Math.abs(dx) > 1) {
                        p.facing = dx >= 0 ? 1 : -1;
                    }
                }
            });

            // Cập nhật hạt & đạn bay
            projectiles.forEach(pr => pr.update(dt));
            projectiles = projectiles.filter(pr => !pr.isDone);
            slashes.forEach(s => s.update(dt));
            slashes = slashes.filter(s => s.life > 0);
            shockwaves.forEach(sw => sw.update(dt));
            shockwaves = shockwaves.filter(sw => sw.life > 0);
            orbs.forEach(o => o.update(dt));
            orbs = orbs.filter(o => !o.isDone);
            particles.forEach(pt => pt.update(dt));
            particles = particles.filter(pt => pt.life > 0);

            // --- RENDER ---
            ctx.clearRect(0, 0, W, H);

            ctx.save();
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.18)';
            ctx.lineWidth = 2;
            ctx.strokeRect(25, 25, W - 50, H - 50);
            [[25, 25], [W - 25, 25], [25, H - 25], [W - 25, H - 25]].forEach(([cx, cy]) => {
                ctx.beginPath();
                ctx.arc(cx, cy, 12, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.restore();

            players.forEach(p => {
                if (p.isAlive) {
                    drawWarrior(ctx, p, now);
                }
            });

            projectiles.forEach(pr => pr.draw(ctx));
            shockwaves.forEach(sw => sw.draw(ctx));
            orbs.forEach(o => o.draw(ctx));
            slashes.forEach(s => s.draw(ctx));
            particles.forEach(pt => pt.draw(ctx));

            if (elapsed < totalDurationMs && !isEnded) {
                requestAnimationFrame(frame);
            } else if (!isEnded) {
                isEnded = true;
                if (onFinish) onFinish(winnerObj.u);
            }
        }

        requestAnimationFrame(frame);
    };
})();