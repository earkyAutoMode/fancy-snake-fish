/* 炫酷贪吃鱼 核心逻辑 (Neon Fish) - 难度升级版 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');

// 游戏配置
const config = {
    fishBaseSize: 10, // 基础鱼头大小
    fishGrowFactor: 0.15, // 每吃到食物的增长系数
    foodBaseSize: 6,
    speed: 3.5,
    speedIncrement: 0.08, // 每分增加的速度
    turnSpeed: 0.08, // 转向灵敏度
    particleCount: 15, // 吃到食物时的特效粒子数
    maxSegmentLength: 12, // 鱼节之间的距离
    initialSegments: 15,
    minSegments: 6, // 生存压力下的最小节数
    energyDecay: 0.005, // 能量衰减速率（每帧）
    obstacleCount: 6,
    obstacleBaseSize: 12,
    colors: {
        fishHead: '#00f2ff',
        fishBody: 'rgba(0, 242, 255, 0.4)',
        food: '#ffeb3b',
        particle: '#00f2ff',
        obstacle: '#ff3d00'
    }
};

let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
bestScoreEl.textContent = bestScore;

let fish = {
    segments: [], // 坐标数组 [{x, y}]
    angle: -Math.PI / 2,
    size: config.fishBaseSize,
    energy: 1, // 0 到 1 之间
    lengthModifier: 0 // 用于平滑处理长度缩减
};

let food = { x: 0, y: 0, size: config.foodBaseSize, pulse: 0 };
let obstacles = [];
let particles = [];
let targetAngle = -Math.PI / 2;
let keys = {};
let currentSpeed = config.speed;

// 动态障碍物类
class Obstacle {
    constructor() {
        this.size = config.obstacleBaseSize + Math.random() * 10;
        this.reset();
    }
    reset() {
        // 随机在屏幕边缘生成，然后向内移动
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { this.x = -this.size; this.y = Math.random() * canvas.height; }
        else if (side === 1) { this.x = canvas.width + this.size; this.y = Math.random() * canvas.height; }
        else if (side === 2) { this.x = Math.random() * canvas.width; this.y = -this.size; }
        else { this.x = Math.random() * canvas.width; this.y = canvas.height + this.size; }
        
        const angle = Math.atan2(canvas.height/2 - this.y, canvas.width/2 - this.x) + (Math.random() - 0.5);
        const speed = 1 + Math.random() * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        // 越界重置
        if (this.x < -this.size * 2 || this.x > canvas.width + this.size * 2 || 
            this.y < -this.size * 2 || this.y > canvas.height + this.size * 2) {
            this.reset();
        }
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = config.colors.obstacle;
        ctx.fillStyle = config.colors.obstacle;
        ctx.beginPath();
        // 绘制一个带刺的圆形（模拟危险生物）
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const r = i % 2 === 0 ? this.size : this.size * 1.5;
            const px = this.x + Math.cos(ang) * r;
            const py = this.y + Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// 特效粒子类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 5 + 2;
        this.life = 1; // 寿命百分比
        this.decay = Math.random() * 0.02 + 0.015;
    }
    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 初始化/重置游戏
function initGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    score = 0;
    scoreEl.textContent = score;
    currentSpeed = config.speed;
    
    // 初始化鱼的位置和长度
    fish.segments = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    for (let i = 0; i < config.initialSegments; i++) {
        fish.segments.push({ x: centerX, y: centerY + i * config.maxSegmentLength });
    }
    fish.angle = -Math.PI / 2;
    targetAngle = -Math.PI / 2;
    fish.size = config.fishBaseSize;
    fish.energy = 1.0;
    
    // 初始化障碍物
    obstacles = [];
    for (let i = 0; i < config.obstacleCount; i++) {
        obstacles.push(new Obstacle());
    }
    
    spawnFood();
    particles = [];
}

function spawnFood() {
    food.x = Math.random() * (canvas.width - 60) + 30;
    food.y = Math.random() * (canvas.height - 60) + 30;
    // 确保食物不直接刷新在障碍物上
    for (let obs of obstacles) {
        if (Math.hypot(food.x - obs.x, food.y - obs.y) < obs.size + 20) {
            spawnFood();
            break;
        }
    }
}

// 事件监听
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

const handlePointer = (e) => {
    if (gameState !== 'PLAYING') return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const head = fish.segments[0];
    targetAngle = Math.atan2(clientY - head.y, clientX - head.x);
};

window.addEventListener('mousemove', handlePointer);
window.addEventListener('touchstart', handlePointer, { passive: false });
window.addEventListener('touchmove', handlePointer, { passive: false });

startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    gameState = 'PLAYING';
    initGame();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    gameOverScreen.style.opacity = '0';
    gameState = 'PLAYING';
    initGame();
});

// 核心循环
function update() {
    if (gameState === 'PLAYING') {
        // 动态加速机制
        currentSpeed = config.speed + (score * config.speedIncrement);
        
        // 键盘控制
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) targetAngle -= 0.12;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) targetAngle += 0.12;

        // 平滑转向
        let angleDiff = targetAngle - fish.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        fish.angle += angleDiff * config.turnSpeed;

        // 鱼头移动
        const head = { ...fish.segments[0] };
        head.x += Math.cos(fish.angle) * currentSpeed;
        head.y += Math.sin(fish.angle) * currentSpeed;

        // 边界检测
        if (head.x < 0 || head.x > canvas.width || head.y < 0 || head.y > canvas.height) {
            endGame(); return;
        }

        // 障碍物更新与碰撞检测
        for (let obs of obstacles) {
            obs.update();
            const dist = Math.hypot(head.x - obs.x, head.y - obs.y);
            if (dist < fish.size + obs.size * 0.8) {
                endGame(); return;
            }
        }

        // 自撞检测
        for (let i = 12; i < fish.segments.length; i++) {
            const dist = Math.hypot(head.x - fish.segments[i].x, head.y - fish.segments[i].y);
            if (dist < fish.size * 0.8) {
                endGame(); return;
            }
        }

        // 生存压力：能量衰减
        fish.energy -= config.energyDecay;
        if (fish.energy < 0) fish.energy = 0;
        
        // 更新身体
        fish.segments.unshift(head);
        
        // 吃到食物
        const distToFood = Math.hypot(head.x - food.x, head.y - food.y);
        if (distToFood < fish.size + food.size + 5) {
            score++;
            scoreEl.textContent = score;
            fish.size += config.fishGrowFactor;
            fish.energy = Math.min(1.0, fish.energy + 0.4); // 进食恢复能量
            
            for (let i = 0; i < config.particleCount; i++) {
                particles.push(new Particle(food.x, food.y, config.colors.fishHead));
            }
            spawnFood();
            fish.segments.push({...fish.segments[fish.segments.length - 1]});
        }

        // 根据能量和得分计算目标长度
        // 能量越低，长度缩减越多（最多缩减一半，但不低于最小值）
        let targetLenCount = (score + config.initialSegments) * 2;
        if (fish.energy < 0.5) {
            const reductionFactor = (0.5 - fish.energy) * 2; // 0 到 1
            const minPossibleLen = config.minSegments * 2;
            targetLenCount = targetLenCount - (targetLenCount - minPossibleLen) * 0.7 * reductionFactor;
        }

        while (fish.segments.length > targetLenCount) {
            fish.segments.pop();
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    food.pulse += 0.05;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    // 绘制障碍物
    obstacles.forEach(obs => obs.draw());
    
    // 绘制能量槽（UI反馈）
    if (gameState === 'PLAYING') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(canvas.width/2 - 50, 60, 100, 6);
        ctx.fillStyle = fish.energy > 0.3 ? config.colors.fishHead : '#ff3d00';
        ctx.fillRect(canvas.width/2 - 50, 60, 100 * fish.energy, 6);
        ctx.restore();
    }

    particles.forEach(p => p.draw());

    // 食物
    const pulseScale = 1 + Math.sin(food.pulse) * 0.2;
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = config.colors.food;
    ctx.fillStyle = config.colors.food;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.size * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 鱼身
    if (fish.segments.length > 0) {
        for (let i = fish.segments.length - 1; i > 0; i -= 2) {
            const seg = fish.segments[i];
            const nextSeg = fish.segments[i - 2] || fish.segments[0];
            const factor = 1 - (i / fish.segments.length);
            const currentSize = fish.size * (0.3 + 0.7 * factor);
            
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = config.colors.fishBody;
            ctx.lineWidth = currentSize * 2;
            ctx.lineCap = 'round';
            ctx.moveTo(seg.x, seg.y);
            ctx.lineTo(nextSeg.x, nextSeg.y);
            ctx.stroke();
            ctx.restore();
        }

        // 鱼头
        const head = fish.segments[0];
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(fish.angle);
        ctx.shadowBlur = 20;
        ctx.shadowColor = fish.energy > 0.3 ? config.colors.fishHead : '#ff3d00';
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();
        ctx.moveTo(fish.size * 1.5, 0);
        ctx.lineTo(-fish.size, -fish.size);
        ctx.lineTo(-fish.size, fish.size);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(fish.size * 0.5, -fish.size * 0.4, 2, 0, Math.PI * 2);
        ctx.arc(fish.size * 0.5, fish.size * 0.4, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawBackground() {
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.03)';
    ctx.lineWidth = 1;
    const step = 80;
    for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function endGame() {
    gameState = 'GAMEOVER';
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        bestScoreEl.textContent = bestScore;
    }
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    setTimeout(() => { gameOverScreen.style.opacity = '1'; }, 10);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
