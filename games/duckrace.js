// ===================================================================
// 🦆 Duck Race — mini-game "Vui nhộn" cho Giveaway Live Tool
// Tải riêng khi người dùng chọn mode Duck Race (không nằm trong bundle chính).
//
// API: window.runDuckRace(users, containerEl, durationSec, onFinish)
//   users       : mảng { username, message, time, badge }
//   containerEl : phần tử DOM để vẽ canvas game vào
//   durationSec : trận đua kéo dài đúng số giây này — vịt di chuyển liên tục
//                 suốt thời gian này, chỉ thực sự chạm đích đúng lúc hết giờ
//   onFinish    : callback(winnerUser) khi có kết quả
// ===================================================================
(function () {
    const ASPECT_RATIO = 640 / 760; // gấp đôi chiều cao so với bản trước (320/760) để chữ/hình to rõ hơn
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

    // --- Assets mascot (vẽ bởi Claude Design) — preload 1 lần, dùng chung cho mọi ván đua ---
    function svgToImage(svgString) {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        return img;
    }

    // Vịt đã quay đầu (mỏ) sẵn sang phải — đúng hướng bơi về đích, không cần lật ngang nữa.
    // fill="currentColor" ăn theo style="color:..." nên chỉ cần đổi màu là ra 1 màu vịt mới,
    // viền/mỏ/mắt luôn giữ nguyên tông tối để nét không bị mất dù đổi màu thân.
    function duckSvgString(color) {
        return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="color:${color}">
  <g opacity="0.5" stroke="#8AD8FF" stroke-width="1.6" fill="none" stroke-linecap="round">
    <path d="M6 52 Q12 55 18 52 Q24 49 30 52"/>
    <path d="M14 57 Q20 60 26 57 Q32 54 38 57"/>
  </g>
  <path d="M14 34 C8 30 6 36 9 40 C12 43 17 41 18 37 Z" fill="currentColor" stroke="#150C22" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="36" cy="33" rx="9" ry="9" fill="currentColor"/>
  <ellipse cx="27" cy="38" rx="17" ry="13" fill="currentColor" stroke="#150C22" stroke-width="2"/>
  <path d="M20 34 Q28 32 30 40 Q24 44 18 40 Q17 36 20 34 Z" fill="#000000" opacity="0.15"/>
  <circle cx="45" cy="25" r="10" fill="currentColor" stroke="#150C22" stroke-width="2"/>
  <path d="M53 22 L62 25 L53 29 Z" fill="#FF9A3D" stroke="#150C22" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="47" cy="21" r="2.6" fill="#150C22"/>
  <circle cx="48" cy="20" r="0.9" fill="#FFFFFF"/>
</svg>`;
    }

    const FLAG_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <line x1="14" y1="8" x2="14" y2="58" stroke="#150C22" stroke-width="3" stroke-linecap="round"/>
  <clipPath id="flagClipDuckRace"><path d="M14 10 L50 10 Q57 16 50 22 L14 22 Z"/></clipPath>
  <path d="M14 10 L50 10 Q57 16 50 22 L14 22 Z" fill="#F5F3EF" stroke="#150C22" stroke-width="2" stroke-linejoin="round"/>
  <g clip-path="url(#flagClipDuckRace)" fill="#150C22">
    <rect x="14" y="10" width="6" height="6"/>
    <rect x="26" y="10" width="6" height="6"/>
    <rect x="38" y="10" width="6" height="6"/>
    <rect x="20" y="16" width="6" height="6"/>
    <rect x="32" y="16" width="6" height="6"/>
    <rect x="44" y="16" width="6" height="6"/>
  </g>
</svg>`;

    const RIPPLE_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke-linecap="round">
    <path d="M8 40 Q20 46 32 40 Q44 34 56 40" stroke="#8AD8FF" stroke-width="3" opacity="0.9"/>
    <path d="M14 48 Q24 53 34 48 Q44 43 54 48" stroke="#8AD8FF" stroke-width="3" opacity="0.55"/>
    <path d="M20 56 Q28 60 36 56 Q44 52 52 56" stroke="#8AD8FF" stroke-width="3" opacity="0.3"/>
  </g>
</svg>`;

    // 10 màu thân vịt — mỗi vịt trong ván đua sẽ được gán ngẫu nhiên 1 trong 10 ảnh này
    const DUCK_COLORS = ['#22D3EE', '#EC4899', '#8B5CF6', '#FFC93C', '#34D399', '#FB923C', '#60A5FA', '#F43F5E', '#A3E635', '#E879F9'];
    const duckImages = DUCK_COLORS.map(c => svgToImage(duckSvgString(c)));
    const flagImg = svgToImage(FLAG_SVG);
    const rippleImg = svgToImage(RIPPLE_SVG);

    window.runDuckRace = function (users, containerEl, durationSec, onFinish) {
        const duration = (typeof durationSec === 'number' && durationSec > 0) ? durationSec : 15;

        let racers = users.slice();
        let sampled = false;
        if (racers.length > MAX_RACERS) {
            racers = shuffle(racers).slice(0, MAX_RACERS);
            sampled = true;
        }
        racers = shuffle(racers);

        const n = racers.length;
        const emojiSize = n <= 15 ? 28 : n <= 35 ? 22 : n <= 65 ? 18 : 14;
        const nameSize = n <= 15 ? 13 : n <= 35 ? 11.5 : n <= 65 ? 10 : 8.5;
        containerEl.innerHTML = `
            <h3 style="margin:0 0 6px;font-family:'Baloo 2', sans-serif;font-size:16px;color:var(--cyan);">🦆 Duck Race — về đích sau <span id="duckTimeLeft">${duration}</span>s...</h3>
            ${sampled ? `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">Danh sách có ${users.length} người, đã chọn ngẫu nhiên ${MAX_RACERS} vịt để đua.</div>` : ''}
            <canvas id="duckCanvas" style="width:100%; display:block; border-radius:16px; border:1px solid var(--border);"></canvas>
        `;

        const canvas = containerEl.querySelector('#duckCanvas');
        const ctx = canvas.getContext('2d');
        const timeLeftEl = containerEl.querySelector('#duckTimeLeft');

        // --- Canvas theo đúng mật độ điểm ảnh màn hình để hết mờ/nhòe ---
        const dpr = window.devicePixelRatio || 1;
        const W = Math.max(320, containerEl.clientWidth || 760);
        const H = Math.round(W * ASPECT_RATIO);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const START_X = Math.round(W * 0.06);
        const FINISH_X = W - Math.round(W * 0.07);
        const TOP_MARGIN = Math.round(H * 0.08);
        const BOTTOM_MARGIN = Math.round(H * 0.06);

        // Vị trí Y cố định ngẫu nhiên cho mỗi vịt trong hồ (không chia làn, đè nhau OK)
        const yBase = racers.map(() => randRange(TOP_MARGIN, H - BOTTOM_MARGIN));
        const bobPhase = racers.map(() => randRange(0, Math.PI * 2));
        const bobSpeed = racers.map(() => randRange(2.2, 3.4));

        // Chia đàn vịt thành 2 nhóm để tạo khoảng cách RÕ RỆT dần về cuối trận:
        // ~20% "nhóm dẫn đầu" (pace cao) và phần còn lại "nhóm bám đuổi" (pace thấp hơn hẳn).
        // Vịt sẽ thắng luôn nằm trong nhóm dẫn đầu (vì có pace cao nhất trong nhóm này).
        const leaderCount = Math.max(1, Math.round(n * 0.2));
        const leaderSet = new Set(shuffle(racers.map((_, i) => i)).slice(0, leaderCount));
        const pace = racers.map((_, i) => leaderSet.has(i) ? randRange(0.8, 1) : randRange(0.35, 0.68));
        const maxPace = Math.max.apply(null, pace);

        // Vịt sẽ thắng luôn là vịt có pace cao nhất (chắc chắn thuộc nhóm dẫn đầu) — biết
        // trước để tạo kịch bản "đang dẫn đầu rồi tụt lại, sau đó bứt tốc" ở đoạn cuối.
        let dramaticWinnerIdx = 0;
        for (let i = 1; i < n; i++) if (pace[i] > pace[dramaticWinnerIdx]) dramaticWinnerIdx = i;

        // Đường cong thời gian DÙNG CHUNG cho mọi vịt (trừ pha đặc biệt của vịt thắng): lồi dần
        // (mũ > 1) khiến khoảng cách giữa nhóm dẫn đầu và nhóm bám đuổi GIÃN NHANH hơn về cuối
        // trận, nhưng vẫn đảm bảo TOÁN HỌC mỗi vịt luôn tiến về phía trước (không bao giờ tụt lùi).
        const SPREAD_GAMMA = 1.6;
        function timeShape(f) { return Math.pow(f, SPREAD_GAMMA); }

        // Mốc thời gian (theo tỉ lệ f = 0..1) cho pha "tụt lại" rồi "bứt tốc" của vịt thắng cuộc
        const DIP_START = randRange(0.62, 0.72);
        const SPRINT_START = randRange(DIP_START + 0.14, Math.min(DIP_START + 0.22, 0.94));
        const SLOW_GAIN = randRange(0.02, 0.04);
        const DIP_DEPTH = randRange(0.05, 0.09); // tụt lại rõ rệt (tiến trình thực sự giảm) rồi mới hồi lại
        const PROGRESS_AT_DIP = timeShape(DIP_START);         // khớp với đường cong chung ở pha 1
        const PROGRESS_AT_SPRINT = PROGRESS_AT_DIP + SLOW_GAIN;

        // Chỉ hiện vạch đích khi còn 5 giây cuối — tăng kịch tính, không biết đích ở đâu cho tới phút chót
        const FINISH_REVEAL_MS = 5000;

        // Dao động nhẹ quanh vị trí "đúng nhịp" để tạo cảm giác rượt đuổi giữa chừng,
        // biên độ tự triệt tiêu về 0 ở cả điểm xuất phát lẫn lúc về đích (envelope).
        const wobbleAmp = racers.map(() => randRange(0.012, 0.03));
        const wobbleSpeed = racers.map(() => randRange(1.0, 2.4));
        const wobblePhase = racers.map(() => randRange(0, Math.PI * 2));

        let winnerIndex = -1;
        let finished = false;
        let startTs = null;
        const durationMs = duration * 1000;

        function drawWater(t, showFinish) {
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(34,242,200,0.10)');
            grad.addColorStop(1, 'rgba(91,60,180,0.16)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Sóng nước dùng icon ripple đã vẽ sẵn, lát ngang theo từng dải và cuộn nhẹ theo thời gian
            if (rippleImg && rippleImg.complete && rippleImg.naturalWidth > 0) {
                const tileW = 90, tileH = 30;
                const bands = 4;
                for (let b = 0; b < bands; b++) {
                    const baseY = (b + 0.5) * (H / bands) - tileH / 2;
                    const speed = 16 + (b % 2) * 10;
                    ctx.globalAlpha = 0.45 - b * 0.07;
                    const scroll = ((t * speed) % tileW + tileW) % tileW;
                    for (let x = -tileW + scroll; x < W + tileW; x += tileW) {
                        ctx.drawImage(rippleImg, x, baseY, tileW, tileH);
                    }
                }
                ctx.globalAlpha = 1;
            }

            if (showFinish) {
                ctx.strokeStyle = 'rgba(255,201,60,0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(FINISH_X, 0);
                ctx.lineTo(FINISH_X, H);
                ctx.stroke();
                ctx.setLineDash([]);
                if (flagImg && flagImg.complete && flagImg.naturalWidth > 0) {
                    ctx.drawImage(flagImg, FINISH_X - 6, 2, 30, 30);
                }
            }
        }

        function computeProgress(i, f, t) {
            if (finished) return i === winnerIndex ? 1 : clamp(timeShape(1) * (pace[i] / maxPace), 0, 1);

            if (i === dramaticWinnerIdx) {
                if (f <= DIP_START) {
                    const shaped = timeShape(f);
                    const envelope = 4 * f * (1 - f);
                    const fade = clamp((DIP_START - f) / 0.08, 0, 1); // tắt dao động mượt trước khi vào pha "tụt lại"
                    const wobble = wobbleAmp[i] * Math.sin(t * wobbleSpeed[i] + wobblePhase[i]) * envelope * fade;
                    return clamp(shaped + wobble, 0, 0.999);
                } else if (f <= SPRINT_START) {
                    // Tụt lại rõ rệt: tiến trình thực sự giảm xuống (như đang hụt hơi/bị cuốn ngược dòng)
                    // rồi mới hồi phục nhẹ về đúng mốc trước khi bứt tốc.
                    const p = (f - DIP_START) / (SPRINT_START - DIP_START);
                    const dipBump = DIP_DEPTH * 4 * p * (1 - p); // 0 ở p=0 và p=1, âm giữa chừng
                    return clamp(PROGRESS_AT_DIP + p * SLOW_GAIN - dipBump, 0, 0.999);
                } else {
                    // Bứt tốc về đích đúng lúc hết giờ
                    const p = (f - SPRINT_START) / (1 - SPRINT_START);
                    const eased = p * p * p;
                    return PROGRESS_AT_SPRINT + eased * (1 - PROGRESS_AT_SPRINT);
                }
            }

            // Nhóm còn lại: dùng chung đường cong lồi timeShape(f) nhân với pace tương đối —
            // vì timeShape đơn điệu tăng và pace/maxPace là hằng số dương, MỖI vịt luôn tiến
            // về phía trước (không thể tụt lùi), nhưng khoảng cách tuyệt đối giữa các vịt vẫn
            // giãn nhanh dần về cuối trận vì timeShape lồi (tăng nhanh hơn khi f lớn).
            const relPace = pace[i] / maxPace;
            const envelope = 4 * f * (1 - f); // 0 tại f=0 và f=1, đỉnh ở giữa
            const wobble = wobbleAmp[i] * Math.sin(t * wobbleSpeed[i] + wobblePhase[i]) * envelope;
            return clamp(timeShape(f) * relPace + wobble, 0, 0.999);
        }

        // Mỗi vịt được gán ngẫu nhiên 1 trong 10 màu mascot đã vẽ sẵn (preload ở đầu file)
        const duckColorIdx = racers.map(() => Math.floor(Math.random() * DUCK_COLORS.length));

        function draw(t, elapsed) {
            ctx.clearRect(0, 0, W, H);
            ctx.filter = 'none';
            const showFinish = finished || (durationMs - elapsed) <= FINISH_REVEAL_MS;
            drawWater(t, showFinish);

            const f = clamp(elapsed / durationMs, 0, 1);
            const xs = new Array(n), ys = new Array(n);
            for (let i = 0; i < n; i++) {
                const progress = computeProgress(i, f, t);
                xs[i] = START_X + progress * (FINISH_X - START_X - 16);
                ys[i] = yBase[i] + Math.sin(t * bobSpeed[i] + bobPhase[i]) * 4;
            }

            // Vẽ vịt bằng icon mascot đã preload — vịt đã vẽ quay đầu sẵn sang phải nên
            // không cần lật ngang (ctx.scale(-1,1)) như hồi dùng emoji nữa.
            const duckDrawSize = emojiSize * 1.55;
            for (let i = 0; i < n; i++) {
                const img = duckImages[duckColorIdx[i]];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, xs[i] - duckDrawSize / 2, ys[i] - duckDrawSize / 2, duckDrawSize, duckDrawSize);
                }
            }

            // Tên hiển thị phía sau đuôi vịt (bên trái, ngược hướng bơi) — luôn hiện cho mọi vịt, bất kể số lượng
            ctx.font = `600 ${nameSize}px "Plus Jakarta Sans", sans-serif`;
            ctx.textAlign = 'right';
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = (finished && i === winnerIndex) ? '#FFC93C' : 'rgba(246,243,255,0.8)';
                const label = racers[i].username.length > 14 ? racers[i].username.slice(0, 14) + '…' : racers[i].username;
                ctx.fillText(label, Math.max(xs[i] - emojiSize * 0.6, 60), ys[i]);
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }

        function frame(ts) {
            if (startTs === null) startTs = ts;
            const elapsed = ts - startTs;
            const t = elapsed / 1000;

            const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
            if (timeLeftEl) timeLeftEl.textContent = secondsLeft;

            if (!finished && elapsed >= durationMs) {
                finished = true;
                // Vịt có pace cao nhất luôn là người về đích (đã xác định sẵn từ đầu)
                winnerIndex = dramaticWinnerIdx;
                draw(t, elapsed);
                setTimeout(() => onFinish(racers[winnerIndex]), 600);
                return;
            }

            draw(t, elapsed);
            requestAnimationFrame(frame);
        }

        draw(0, 0);
        requestAnimationFrame(frame);
    };
})();