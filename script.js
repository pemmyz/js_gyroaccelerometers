// --- DOM Elements ---
const uiLayer = document.getElementById('ui-layer');
const menu = document.getElementById('menu');
const startBtn = document.getElementById('start-btn');
const calibrationScreen = document.getElementById('calibration-screen');
const countdownEl = document.getElementById('countdown');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tableObj = document.getElementById('table');

// --- Game & Input State ---
let gameState = 'MENU'; // MENU, CALIBRATING, PLAYING
let isMobile = false;

// Calibration & Angles
let baseBeta = 0;
let baseGamma = 0;
let tiltX = 0; // Rotate left/right
let tiltY = 0; // Rotate forward/backward
const maxTilt = 30; // Max visual and physics tilt in degrees

// --- Physics (Planck.js) Setup ---
const pl = planck;
const scale = 30; // pixels per meter
const widthM = canvas.width / scale; // 20m
const heightM = canvas.height / scale; // 20m

// Create World with 0 initial gravity
const world = pl.World(pl.Vec2(0, 0));

// Create boundaries (Walls)
const wallDef = { density: 0, friction: 0.2, restitution: 0.4 };
world.createBody().createFixture(pl.Edge(pl.Vec2(0, 0), pl.Vec2(widthM, 0)), wallDef); // Top
world.createBody().createFixture(pl.Edge(pl.Vec2(0, 0), pl.Vec2(0, heightM)), wallDef); // Left
world.createBody().createFixture(pl.Edge(pl.Vec2(widthM, 0), pl.Vec2(widthM, heightM)), wallDef); // Right
world.createBody().createFixture(pl.Edge(pl.Vec2(0, heightM), pl.Vec2(widthM, heightM)), wallDef); // Bottom

// Create the Rolling Ball
const ballRadius = 0.5; // meters
const ball = world.createBody({
    type: 'dynamic',
    position: pl.Vec2(widthM / 2, heightM / 2),
    linearDamping: 0.5,
    angularDamping: 0.5
});
ball.createFixture(pl.Circle(ballRadius), {
    density: 1.0,
    friction: 0.1,
    restitution: 0.6 // Bounciness
});

// --- Input Handling ---

// 1. Desktop Mouse Movement
window.addEventListener('mousemove', (e) => {
    if (gameState !== 'PLAYING' || isMobile) return;
    
    // Calculate mouse position relative to center of screen
    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;
    
    // Map mouse position to -maxTilt to +maxTilt
    let normX = (e.clientX - centerX) / centerX;
    let normY = (e.clientY - centerY) / centerY;
    
    tiltX = normX * maxTilt;
    tiltY = normY * maxTilt; // positive Y means tilting board away (top goes down)
});

// 2. Mobile Gyroscope (Device Orientation)
window.addEventListener('deviceorientation', (e) => {
    if (!e.beta || !e.gamma) return;
    isMobile = true;

    if (gameState === 'CALIBRATING') {
        // Just store the latest angles to be used as base
        baseBeta = e.beta;
        baseGamma = e.gamma;
    } else if (gameState === 'PLAYING') {
        // Calculate tilt based on calibrated offset
        let rawBeta = e.beta - baseBeta;
        let rawGamma = e.gamma - baseGamma;

        // Clamp to maxTilt
        tiltY = Math.max(-maxTilt, Math.min(maxTilt, rawBeta));
        tiltX = Math.max(-maxTilt, Math.min(maxTilt, rawGamma));
    }
});


// --- Calibration Sequence ---
startBtn.addEventListener('click', async () => {
    // iOS 13+ permission request
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                alert("Permission needed for mobile controls. Defaulting to mouse if on desktop.");
            }
        } catch (err) {
            console.error(err);
        }
    }

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
    setTimeout(() => uiLayer.classList.add('hidden'), 500); // fade out
}


// --- Game Loop (Physics & Rendering) ---

function updatePhysics() {
    // Convert degrees to radians for gravity math
    let gravityForce = 15; // Gravity multiplier 
    
    // Apply gravity to world based on tilt
    // tiltX > 0 means tilt right -> gravity goes positive X
    // tiltY > 0 means tilt away -> gravity goes negative Y (up the screen)
    let gx = Math.sin(tiltX * (Math.PI / 180)) * gravityForce;
    let gy = Math.sin(tiltY * (Math.PI / 180)) * gravityForce;
    
    world.setGravity(pl.Vec2(gx, gy));
    
    // Step the physics engine (1/60th of a second)
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
    
    // Create a spherical gradient for the ball
    let grad = ctx.createRadialGradient(
        pos.x * scale - 5, pos.y * scale - 5, 2, 
        pos.x * scale, pos.y * scale, ballRadius * scale
    );
    grad.addColorStop(0, '#ff6666');
    grad.addColorStop(1, '#880000');
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.closePath();

    // Draw shadow/highlight to indicate rolling
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
    // Apply CSS 3D transform to the table container
    // Negative tiltY because rotateX positive pushes the top backward
    tableObj.style.transform = `rotateX(${-tiltY}deg) rotateY(${tiltX}deg)`;
}

function render() {
    if (gameState === 'PLAYING') {
        updatePhysics();
        applyVisualTilt();
    }

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Environment
    drawCheckeredFloor();
    drawBall();

    requestAnimationFrame(render);
}

// Start Render Loop
requestAnimationFrame(render);
