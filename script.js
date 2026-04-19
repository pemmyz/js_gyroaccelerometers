// --- DOM Elements ---
const mobileToggleBtn = document.getElementById('mobile-btn');
const optionsBtn = document.getElementById('options-btn');
const optionsScreen = document.getElementById('options-screen');
const closeOptionsBtn = document.getElementById('close-options-btn');
const tiltStyleSelect = document.getElementById('tilt-style');
const boardSizeSlider = document.getElementById('board-size');
const boardSizeVal = document.getElementById('board-size-val');

const screenElement = document.getElementById("screen");
const uiLayer = document.getElementById('ui-layer');
const menu = document.getElementById('menu');
const startBtn = document.getElementById('start-btn');
const calibrationScreen = document.getElementById('calibration-screen');
const countdownEl = document.getElementById('countdown');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tableObj = document.getElementById('table');

// Stats Elements
const tiltXEl = document.getElementById('tilt-x');
const tiltYEl = document.getElementById('tilt-y');
const accXEl = document.getElementById('acc-x');
const accYEl = document.getElementById('acc-y');
const accZEl = document.getElementById('acc-z');
const gyrXEl = document.getElementById('gyr-x');
const gyrYEl = document.getElementById('gyr-y');
const gyrZEl = document.getElementById('gyr-z');

// --- Game & Input State ---
let gameState = 'MENU'; 
let isMobile = false;
let sensorsActive = false;

let baseBeta = 0;
let baseGamma = 0;
let tiltX = 0; 
let tiltY = 0; 
const maxTilt = 30; 

// Options State
let tiltStyle = 'LOGARITHMIC'; // Default to the new aggressive style
let boardSizeMultiplier = 0.9; // 10% smaller by default

// --- Options Menu Event Listeners ---
optionsBtn.addEventListener('click', () => optionsScreen.classList.remove('hidden'));
closeOptionsBtn.addEventListener('click', () => optionsScreen.classList.add('hidden'));

tiltStyleSelect.addEventListener('change', (e) => {
    tiltStyle = e.target.value;
});

boardSizeSlider.addEventListener('input', (e) => {
    boardSizeMultiplier = parseFloat(e.target.value);
    boardSizeVal.innerText = Math.round(boardSizeMultiplier * 100) + '%';
    scaleGame(); // Update visuals immediately while dragging
});

// --- Physics (Planck.js) Setup ---
const pl = planck;
const scale = 30; 
const widthM = canvas.width / scale; 
const heightM = canvas.height / scale; 

const world = pl.World(pl.Vec2(0, 0));
const wallDef = { density: 0, friction: 0.2, restitution: 0.4 };

world.createBody().createFixture(pl.Edge(pl.Vec2(0, 0), pl.Vec2(widthM, 0)), wallDef); 
world.createBody().createFixture(pl.Edge(pl.Vec2(0, 0), pl.Vec2(0, heightM)), wallDef); 
world.createBody().createFixture(pl.Edge(pl.Vec2(widthM, 0), pl.Vec2(widthM, heightM)), wallDef); 
world.createBody().createFixture(pl.Edge(pl.Vec2(0, heightM), pl.Vec2(widthM, heightM)), wallDef); 

const ballRadius = 0.5; 
const ball = world.createBody({
    type: 'dynamic',
    position: pl.Vec2(widthM / 2, heightM / 2),
    linearDamping: 0.5,
    angularDamping: 0.5,
    allowSleep: false // Prevents the ball from getting stuck asleep during the 4-second calibration
});

ball.createFixture(pl.Circle(ballRadius), {
    density: 1.0,
    friction: 0.1,
    restitution: 0.6 
});

// --- SCALING & FULLSCREEN LOGIC ---
function scaleGame() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    let baseScale = Math.min(window.innerWidth / 600, window.innerHeight / 600);
    
    // Apply the custom multiplier from the options slider
    let screenScale = baseScale * boardSizeMultiplier;
    
    if (isFullscreen) {
        screenElement.style.transform = `scale(${screenScale * 0.98})`;
        document.body.classList.add('mobile-mode'); 
    } else {
        screenElement.style.transform = `scale(${screenScale * 0.90})`; 
        document.body.classList.remove('mobile-mode');
    }
}

function goFull() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

window.addEventListener("resize", scaleGame);
window.addEventListener("fullscreenchange", scaleGame);
window.addEventListener("webkitfullscreenchange", scaleGame);
scaleGame(); 
mobileToggleBtn.addEventListener('click', goFull);


// --- TILT MATH HELPER ---
// Function to handle the two different tilting styles
function calculateTilt(rawValue) {
    if (tiltStyle === 'LINEAR') {
        // OLD STYLE: Even, constant linear progression clamped to maxTilt
        return Math.max(-maxTilt, Math.min(maxTilt, rawValue));
    } else {
        // NEW STYLE (Logarithmic): Fast early movement, then smoothly caps out at maxTilt
        // Exponential decay acts like a perfect logarithmic/clamping curve here.
        const aggressiveness = 0.15; // Higher = steeper initial climb
        return Math.sign(rawValue) * maxTilt * (1 - Math.exp(-aggressiveness * Math.abs(rawValue)));
    }
}


// --- INPUT HANDLING (Desktop Mouse) ---
window.addEventListener('mousemove', (e) => {
    // If a real mobile device is detected, ignore the mouse
    if (gameState !== 'PLAYING' || isMobile) return;
    
    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;
    
    let normX = (e.clientX - centerX) / centerX;
    let normY = (e.clientY - centerY) / centerY;
    
    // Scale normalized value to our raw degrees, then apply formula
    let rawX = normX * maxTilt;
    let rawY = normY * maxTilt;
    
    tiltX = calculateTilt(rawX);
    tiltY = calculateTilt(rawY);
});


