const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const startBtn = document.getElementById('startBtn');
const loading = document.getElementById('loading');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const playAgainBtn = document.getElementById('playAgain');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

// Game state
let score = 0; let lives = 3; let running = false; let lastTime = 0;
let fruits = [];
let spawnTimer = 0; let spawnInterval = 900; // ms
let difficultyTimer = 0;

const basket = {x: canvas.width/2 - 70, y: canvas.height - 80, w:140, h:70, speed:700};

const fruitTypes = [
    {type:'strawberry', file:'Strawberry.png', value:2, frames:2},
    {type:'blueberry', file:'Blueberry.png', value:1, frames:2},
    {type:'carrot', file:'Carrot.png', value:3, frames:2},
    {type:'banana', file:'Banana.png', value:4, frames:2},
    {type:'apple', file:'Apple.png', value:5, frames:2}
];

// preload spritesheet images
const images = {};
for(const f of fruitTypes){
    const img = new Image();
    img.onload = () => {
        // preprocess to remove pure-black background if present
        try{
            const w = img.width, h = img.height;
            const off = document.createElement('canvas');
            off.width = w; off.height = h;
            const octx = off.getContext('2d');
            octx.drawImage(img,0,0);
            const data = octx.getImageData(0,0,w,h);
            const px = data.data;
            let changed = false;
            for(let i=0;i<px.length;i+=4){
                const r = px[i], g = px[i+1], b = px[i+2], a = px[i+3];
                // if pixel is nearly black and not already transparent, make it transparent
                if(a>0 && r<16 && g<16 && b<16){ px[i+3] = 0; changed = true; }
            }
            if(changed){ octx.putImageData(data,0,0); const newImg = new Image(); newImg.src = off.toDataURL(); images[f.type] = newImg; return; }
        }catch(e){ /*fail silently*/ }
        images[f.type] = img;
    };
    img.onerror = ()=>{ images[f.type]=img; };
    img.src = '../Fruits/' + f.file;
}

// preload basket image and remove near-black matte if present
images.basket = new Image();
images.basket.onload = () => {
    try{
        const w = images.basket.width, h = images.basket.height;
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const octx = off.getContext('2d');
        octx.drawImage(images.basket,0,0);
        const data = octx.getImageData(0,0,w,h);
        const px = data.data;
        let changed = false;
        for(let i=0;i<px.length;i+=4){
            const r = px[i], g = px[i+1], b = px[i+2], a = px[i+3];
            if(a>0 && r<16 && g<16 && b<16){ px[i+3] = 0; changed = true; }
        }
        if(changed){ octx.putImageData(data,0,0); const newImg = new Image(); newImg.src = off.toDataURL(); images.basket = newImg; return; }
    }catch(e){ /* ignore */ }
};
images.basket.src = '../Fruits/Basket.png';

function spawnFruit(){
    const t = fruitTypes[Math.floor(Math.random()*fruitTypes.length)];
    const size = 96 + Math.random()*80;
    const x = Math.max(16, Math.random()*(canvas.width - 16 - size));
    // higher value fruits fall faster (scale by value: 1-5 points)
    // base fall speed uses fruit value and a small increase from current score
    const base = (80 + Math.random()*120) * (t.value / 3) + Math.min(0.5 * score, 200);
    // scale with score so fruits get noticeably faster as player scores more
    // multiplier = 1 + score/40, capped to add at most +4 (so multiplier in [1,5])
    const speedMultiplier = 1 + Math.min(score / 40, 4);
    const fallSpeed = base * speedMultiplier;
    fruits.push({x, y: -size, size, fallSpeed, img: images[t.type], value: t.value, frameIndex: 0, frameTimer: 0, frames: t.frames});
}

function resetGame(){
    score = 0;
    lives = 3;
    fruits = [];
    spawnTimer = 0;
    difficultyTimer = 0;
    spawnInterval = 900;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
}

