//getting references to dom elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const startBtn = document.getElementById('startBtn');
const loading = document.getElementById('loading');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const playAgainBtn = document.getElementById('playAgain');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

//game state variables
let score = 0; //current player score
let lives = 3; //remaining lives
let running = false; //is game active?
let lastTime = 0; //timestamp for calculation
let fruits = []; //array of falling fruit
let spawnTimer = 0; //spawning timer
let spawnInterval = 900; //spawn intervals
let difficultyTimer = 0; //difficulty timer

//basket object: increase height for better vertical appearance
const basket = {x: canvas.width/2 - 70, y: canvas.height - 100, w:140, h:100, speed:700};

//fruit definitions: sprite file & point value
const fruitTypes = [
    {type:'strawberry', file:'Strawberry.png', value:2, frames:2},
    {type:'blueberry', file:'Blueberry.png', value:1, frames:2},
    {type:'carrot', file:'Carrot.png', value:3, frames:2},
    {type:'banana', file:'Banana.png', value:4, frames:2},
    {type:'apple', file:'Apple.png', value:5, frames:2}
];

//loading & processing fruit spritesheet images
const images = {};
for(const f of fruitTypes){
    const img = new Image();
    img.onload = () => {
        //removing background to make sprites/gifs transparent
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
                //if pixel is not already transparent, make it transparent
                if(a>0 && r<16 && g<16 && b<16){ px[i+3] = 0; changed = true; }
            }
            if(changed){ octx.putImageData(data,0,0); const newImg = new Image(); newImg.src = off.toDataURL(); images[f.type] = newImg; return; }
        }catch(e){}
        images[f.type] = img;
    };
    img.onerror = ()=>{ images[f.type]=img; };
    img.src = './Fruits/' + f.file;
}

//loading & processing basket image
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
    }catch(e){}
};
images.basket.src = './Fruits/Basket.png';

//creating falling fruit
function spawnFruit(){
    //selecting a fruit type
    const t = fruitTypes[Math.floor(Math.random()*fruitTypes.length)]; 
    //randomizing size
    const size = 96 + Math.random()*80; 
    //randomizing position
    const x = Math.max(16, Math.random()*(canvas.width - 16 - size)); 
    const base = (80 + Math.random()*120) * (t.value / 3) + Math.min(0.5 * score, 200);
    const speedMultiplier = 1 + Math.min(score / 40, 4);
    //fall speed based on fruit and score
    const fallSpeed = base * speedMultiplier;
    fruits.push({x, y: -size, size, fallSpeed, img: images[t.type], value: t.value, frameIndex: 0, frameTimer: 0, frames: t.frames});
}

//resetting all game state to initial values
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

//initializing & starting the game
function startGame(){
    resetGame();
    loading.style.display = 'none'; 
    gameOverEl.style.display = 'none'; 
    running = true;
    lastTime = performance.now();
    canvas.className = 'bg-level-1'; //set initial background
    requestAnimationFrame(loop);
}

//ending game & showing final score
function endGame(){
    running = false; //stop game loop
    finalScoreEl.textContent = 'Your score: ' + score;
    gameOverEl.style.display = 'flex'; //show game over screen
}

//updating game logic
function update(dt){
    //fruit spawning and difficulty progression
    spawnTimer += dt;
    difficultyTimer += dt;
    //increasing difficulty (every 9 secs) by spawning fruits faster
    if(difficultyTimer > 8000){
        spawnInterval = Math.max(300, spawnInterval - 80); 
        difficultyTimer = 0;
    }
    //spawning a new fruit when timer exceeds spawn interval
    if(spawnTimer > spawnInterval){ spawnFruit(); spawnTimer = 0; }

    //changing background based on score
    if(score >= 50 && !canvas.classList.contains('bg-level-3')){
        canvas.className = 'bg-level-3'; //green background at high score
    } else if(score >= 25 && !canvas.classList.contains('bg-level-2') && score < 50){
        canvas.className = 'bg-level-2'; //orange background at medium score
    }

    //updating each falling fruit
    for(let i=fruits.length-1;i>=0;i--){
        const f = fruits[i];
        f.y += f.fallSpeed * (dt/1000);
        
        //animating sprite frames
        f.frameTimer += dt;
        if(f.frameTimer > 500){
            f.frameIndex = (f.frameIndex + 1) % f.frames;
            f.frameTimer = 0;
        }

        //checking if basket caught the fruit
        if(f.y + f.size >= basket.y && f.y <= basket.y + basket.h){
            if(f.x + f.size > basket.x && f.x < basket.x + basket.w){
                score += f.value;
                scoreEl.textContent = score;
                fruits.splice(i,1); //removing caught fruit
                continue;
            }
        }
        //if fruit fell past the bottom
        if(f.y > canvas.height + 40){
            fruits.splice(i,1); //remove fruit
            lives--; //lose a life
            livesEl.textContent = lives;
            if(lives<=0) endGame(); //game over when no lives left
        }
    }
}