// --- SENSOR ACTIVATION ---
function attachSensors() {
    if (sensorsActive) return;
    sensorsActive = true;

    // DEVICE ORIENTATION (Absolute Tilt)
    window.addEventListener('deviceorientation', (e) => {
        if (e.beta == null || e.gamma == null) return;
        
        // Desktop Chrome sends a fake event where beta and gamma are exactly 0.
        // Physical phone sensors always have micro-noise (e.g., 0.002), so we ignore perfect zeros.
        if (e.beta === 0 && e.gamma === 0) return;

        isMobile = true; // Physical sensors confirmed, disable mouse

        tiltXEl.innerText = e.beta.toFixed(1);
        tiltYEl.innerText = e.gamma.toFixed(1);

        if (gameState === 'CALIBRATING') {
            baseBeta = e.beta;
            baseGamma = e.gamma;
        } else if (gameState === 'PLAYING') {
            let rawBeta = e.beta - baseBeta;
            let rawGamma = e.gamma - baseGamma;

            // Apply the chosen style curve (Swapped for mobile horizontal orientation)
            tiltX = calculateTilt(rawBeta);
            tiltY = calculateTilt(rawGamma);
        }
    });

    // DEVICE MOTION (Accelerometer + Gyro Rate)
    window.addEventListener('devicemotion', (e) => {
        if (e.accelerationIncludingGravity) {
            accXEl.innerText = (e.accelerationIncludingGravity.x || 0).toFixed(1);
            accYEl.innerText = (e.accelerationIncludingGravity.y || 0).toFixed(1);
            accZEl.innerText = (e.accelerationIncludingGravity.z || 0).toFixed(1);
        }
        if (e.rotationRate) {
            gyrXEl.innerText = (e.rotationRate.alpha || 0).toFixed(1);
            gyrYEl.innerText = (e.rotationRate.beta || 0).toFixed(1);  
            gyrZEl.innerText = (e.rotationRate.gamma || 0).toFixed(1); 
        }
    });
}


// --- CALIBRATION SEQUENCE ---
startBtn.addEventListener('click', async () => {
    
    // SECURITY CHECK: Warn Android Chrome users if they are on an insecure HTTP IP address
    if (!window.isSecureContext) {
        alert("WARNING: Your browser is blocking sensors because this connection is not secure (HTTPS).\n\nIf testing locally, use port forwarding or deploy to GitHub Pages!");
    }

    // iOS Safari Permission Check
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const orientationPerm = await DeviceOrientationEvent.requestPermission();
            if (orientationPerm !== 'granted') {
                console.warn("Sensors denied. Defaulting to mouse control.");
            }
        } catch (err) {
            console.error(err);
        }
    }

    attachSensors();
    startCalibration();
});

function startCalibration() {
    gameState = 'CALIBRATING';
    menu.classList.add('hidden');
    calibrationScreen.classList.remove('hidden');

    let count = 4;
    countdownEl.innerText = count;

    const interval = setInterval(() => {
        count--;
        countdownEl.innerText = count;
        
        if (count <= 0) {
            clearInterval(interval);
            finishCalibration();
        }
    }, 1000);
}

function finishCalibration() {
    gameState = 'PLAYING';
    uiLayer.style.opacity = '0';
    setTimeout(() => uiLayer.classList.add('hidden'), 500);
}


// --- GAME LOOP (Physics & Rendering) ---
function updatePhysics() {
    let gravityForce = 15; 
    let gx = Math.sin(tiltX * (Math.PI / 180)) * gravityForce;
    let gy = Math.sin(tiltY * (Math.PI / 180)) * gravityForce;
    
    world.setGravity(pl.Vec2(gx, gy));
    ball.setAwake(true); // Force Planck.js to keep calculating the ball's physics
    world.step(1 / 60);
}

function drawCheckeredFloor() {
    const cols = 10;
    const rows = 10;
    const tileW = canvas.width / cols;
    const tileH = canvas.height / rows;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#dddddd' : '#ffffff';
            ctx.fillRect(i * tileW, j * tileH, tileW, tileH);
        }
    }
}

function drawBall() {
    let pos = ball.getPosition();
    
    ctx.beginPath();
    ctx.arc(pos.x * scale, pos.y * scale, ballRadius * scale, 0, 2 * Math.PI);
    
    let grad = ctx.createRadialGradient(
        pos.x * scale - 5, pos.y * scale - 5, 2, 
        pos.x * scale, pos.y * scale, ballRadius * scale
    );
    grad.addColorStop(0, '#ff6666');
    grad.addColorStop(1, '#880000');
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.closePath();

    let angle = ball.getAngle();
    ctx.beginPath();
    ctx.moveTo(pos.x * scale, pos.y * scale);
    ctx.lineTo(
        pos.x * scale + Math.cos(angle) * (ballRadius * scale),
        pos.y * scale + Math.sin(angle) * (ballRadius * scale)
    );
    ctx.strokeStyle = '#330000';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function applyVisualTilt() {
    tableObj.style.transform = `rotateX(${-tiltY}deg) rotateY(${tiltX}deg)`;
}

function render() {
    if (gameState === 'PLAYING') {
        updatePhysics();
        applyVisualTilt();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawCheckeredFloor();
    drawBall();

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
