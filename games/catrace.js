// ===================================================================
// 🐱 Đua Mèo Leo Cây — mini-game "Vui nhộn" cho Giveaway Live Tool
// Tải riêng khi người dùng chọn mode Đua Mèo Leo Cây (không nằm trong bundle chính).
//
// Cơ chế: mỗi người là 1 chú mèo leo dọc thân cây lên cuộn len ở đỉnh, vừa leo
// vừa lắc lư zigzag trái/phải và bật nhảy từng nhịp. Ai leo cao nhất đúng lúc
// hết giờ sẽ thắng. Vạch đích chỉ lộ ra ở 5 giây cuối để tăng kịch tính.
//
// [Bản sửa lỗi] Bản trước xoay hẳn emoji mèo 90° (ctx.rotate(-Math.PI/2)) để
// giả lập tư thế bám ngang thân cây, nhưng vì emoji mèo không đối xứng trên-dưới
// nên xoay kiểu đó khiến mèo trông như bị LỘN NGƯỢC (mặt chúc xuống đất). Bản
// này bỏ hẳn kiểu xoay 90° đó — mèo đứng thẳng bình thường (đầu luôn hướng lên),
// và thay vào đó thêm hàng loạt chi tiết chuyển động để trông SINH ĐỘNG hơn:
//   - Lật mặt trái/phải theo đúng hướng đang di chuyển ngang (giống thật hơn
//     là cứ đứng yên 1 chiều).
//   - Nghiêng người nhẹ (không lộn ngược) theo nhịp nhảy để tạo cảm giác đang
//     chật vật bấu leo, không phải trượt đều đều.
//   - Co giãn kiểu "squash & stretch" hoạt hình: vươn dài lúc bật nhảy, hơi
//     dẹt lúc bám chặt vào thân cây.
//   - Mèo thuộc nhóm dẫn đầu (pace cao) nhảy/lắc nhanh hơn hẳn nhóm phía sau —
//     nhìn là biết ngay ai đang máu lửa hơn.
//   - Thỉnh thoảng bắn ra chút bụi vỏ cây mỗi khi 1 mèo top-đầu vừa tiếp đất
//     sau cú nhảy, cho cảm giác có lực/ma sát thật.
//
// Vẫn giữ nguyên lý đã kiểm chứng từ Duck Race để đảm bảo công bằng & luôn kết
// thúc đúng giờ: 20% nhóm "mèo dẫn đầu" pace cao, đường cong lồi timeShape(f)=
// f^1.6 khiến khoảng cách giãn dần về cuối, và mèo thắng có pha kịch bản riêng
// (bình thường → tụt lại → bứt tốc) — luôn đảm bảo tiến trình KHÔNG BAO GIỜ giảm.
//
// API: window.runCatRace(users, containerEl, durationSec, onFinish)
// ===================================================================
(function () {
    const ASPECT_RATIO = 900 / 760; // dọc cao hơn ngang một chút — đủ không gian để leo
    const MAX_RACERS = 100;

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

    window.runCatRace = function (users, containerEl, durationSec, onFinish) {
        const duration = (typeof durationSec === 'number' && durationSec > 0) ? durationSec : 15;
        const durationMs = duration * 1000;

        let racers = users.slice();
        let sampled = false;
        if (racers.length > MAX_RACERS) {
            racers = shuffle(racers).slice(0, MAX_RACERS);
            sampled = true;
        }
        racers = shuffle(racers);

        const n = racers.length;
        const emojiSize = n <= 15 ? 30 : n <= 35 ? 24 : n <= 65 ? 19 : 15;
        const nameSize = n <= 15 ? 12.5 : n <= 35 ? 11 : n <= 65 ? 9.5 : 8;
        containerEl.innerHTML = `
            <h3 style="margin:0 0 6px;font-family:'Baloo 2', sans-serif;font-size:16px;color:var(--violet);">🐱 Đua Mèo Leo Cây — về đích sau <span id="catTimeLeft">${duration}</span>s...</h3>
            ${sampled ? `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">Danh sách có ${users.length} người, đã chọn ngẫu nhiên ${MAX_RACERS} mèo để leo.</div>` : ''}
            <canvas id="catCanvas" style="width:100%; display:block; border-radius:16px; border:1px solid var(--border);"></canvas>
        `;

        const canvas = containerEl.querySelector('#catCanvas');
        const ctx = canvas.getContext('2d');
        const timeLeftEl = containerEl.querySelector('#catTimeLeft');

        // --- Canvas theo đúng mật độ điểm ảnh màn hình để hết mờ/nhòe ---
        const dpr = window.devicePixelRatio || 1;
        const W = Math.max(320, containerEl.clientWidth || 760);
        const H = Math.round(W * ASPECT_RATIO);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const TOP_MARGIN = Math.round(H * 0.10);    // vùng đỉnh cây, nơi treo cuộn len
        const BOTTOM_MARGIN = Math.round(H * 0.07); // mặt đất xuất phát
        const START_Y = H - BOTTOM_MARGIN;
        const FINISH_Y = TOP_MARGIN;

        const trunkCenterX = W / 2;
        const trunkWidth = clamp(W * 0.09, 18, 46);

        // Cành cây trang trí cố định (chỉ để vẽ nền cho đẹp, không liên quan tới lịch đua)
        const BRANCHES = [];
        {
            const branchCount = 6;
            for (let b = 0; b < branchCount; b++) {
                const by = H - (b + 1) * (H / (branchCount + 1));
                BRANCHES.push({ y: by, side: (b % 2 === 0) ? 1 : -1, len: randRange(0.15, 0.23) * W });
            }
        }

        // --- Chia đàn mèo thành 2 nhóm để tạo khoảng cách RÕ RỆT dần về cuối trận:
        // ~20% "nhóm dẫn đầu" (pace cao) và phần còn lại "nhóm bám đuổi" (pace thấp hơn hẳn).
        // Tính TRƯỚC pace để các thông số chuyển động (tốc độ lắc/nhảy) bám theo pace,
        // giúp nhóm dẫn đầu nhìn "máu lửa" hơn hẳn — đây là phần làm cho sinh động hơn.
        const leaderCount = Math.max(1, Math.round(n * 0.2));
        const leaderSet = new Set(shuffle(racers.map((_, i) => i)).slice(0, leaderCount));
        const pace = racers.map((_, i) => leaderSet.has(i) ? randRange(0.8, 1) : randRange(0.35, 0.68));
        const maxPace = Math.max.apply(null, pace);

        // Mèo lắc lư trái/phải quanh thân cây khi leo (kiểu zigzag bám vỏ cây),
        // không chia làn cứng — được phép đè lên nhau, giống tinh thần "hồ chung" của Duck Race.
        // Mèo pace càng cao thì lắc/nhảy càng nhanh — trông sống động và có mục đích hơn.
        const energyFactor = racers.map((_, i) => 0.75 + 0.55 * (pace[i] / maxPace));
        const xAmp = racers.map(() => randRange(W * 0.05, W * 0.16));
        const xSpeed = racers.map((_, i) => randRange(0.45, 0.85) * energyFactor[i]);
        const xPhase = racers.map(() => randRange(0, Math.PI * 2));

        // Hiệu ứng "bật nhảy" khi leo — thay cho kiểu bồng bềnh của vịt, tạo cảm giác
        // mèo đang bấu chân nhảy từng nhịp lên cao (chỉ ảnh hưởng hình vẽ, không ảnh hưởng
        // tiến trình thật của cuộc đua nên không phá vỡ tính đơn điệu).
        const hopAmp = racers.map(() => randRange(0.018, 0.036));
        const hopSpeed = racers.map((_, i) => randRange(3.0, 4.6) * energyFactor[i]);
        const hopPhase = racers.map(() => randRange(0, Math.PI * 2));
        const prevHopVal = racers.map(() => 0); // để phát hiện thời điểm vừa "tiếp đất" sau cú nhảy

        // Mèo sẽ thắng luôn là mèo có pace cao nhất — biết trước để tạo kịch bản
        // "đang dẫn đầu rồi tụt lại, sau đó bứt tốc" ở đoạn cuối trận.
        let dramaticWinnerIdx = 0;
        for (let i = 1; i < n; i++) if (pace[i] > pace[dramaticWinnerIdx]) dramaticWinnerIdx = i;

        // Đường cong thời gian dùng chung cho mọi mèo (trừ pha đặc biệt của mèo thắng):
        // lồi dần (mũ > 1) khiến khoảng cách giữa nhóm dẫn đầu và nhóm bám đuổi giãn nhanh
        // hơn về cuối trận, nhưng vẫn đảm bảo mỗi mèo luôn tiến lên (không bao giờ tụt xuống).
        const SPREAD_GAMMA = 1.6;
        function timeShape(f) { return Math.pow(f, SPREAD_GAMMA); }

        // Mốc thời gian (f = 0..1) cho pha "tụt lại" rồi "bứt tốc" của mèo thắng cuộc
        const DIP_START = randRange(0.62, 0.72);
        const SPRINT_START = randRange(DIP_START + 0.14, Math.min(DIP_START + 0.22, 0.94));
        const SLOW_GAIN = randRange(0.02, 0.04);
        const DIP_DEPTH = randRange(0.05, 0.09);
        const PROGRESS_AT_DIP = timeShape(DIP_START);
        const PROGRESS_AT_SPRINT = PROGRESS_AT_DIP + SLOW_GAIN;

        // Chỉ hiện vạch đích + cuộn len khi còn 5 giây cuối — tăng kịch tính
        const FINISH_REVEAL_MS = 5000;

        const wobbleAmp = racers.map(() => randRange(0.012, 0.03));
        const wobbleSpeed = racers.map(() => randRange(1.0, 2.4));
        const wobblePhase = racers.map(() => randRange(0, Math.PI * 2));

        let winnerIndex = -1;
        let finished = false;
        let startTs = null;
        let lastTs = null;
        let burstDone = false;
        let finishedAt = 0;

        // --- Hạt hiệu ứng dùng chung cho cả "bụi bám leo" lẫn "pháo hoa mừng thắng" ---
        let particles = [];
        function spawnDust(x, y) {
            // Bụi vỏ cây nhẹ mỗi khi 1 mèo top-đầu vừa tiếp đất sau cú nhảy — cho cảm giác có lực thật
            for (let k = 0; k < 3; k++) {
                const ang = randRange(Math.PI * 0.85, Math.PI * 1.55);
                const speed = randRange(18, 55);
                particles.push({
                    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
                    life: 0, maxLife: randRange(220, 380), size: randRange(1.5, 3),
                    color: '196,150,110'
                });
            }
        }
        function spawnBurst(x, y) {
            // Pháo hoa lấp lánh khi mèo thắng chạm tới cuộn len
            for (let i = 0; i < 22; i++) {
                const ang = randRange(0, Math.PI * 2);
                const speed = randRange(50, 150);
                particles.push({
                    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
                    life: 0, maxLife: randRange(400, 700), size: randRange(2, 4),
                    color: Math.random() < 0.5 ? '255,201,60' : '139,92,246'
                });
            }
        }
        function updateParticles(dt) {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.life += dt * 1000;
                if (p.life >= p.maxLife) particles.splice(i, 1);
            }
        }
        function drawParticles() {
            for (const p of particles) {
                const ratio = clamp(1 - p.life / p.maxLife, 0, 1);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color},${ratio * 0.9})`;
                ctx.fill();
            }
        }

        function drawScene(t, showFinish) {
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(139,92,246,0.16)');
            grad.addColorStop(1, 'rgba(11,7,19,0.04)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // thân cây
            const trunkGrad = ctx.createLinearGradient(trunkCenterX - trunkWidth / 2, 0, trunkCenterX + trunkWidth / 2, 0);
            trunkGrad.addColorStop(0, 'rgba(110,66,46,0.92)');
            trunkGrad.addColorStop(0.5, 'rgba(148,96,64,0.96)');
            trunkGrad.addColorStop(1, 'rgba(96,58,38,0.92)');
            ctx.fillStyle = trunkGrad;
            ctx.fillRect(trunkCenterX - trunkWidth / 2, 0, trunkWidth, H);

            // vân gỗ ngang nhẹ
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            for (let y = 10; y < H; y += 22) {
                ctx.beginPath();
                ctx.moveTo(trunkCenterX - trunkWidth / 2 + 2, y);
                ctx.lineTo(trunkCenterX + trunkWidth / 2 - 2, y + 4);
                ctx.stroke();
            }

            // cành cây trang trí
            ctx.strokeStyle = 'rgba(110,66,46,0.85)';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            BRANCHES.forEach(br => {
                ctx.beginPath();
                ctx.moveTo(trunkCenterX, br.y);
                ctx.lineTo(trunkCenterX + br.side * br.len, br.y - br.len * 0.22);
                ctx.stroke();
            });
            ctx.lineCap = 'butt';

            if (showFinish) {
                ctx.strokeStyle = 'rgba(255,201,60,0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(0, FINISH_Y);
                ctx.lineTo(W, FINISH_Y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧶', trunkCenterX, FINISH_Y - 12);
                ctx.textAlign = 'left';
            }
        }

        function computeProgress(i, f, t) {
            if (finished) return i === winnerIndex ? 1 : clamp(timeShape(1) * (pace[i] / maxPace), 0, 1);

            if (i === dramaticWinnerIdx) {
                if (f <= DIP_START) {
                    const shaped = timeShape(f);
                    const envelope = 4 * f * (1 - f);
                    const fade = clamp((DIP_START - f) / 0.08, 0, 1);
                    const wobble = wobbleAmp[i] * Math.sin(t * wobbleSpeed[i] + wobblePhase[i]) * envelope * fade;
                    return clamp(shaped + wobble, 0, 0.999);
                } else if (f <= SPRINT_START) {
                    const p = (f - DIP_START) / (SPRINT_START - DIP_START);
                    const dipBump = DIP_DEPTH * 4 * p * (1 - p);
                    return clamp(PROGRESS_AT_DIP + p * SLOW_GAIN - dipBump, 0, 0.999);
                } else {
                    const p = (f - SPRINT_START) / (1 - SPRINT_START);
                    const eased = p * p * p;
                    return PROGRESS_AT_SPRINT + eased * (1 - PROGRESS_AT_SPRINT);
                }
            }

            const relPace = pace[i] / maxPace;
            const envelope = 4 * f * (1 - f);
            const wobble = wobbleAmp[i] * Math.sin(t * wobbleSpeed[i] + wobblePhase[i]) * envelope;
            return clamp(timeShape(f) * relPace + wobble, 0, 0.999);
        }

        // 10 tông màu mèo trộn ngẫu nhiên (xoay hue của emoji gốc bằng canvas filter)
        const CAT_HUES = [0, 35, 70, 105, 140, 175, 210, 250, 290, 325];
        const catHue = racers.map(() => CAT_HUES[Math.floor(Math.random() * CAT_HUES.length)]);
        const hueGroups = {};
        CAT_HUES.forEach(h => hueGroups[h] = []);
        racers.forEach((_, i) => hueGroups[catHue[i]].push(i));

        function posOf(i, f, t) {
            const progress = computeProgress(i, f, t);
            const hopVal = Math.abs(Math.sin(t * hopSpeed[i] + hopPhase[i]));
            const hop = hopVal * hopAmp[i] * (START_Y - FINISH_Y);
            const y = START_Y - progress * (START_Y - FINISH_Y) - hop;
            const sway = Math.sin(t * xSpeed[i] + xPhase[i]) * xAmp[i];
            const x = clamp(trunkCenterX + sway, trunkWidth * 0.7, W - trunkWidth * 0.7);
            return { x, y, hopVal };
        }

        function draw(t, elapsed) {
            ctx.clearRect(0, 0, W, H);
            const showFinish = finished || (durationMs - elapsed) <= FINISH_REVEAL_MS;
            drawScene(t, showFinish);

            const f = clamp(elapsed / durationMs, 0, 1);
            const xs = new Array(n), ys = new Array(n);

            ctx.font = `${emojiSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            CAT_HUES.forEach(hue => {
                ctx.filter = `hue-rotate(${hue}deg) saturate(1.3)`;
                hueGroups[hue].forEach(i => {
                    const pos = posOf(i, f, t);
                    xs[i] = pos.x; ys[i] = pos.y;

                    // Bụi vỏ cây khi 1 mèo top-đầu vừa "tiếp đất" sau cú nhảy (chỉ nhóm dẫn đầu,
                    // để không bắn quá nhiều hạt cùng lúc khi danh sách rất đông)
                    if (leaderSet.has(i) && prevHopVal[i] > 0.75 && pos.hopVal <= 0.75) {
                        spawnDust(pos.x, pos.y + emojiSize * 0.35);
                    }
                    prevHopVal[i] = pos.hopVal;

                    // Hướng đang di chuyển ngang (phải/trái) — dùng để LẬT MẶT mèo cho đúng hướng
                    // đang bò tới, thay vì đứng yên 1 chiều trông cứng nhắc.
                    const dir = Math.cos(t * xSpeed[i] + xPhase[i]) >= 0 ? 1 : -1;
                    // Nghiêng nhẹ theo nhịp nhảy (KHÔNG lộn ngược — chỉ vài độ) để trông như đang
                    // chật vật bấu leo, cộng thêm hiệu ứng "squash & stretch" kiểu hoạt hình.
                    const tilt = dir * 0.16 * pos.hopVal;
                    const stretch = 1 + 0.14 * pos.hopVal;
                    const squash = 1 - 0.10 * pos.hopVal;

                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.rotate(tilt);
                    ctx.scale(-dir * squash, stretch); // lật theo hướng di chuyển, không xoay 90° nên hết lộn ngược
                    ctx.fillText('🐈', 0, 0);
                    ctx.restore();
                });
            });
            ctx.filter = 'none';

            // Tên hiển thị dưới mỗi mèo — luôn hiện cho mọi mèo, bất kể số lượng
            ctx.font = `600 ${nameSize}px "Plus Jakarta Sans", sans-serif`;
            ctx.textAlign = 'center';
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = (finished && i === winnerIndex) ? '#FFC93C' : 'rgba(246,243,255,0.85)';
                const label = racers[i].username.length > 14 ? racers[i].username.slice(0, 14) + '…' : racers[i].username;
                ctx.fillText(label, xs[i], ys[i] + emojiSize * 0.8);
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            drawParticles();
        }

        function frame(ts) {
            if (startTs === null) { startTs = ts; lastTs = ts; }
            const dt = Math.min((ts - lastTs) / 1000, 0.05);
            lastTs = ts;
            const elapsed = ts - startTs;
            const t = elapsed / 1000;

            const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
            if (timeLeftEl) timeLeftEl.textContent = secondsLeft;

            if (!finished && elapsed >= durationMs) {
                finished = true;
                finishedAt = elapsed;
                winnerIndex = dramaticWinnerIdx;
            }

            updateParticles(dt);
            draw(t, elapsed);

            if (finished && !burstDone) {
                burstDone = true;
                const pos = posOf(winnerIndex, 1, t);
                spawnBurst(pos.x, pos.y);
                setTimeout(() => onFinish(racers[winnerIndex]), 600);
            }

            // Sau khi đã báo kết quả, chỉ tiếp tục vẽ thêm chút để hạt lấp lánh chạy
            // xong rồi dừng hẳn vòng lặp (tránh requestAnimationFrame chạy vô hạn).
            if (finished && (elapsed - finishedAt > 900) && particles.length === 0) {
                return;
            }

            requestAnimationFrame(frame);
        }

        if (n === 1) {
            draw(0, 0);
            setTimeout(() => onFinish(racers[0]), 400);
            return;
        }

        draw(0, 0);
        requestAnimationFrame(frame);
    };
})();