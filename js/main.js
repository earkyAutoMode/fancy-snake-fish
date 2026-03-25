/* 炫酷贪吃鱼 核心逻辑 (Neon Fish) */

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
    turnSpeed: 0.08, // 转向灵敏度
    particleCount: 15, // 吃到食物时的特效粒子数
    maxSegmentLength: 12, // 鱼节之间的距离
    initialSegments: 15,
    colors: {
        fishHead: '#00f2ff',
        fishBody: 'rgba(0, 242, 255, 0.4)',
        food: '#ffeb3b',
        particle: '#00f2ff'
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
    velocity: { x: 0, y: 0 }
};

let food = { x: 0, y: 0, size: config.foodBaseSize, pulse: 0 };
let particles = [];
let targetAngle = -Math.PI / 2;
let keys = {};

// 初始化/重置游戏
function initGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    score = 0;
    scoreEl.textContent = score;
    
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
    
    spawnFood();
    particles = [];
}

function spawnFood() {
    food.x = Math.random() * (canvas.width - 40) + 20;
    food.y = Math.random() * (canvas.height - 40) + 20;
}

// 事件监听
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// 鼠标/触摸控制：计算目标角度
const handlePointer = (e) => {
    if (gameState !== 'PLAYING') return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const head = fish.segments[0];
    const dx = clientX - head.x;
    const dy = clientY - head.y;
    targetAngle = Math.atan2(dy, dx);
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

// 核心循环
function update() {
    if (gameState === 'PLAYING') {
        // 键盘控制逻辑
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) targetAngle -= 0.1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) targetAngle += 0.1;

        // 鱼头角度插值（平滑转向）
        let angleDiff = targetAngle - fish.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        fish.angle += angleDiff * config.turnSpeed;

        // 鱼头移动
        const head = { ...fish.segments[0] };
        head.x += Math.cos(fish.angle) * config.speed;
        head.y += Math.sin(fish.angle) * config.speed;

        // 边界检测
        if (head.x < 0 || head.x > canvas.width || head.y < 0 || head.y > canvas.height) {
            endGame();
            return;
        }

        // 自撞检测（从第10节之后开始检测，防止碰撞头部附近的身体）
        for (let i = 10; i < fish.segments.length; i++) {
            const dist = Math.hypot(head.x - fish.segments[i].x, head.y - fish.segments[i].y);
            if (dist < fish.size) {
                endGame();
                return;
            }
        }

        // 更新身体节（跟随逻辑）
        fish.segments.unshift(head);
        
        // 吃到食物
        const distToFood = Math.hypot(head.x - food.x, head.y - food.y);
        if (distToFood < fish.size + food.size) {
            score++;
            scoreEl.textContent = score;
            fish.size += config.fishGrowFactor;
            
            // 爆开粒子特效
            for (let i = 0; i < config.particleCount; i++) {
                particles.push(new Particle(food.x, food.y, config.colors.fishHead));
            }
            
            spawnFood();
            // 增加一节长度
            fish.segments.push({...fish.segments[fish.segments.length - 1]});
        }

        // 限制长度渲染（如果只是普通蛇可以 pop，但为了让鱼看起来连贯且动态，根据距离判断）
        while (fish.segments.length > (score + config.initialSegments) * 2) {
            fish.segments.pop();
        }
    }

    // 更新粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    food.pulse += 0.05;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景装饰 - 弱发光网格或粒子
    drawBackground();

    // 绘制粒子
    particles.forEach(p => p.draw());

    // 绘制食物
    const pulseScale = 1 + Math.sin(food.pulse) * 0.2;
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = config.colors.food;
    ctx.fillStyle = config.colors.food;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.size * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 绘制鱼（身体）
    if (fish.segments.length > 0) {
        // 先画身体，从尾部开始，带透明度
        for (let i = fish.segments.length - 1; i > 0; i -= 2) {
            const seg = fish.segments[i];
            const nextSeg = fish.segments[i - 2] || fish.segments[0];
            const factor = 1 - (i / fish.segments.length); // 越靠近头部越粗
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

        // 绘制发光的头部
        const head = fish.segments[0];
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(fish.angle);
        
        // 头部发光
        ctx.shadowBlur = 20;
        ctx.shadowColor = config.colors.fishHead;
        ctx.fillStyle = config.colors.fishHead;
        
        // 绘制鱼头形状 (三角形/水滴形)
        ctx.beginPath();
        ctx.moveTo(fish.size * 1.5, 0);
        ctx.lineTo(-fish.size, -fish.size);
        ctx.lineTo(-fish.size, fish.size);
        ctx.closePath();
        ctx.fill();

        // 眼睛
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(fish.size * 0.5, -fish.size * 0.4, 2, 0, Math.PI * 2);
        ctx.arc(fish.size * 0.5, fish.size * 0.4, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

function drawBackground() {
    // 绘制一些微弱的漂浮粒子或网格
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
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
    setTimeout(() => {
        gameOverScreen.style.opacity = '1';
    }, 10);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