//rendering all game objects
function draw(){
    //clearing canvas
    ctx.clearRect(0,0,canvas.width,canvas.height);

    //drawing the basket
    if(images.basket && images.basket.complete){
        ctx.drawImage(images.basket, basket.x, basket.y, basket.w, basket.h);
    } else {
        //drawing brown rectangle with text while image loads
        ctx.fillStyle = '#8b5e3c';
        ctx.fillRect(basket.x, basket.y, basket.w, basket.h);
        ctx.fillStyle='white'; ctx.font='18px sans-serif'; ctx.textAlign='center';
        ctx.fillText('BASKET', basket.x + basket.w/2, basket.y + basket.h/2 + 6);
    }

    //drawing each falling fruit
    for(const f of fruits){
        if(f.img && f.img.complete){
            const frameHeight = f.img.height / f.frames;
            const srcY = f.frameIndex * frameHeight;
            ctx.drawImage(f.img, 0, srcY, f.img.width, frameHeight, f.x, f.y, f.size, f.size);
        } else {
            //drawing grey circle while sprite loads
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.arc(f.x + f.size/2, f.y + f.size/2, f.size/2, 0, Math.PI*2);
            ctx.fill();
        }
    }
}

//game looping
function loop(ts){
    if(!running) return; //stopping if game is paused
    const dt = ts - lastTime;
    lastTime = ts;
    try {
        update(dt);
        draw();
    } catch (err) {
        console.error('Error in game loop:', err);
    }
    requestAnimationFrame(loop);
}

//keyboard controls
let keys = {};
window.addEventListener('keydown', e=>{keys[e.key]=true;});
window.addEventListener('keyup', e=>{keys[e.key]=false;});

//keyboard input
function controlTick(){
    if(!running) return; //only processing input during active game
    let moved = false;
    //moving basket left with arrow key <- or 'A' key
    if(keys['ArrowLeft'] || keys['a']){ basket.x -= basket.speed * (1/60); moved = true; }
    //moving right with arrow key -> or 'D' key
    if(keys['ArrowRight'] || keys['d']){ basket.x += basket.speed * (1/60); moved = true; }
    //keeping basket within canvas bounds
    basket.x = Math.max(8, Math.min(canvas.width - basket.w - 8, basket.x));
    requestAnimationFrame(controlTick); //continuing input loop
}

//mouse controls
canvas.addEventListener('mousemove', e=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; //get mouse X relative to canvas
    basket.x = mx - basket.w/2; //centering basket on cursor
    basket.x = Math.max(8, Math.min(canvas.width - basket.w - 8, basket.x)); //clamping to bounds
});

//ui button event listeners
startBtn.addEventListener('click', ()=>{ startGame(); controlTick(); }); //start game button
playAgainBtn.addEventListener('click', ()=>{ startGame(); controlTick(); }); //play again button

//handling canvas resizing
function resizeCanvas(){
    const ratio = window.devicePixelRatio || 1; //getting display pixel density
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    //scaling canvas resolution to match physical pixels
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio,0,0,ratio,0,0); //scale drawing context
    //repositioning basket at bottom of canvas
    basket.y = (canvas.height/ratio) - (basket.h + 20);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.startGame = startGame;