function startGame(){
    resetGame();
    loading.style.display = 'none';
    gameOverEl.style.display = 'none';
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function endGame(){
    running = false;
    finalScoreEl.textContent = 'Your score: ' + score;
    gameOverEl.style.display = 'flex';
}

function update(dt){
    // spawn logic
    spawnTimer += dt;
    difficultyTimer += dt;
    if(difficultyTimer > 8000){ // every 8s increase difficulty
        spawnInterval = Math.max(300, spawnInterval - 80);
        difficultyTimer = 0;
    }
    if(spawnTimer > spawnInterval){ spawnFruit(); spawnTimer = 0; }

    // update fruits
    for(let i=fruits.length-1;i>=0;i--){
        const f = fruits[i];
        f.y += f.fallSpeed * (dt/1000);
        
        // update frame animation
        f.frameTimer += dt;
        if(f.frameTimer > 500){ // switch frame every 500ms
            f.frameIndex = (f.frameIndex + 1) % f.frames;
            f.frameTimer = 0;
        }

        // check catch
        if(f.y + f.size >= basket.y && f.y <= basket.y + basket.h){
            if(f.x + f.size > basket.x && f.x < basket.x + basket.w){
                score += f.value; scoreEl.textContent = score;
                fruits.splice(i,1); continue;
            }
        }
        // missed
        if(f.y > canvas.height + 40){
            fruits.splice(i,1); lives--; livesEl.textContent = lives; if(lives<=0) endGame();
        }
    }
}

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // draw basket (image if loaded, otherwise a brown rectangle)
    if(images.basket && images.basket.complete){
        ctx.drawImage(images.basket, basket.x, basket.y, basket.w, basket.h);
    } else {
        ctx.fillStyle = '#8b5e3c';
        ctx.fillRect(basket.x, basket.y, basket.w, basket.h);
        ctx.fillStyle='white'; ctx.font='18px sans-serif'; ctx.textAlign='center';
        ctx.fillText('BASKET', basket.x + basket.w/2, basket.y + basket.h/2 + 6);
    }

    // draw fruits (extract frame from spritesheet if available)
    for(const f of fruits){
        if(f.img && f.img.complete){
            // spritesheet is laid out vertically: frame 0 = top half, frame 1 = bottom half
            const frameHeight = f.img.height / f.frames;
            const srcY = f.frameIndex * frameHeight;
            ctx.drawImage(f.img, 0, srcY, f.img.width, frameHeight, f.x, f.y, f.size, f.size);
        } else {
            // fallback: grey circle while loading
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.arc(f.x + f.size/2, f.y + f.size/2, f.size/2, 0, Math.PI*2);
            ctx.fill();
        }
    }
}

function loop(ts){
    if(!running) return;
    const dt = ts - lastTime; lastTime = ts;
    try {
        update(dt);
        draw();
    } catch (err) {
        console.error('Error in game loop:', err);
    }
    requestAnimationFrame(loop);
}

// controls
let keys = {};
window.addEventListener('keydown', e=>{keys[e.key]=true;});
window.addEventListener('keyup', e=>{keys[e.key]=false;});

function controlTick(){
    if(!running) return; // only move during running
    let moved = false;
    if(keys['ArrowLeft'] || keys['a']){ basket.x -= basket.speed * (1/60); moved = true; }
    if(keys['ArrowRight'] || keys['d']){ basket.x += basket.speed * (1/60); moved = true; }
    // clamp
    basket.x = Math.max(8, Math.min(canvas.width - basket.w - 8, basket.x));
    requestAnimationFrame(controlTick);
}

canvas.addEventListener('mousemove', e=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    basket.x = mx - basket.w/2;
    basket.x = Math.max(8, Math.min(canvas.width - basket.w - 8, basket.x));
});

// Start / UI
startBtn.addEventListener('click', ()=>{ startGame(); controlTick(); });
playAgainBtn.addEventListener('click', ()=>{ startGame(); controlTick(); });

// Resize canvas for high-DPI displays
function resizeCanvas(){
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio,0,0,ratio,0,0);
    // adjust basket Y relative to canvas height
    basket.y = (canvas.height/ratio) - (basket.h + 20);
}

window.addEventListener('resize', resizeCanvas);
// initial
resizeCanvas();

// Expose simple debug start if developer opens file directly
window.startGame = startGame;
