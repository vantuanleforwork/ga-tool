/**
 * DINO HUNT - SĂN KHỦNG LONG PRO
 * Người que cầm Rìu/Lao/Đá ném Boss.
 * Boss thực hiện 4 chiêu: Phun lửa, Giậm đất, Quét đuôi, Cắn nuốt.
 */

window.runDinoHunt = function(users, containerEl, durationSec, onFinish) {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    containerEl.innerHTML = '';
    containerEl.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;

    function resize() {
        const rect = containerEl.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    const NEON_COLORS = ['#22D3EE', '#EC4899', '#8B5CF6', '#FFC93C', '#22F2C8'];
    const WEAPONS = ['spear', 'axe', 'rock'];

    // Chuẩn hóa danh sách người chơi
    const normalizedUsers = users.map((u, idx) => ({
        id: u.id || u.channelId || `user_${idx}`,
        username: u.username || u.name || `Hunter #${idx + 1}`,
        raw: u
    }));

    const shuffled = [...normalizedUsers].sort(() => Math.random() - 0.5);
    const winnerUser = shuffled.pop();
    const losers = shuffled;
    const totalLosers = losers.length;

    const activePlayTime = Math.max(2000, (durationSec * 1000) - 3500);
    const eliminationSchedule = [];

    for (let i = 0; i < totalLosers; i++) {
        const f = (i + 1) / (totalLosers || 1);
        const timeToDie = Math.pow(f, 1.6) * activePlayTime;
        eliminationSchedule.push({
            user: losers[i],
            time: timeToDie
        });
    }

    // Khởi tạo Hunters
    let players = normalizedUsers.map(u => {
        const schedule = eliminationSchedule.find(e => e.user.id === u.id);
        return {
            id: u.id,
            name: u.username,
            raw: u.raw,
            color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
            weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)],
            x: Math.random() * (width - 120) + 60,
            y: height - 40 - Math.random() * (height * 0.35),
            targetX: Math.random() * (width - 120) + 60,
            targetY: height - 40 - Math.random() * (height * 0.35),
            speed: 1.5 + Math.random() * 1.5,
            isDead: false,
            deathTime: u.id === winnerUser.id ? Infinity : (schedule ? schedule.time : 0),
            throwCooldown: 400 + Math.random() * 1200,
            walkCycle: Math.random() * Math.PI * 2
        };
    });

    // Trạng thái Boss Dino
    let dino = {
        x: width / 2,
        y: height * 0.38,
        baseY: height * 0.38,
        facing: 1, // 1: phải, -1: trái
        state: 'idle', // idle, fire, stomp, tail, bite, dead
        actionTimer: 0,
        maxActionTimer: 0,
        targetPlayer: null,
        jawAngle: 0,
        tailAngle: 0,
        bodyOffset: 0,
        shakeX: 0,
        shakeY: 0,
        scale: 1
    };

    let projectiles = [];
    let particles = [];
    let shockwaves = [];
    let fireParticles = [];

    const startTime = performance.now();
    let isGameEnded = false;
    let animFrame;

    // --- HÀM VẼ KHỦNG LONG VECTOR ĐỘC QUYỀN ---
    function drawDino(d, elapsed) {
        ctx.save();
        ctx.translate(d.x + d.shakeX, d.y + d.shakeY + d.bodyOffset);
        ctx.scale(d.facing * d.scale, d.scale);

        if (d.state === 'dead') {
            const deathProgress = Math.min(1, (elapsed - activePlayTime) / 2500);
            ctx.rotate(deathProgress * (Math.PI / 2.2));
            ctx.translate(0, deathProgress * 60);
        }

        // 1. Đuôi lớn với gai lưng
        ctx.save();
        ctx.rotate(d.tailAngle + Math.sin(elapsed * 0.005) * 0.1);
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#150C22';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-20, 10);
        ctx.quadraticCurveTo(-70, -10, -110, 20);
        ctx.quadraticCurveTo(-60, 40, -10, 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gai đuôi
        ctx.fillStyle = '#FFC93C';
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.moveTo(-50 - i*20, 0 + i*6);
            ctx.lineTo(-60 - i*20, -14 + i*6);
            ctx.lineTo(-40 - i*20, 5 + i*6);
            ctx.fill();
        }
        ctx.restore();

        // 2. Chân sau (Cơ bắp & Móng vuốt)
        ctx.fillStyle = '#991B1B';
        ctx.strokeStyle = '#150C22';
        ctx.lineWidth = 4;
        // Chân trái (sau)
        ctx.beginPath();
        ctx.ellipse(-15, 45, 16, 28, Math.PI/12, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        // Bàn chân sau
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(-25, 70);
        ctx.lineTo(-5, 70);
        ctx.lineTo(-10, 60);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 3. Thân chính
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.ellipse(0, 10, 42, 36, -Math.PI/15, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        // Gai lưng thân
        ctx.fillStyle = '#FFC93C';
        for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.moveTo(-15 + i*15, -24);
            ctx.lineTo(-10 + i*15, -38);
            ctx.lineTo(-5 + i*15, -22);
            ctx.fill();
        }

        // 4. Cổ và Đầu T-Rex
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(15, -10);
        ctx.quadraticCurveTo(35, -45, 65, -35); // đỉnh đầu
        ctx.lineTo(75, -20); // hàm trên
        ctx.lineTo(35, -5);  // họng
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Mắt phát sáng Neon
        ctx.fillStyle = '#22F2C8';
        ctx.shadowColor = '#22F2C8';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(48, -32, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(49, -32, 2, 0, Math.PI*2);
        ctx.fill();

        // Răng trên
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(42 + i * 8, -20);
            ctx.lineTo(46 + i * 8, -12);
            ctx.lineTo(50 + i * 8, -20);
            ctx.fill();
        }

        // Hàm dưới (Háo mồm khi cắn hoặc phun lửa)
        ctx.save();
        ctx.translate(35, -5);
        ctx.rotate(d.jawAngle);
        ctx.fillStyle = '#B91C1C';
        ctx.strokeStyle = '#150C22';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(38, -8);
        ctx.lineTo(35, 5);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Răng dưới
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(10 + i * 8, -3);
            ctx.lineTo(14 + i * 8, -9);
            ctx.lineTo(18 + i * 8, -3);
            ctx.fill();
        }
        ctx.restore();

        // 5. Tay trước nhỏ đặc trưng
        ctx.fillStyle = '#991B1B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(25, 5);
        ctx.lineTo(38, 12);
        ctx.lineTo(35, 18);
        ctx.stroke();
        // Móng vuốt nhỏ
        ctx.fillStyle = '#FFF';
        ctx.fillRect(36, 16, 3, 3);

        ctx.restore();
    }

    // --- HÀM VẼ NGƯỜI QUE (2 TAY, 2 CHÂN, VŨ KHÍ) ---
    function drawStickman(p, elapsed) {
        ctx.save();
        ctx.translate(p.x, p.y);

        const walk = Math.sin(elapsed * 0.01 * p.speed + p.walkCycle);
        const facing = p.x < dino.x ? 1 : -1;

        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Đầu & Khăn quấn đầu
        ctx.beginPath();
        ctx.arc(0, -22, 6, 0, Math.PI * 2);
        ctx.fill();

        // 2. Thân người
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 3. Hai Chân (Cử động bước đi)
        ctx.beginPath();
        // Chân trái
        ctx.moveTo(0, 0);
        ctx.lineTo(walk * 6 - 4, 10);
        ctx.lineTo(walk * 8 - 6, 20);
        // Chân phải
        ctx.moveTo(0, 0);
        ctx.lineTo(-walk * 6 + 4, 10);
        ctx.lineTo(-walk * 8 + 6, 20);
        ctx.stroke();

        // 4. Hai Tay & Cầm Vũ Khí
        ctx.beginPath();
        // Tay sau (giơ cân bằng)
        ctx.moveTo(0, -12);
        ctx.lineTo(-facing * 8, -6 + walk * 4);
        ctx.lineTo(-facing * 14, -2);
        ctx.stroke();

        // Tay trước (giơ vũ khí ngắm về phía Boss)
        ctx.beginPath();
        ctx.moveTo(0, -12);
        const handX = facing * 10;
        const handY = -14 + Math.sin(elapsed * 0.008) * 3;
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Vẽ vũ khí trên tay
        ctx.save();
        ctx.translate(handX, handY);
        ctx.scale(facing, 1);
        if (p.weapon === 'spear') {
            ctx.strokeStyle = '#D1D5DB';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 6);
            ctx.lineTo(16, -10);
            ctx.stroke();
            // Mũi lao
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(16, -10);
            ctx.lineTo(12, -14);
            ctx.lineTo(20, -12);
            ctx.closePath();
            ctx.fill();
        } else if (p.weapon === 'axe') {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-4, 6);
            ctx.lineTo(8, -8);
            ctx.stroke();
            // Lưỡi rìu
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(8, -8, 6, -Math.PI/2, Math.PI/2);
            ctx.fill();
        } else {
            // Hòn đá
            ctx.fillStyle = '#9CA3AF';
            ctx.beginPath();
            ctx.arc(2, -2, 4, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();

        // 5. Hiển thị toàn bộ tên người chơi (Full display)
        ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(p.name, 1, 33); // viền đổ bóng tên
        ctx.fillStyle = '#F6F3FF';
        ctx.fillText(p.name, 0, 32);

        ctx.restore();
    }

    // --- GAME LOOP ---
    function update(timestamp) {
        const elapsed = timestamp - startTime;
        ctx.clearRect(0, 0, width, height);

        // Nền Đấu Trường Cổ Đại Neon
        ctx.fillStyle = '#0B0713';
        ctx.fillRect(0, 0, width, height);

        // Đường chân trời / vết nứt nham thạch nền
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.6);
        ctx.lineTo(width, height * 0.6);
        ctx.stroke();

        // 1. Quản lý trạng thái Boss tấn công theo lịch loại trừ
        players.forEach(p => {
            if (!p.isDead && elapsed >= p.deathTime) {
                p.isDead = true;
                const attacks = ['fire', 'stomp', 'tail', 'bite'];
                dino.state = attacks[Math.floor(Math.random() * attacks.length)];
                dino.actionTimer = 700;
                dino.maxActionTimer = 700;
                dino.targetPlayer = p;
                dino.facing = p.x > dino.x ? 1 : -1;

                // Tác vụ theo từng chiêu
                if (dino.state === 'stomp') {
                    shockwaves.push({ x: dino.x, y: dino.y + 70, radius: 10, maxRadius: 180, alpha: 1 });
                } else if (dino.state === 'bite') {
                    dino.x = p.x - dino.facing * 50; // lao tới cắn
                }

                // Hạt máu / năng lượng nổ
                for (let i = 0; i < 20; i++) {
                    particles.push({
                        x: p.x, y: p.y,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10 - 2,
                        life: 1, color: p.color, size: 3 + Math.random() * 2
                    });
                }
            }
        });

        // 2. Diễn hoạt hoạt ảnh Boss
        if (dino.state !== 'idle' && dino.state !== 'dead') {
            dino.actionTimer -= 16;
            const progress = dino.actionTimer / dino.maxActionTimer;

            if (dino.state === 'fire') {
                dino.jawAngle = Math.PI / 4;
                dino.shakeX = (Math.random() - 0.5) * 6;
                // Bắn tia hạt lửa cuộn xoáy
                if (dino.targetPlayer) {
                    for(let k=0; k<3; k++) {
                        fireParticles.push({
                            x: dino.x + dino.facing * 60,
                            y: dino.y - 20,
                            tx: dino.targetPlayer.x,
                            ty: dino.targetPlayer.y,
                            vx: (dino.targetPlayer.x - (dino.x + dino.facing * 60)) * 0.08 + (Math.random()-0.5)*4,
                            vy: (dino.targetPlayer.y - (dino.y - 20)) * 0.08 + (Math.random()-0.5)*4,
                            life: 1,
                            color: Math.random() > 0.5 ? '#FF3D8A' : '#FFC93C',
                            size: 4 + Math.random() * 6
                        });
                    }
                }
            } else if (dino.state === 'stomp') {
                dino.bodyOffset = -Math.sin(progress * Math.PI) * 35; // nhảy lên giậm xuống
                dino.shakeY = (Math.random() - 0.5) * 10;
            } else if (dino.state === 'tail') {
                dino.tailAngle = Math.sin(progress * Math.PI * 2) * 1.2; // quất đuôi cực mạnh
            } else if (dino.state === 'bite') {
                dino.jawAngle = Math.sin(progress * Math.PI) * (Math.PI / 3);
            }

            if (dino.actionTimer <= 0) {
                dino.state = 'idle';
                dino.jawAngle = 0;
                dino.tailAngle = 0;
                dino.bodyOffset = 0;
                dino.shakeX = 0;
                dino.shakeY = 0;
                dino.x = width / 2; // trở về giữa
            }
        } else {
            // Idle thở phập phồng
            dino.bodyOffset = Math.sin(elapsed * 0.004) * 4;
        }

        // 3. Kết thúc kịch tính: Người sống sót phóng Đại Lao Tiêu Diệt Boss
        if (elapsed >= activePlayTime && !isGameEnded) {
            dino.state = 'dead';
            isGameEnded = true;
            const winner = players.find(p => p.id === winnerUser.id);
            if (winner) {
                projectiles.push({
                    x: winner.x, y: winner.y - 15,
                    tx: dino.x, ty: dino.y - 10,
                    speed: 18, color: '#FFC93C', isUltimate: true
                });
            }

            setTimeout(() => {
                cancelAnimationFrame(animFrame);
                window.removeEventListener('resize', resize);
                onFinish(winnerUser.raw);
            }, 3200);
        }

        // 4. Cập nhật và vẽ Sóng chấn động (Stomp Shockwave)
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const sw = shockwaves[i];
            sw.radius += 8;
            sw.alpha -= 0.03;
            if (sw.alpha <= 0) {
                shockwaves.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * 0.35, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 61, 138, ${sw.alpha})`;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }

        // 5. Cập nhật & vẽ Hạt Lửa (Fire Breath)
        for (let i = fireParticles.length - 1; i >= 0; i--) {
            const fp = fireParticles[i];
            fp.x += fp.vx;
            fp.y += fp.vy;
            fp.life -= 0.05;
            if (fp.life <= 0) {
                fireParticles.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = fp.life;
            ctx.fillStyle = fp.color;
            ctx.shadowColor = fp.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(fp.x, fp.y, fp.size * fp.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 6. Vẽ Khủng Long
        drawDino(dino, elapsed);

        // 7. Cập nhật & vẽ Người chơi
        players.forEach(p => {
            if (p.isDead) return;

            // Di chuyển tìm vị trí ném
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 4) {
                p.x += (dx / dist) * p.speed;
                p.y += (dy / dist) * p.speed;
            } else if (Math.random() < 0.02) {
                p.targetX = Math.random() * (width - 120) + 60;
                p.targetY = height - 40 - Math.random() * (height * 0.35);
            }

            // Ném vũ khí
            p.throwCooldown -= 16;
            if (p.throwCooldown <= 0 && dino.state !== 'dead') {
                projectiles.push({
                    x: p.x, y: p.y - 12,
                    tx: dino.x + (Math.random() - 0.5) * 40,
                    ty: dino.y - 10 + (Math.random() - 0.5) * 30,
                    speed: 6 + Math.random() * 4,
                    type: p.weapon,
                    color: p.color,
                    angle: 0
                });
                p.throwCooldown = 800 + Math.random() * 1500;
            }

            drawStickman(p, elapsed);
        });

        // 8. Cập nhật & vẽ Vũ khí bay (Projectiles)
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const pr = projectiles[i];
            const dx = pr.tx - pr.x;
            const dy = pr.ty - pr.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < pr.speed) {
                projectiles.splice(i, 1);
                // Nổ tia lửa khi trúng Boss
                for (let j = 0; j < (pr.isUltimate ? 30 : 4); j++) {
                    particles.push({
                        x: pr.tx, y: pr.ty,
                        vx: (Math.random() - 0.5) * (pr.isUltimate ? 16 : 6),
                        vy: (Math.random() - 0.5) * (pr.isUltimate ? 16 : 6),
                        life: 1,
                        color: pr.color,
                        size: pr.isUltimate ? 5 : 2.5
                    });
                }
                continue;
            }

            pr.x += (dx / dist) * pr.speed;
            pr.y += (dy / dist) * pr.speed;
            pr.angle = Math.atan2(dy, dx);

            ctx.save();
            ctx.translate(pr.x, pr.y);
            ctx.rotate(pr.angle);

            if (pr.isUltimate) {
                // Đại lao vàng rực kết liễu
                ctx.shadowColor = '#FFC93C';
                ctx.shadowBlur = 15;
                ctx.strokeStyle = '#FFC93C';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(-25, 0); ctx.lineTo(25, 0); ctx.stroke();
                ctx.fillStyle = '#FFF';
                ctx.beginPath();
                ctx.moveTo(25, 0); ctx.lineTo(15, -8); ctx.lineTo(15, 8); ctx.closePath(); ctx.fill();
            } else if (pr.type === 'spear') {
                ctx.strokeStyle = pr.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
            } else if (pr.type === 'axe') {
                ctx.rotate(elapsed * 0.03); // Rìu xoay tròn khi bay
                ctx.fillStyle = pr.color;
                ctx.fillRect(-6, -6, 12, 12);
            } else {
                // Đá lăn xoay
                ctx.fillStyle = '#9CA3AF';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        // 9. Cập nhật Particles nổ
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= 0.035;
            if (pt.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = pt.life;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size || 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        animFrame = requestAnimationFrame(update);
    }

    animFrame = requestAnimationFrame(update);
};