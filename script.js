/* DOM Elements */
const videoElement = document.getElementsByClassName('input_video')[0];
const statusMsg = document.getElementById('statusMsg');

/* UI Controls */
const uiParticleColor = document.getElementById('particleColor');
const uiParticleCount = document.getElementById('particleCount');
const uiCountValue = document.getElementById('particleCountValue');
const uiGravityStrength = document.getElementById('gravityStrength');
const uiGravityValue = document.getElementById('gravityStrengthValue');
const uiBgColor = document.getElementById('bgColor');
const uiGestureToggle = document.getElementById('gestureToggle');
const dashboard = document.getElementById('dashboard');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');
const closeControlsBtn = document.getElementById('closeControlsBtn');

toggleControlsBtn.addEventListener('click', () => {
    dashboard.classList.remove('hidden');
    toggleControlsBtn.style.display = 'none';
});

closeControlsBtn.addEventListener('click', () => {
    dashboard.classList.add('hidden');
    toggleControlsBtn.style.display = 'flex';
});

/* Three.js Setup */
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// We DO NOT set scene.background here; we use autoClearColor = false for trails
// Add fog to make deep particles fade naturally
scene.fog = new THREE.FogExp2(new THREE.Color(uiBgColor.value), 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.autoClearColor = false;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
container.appendChild(renderer.domElement);

const fadeScene = new THREE.Scene();
const fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fadeMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(uiBgColor.value),
    transparent: true,
    opacity: 0.15,
    depthTest: false
});
fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMaterial));

/* Particle System Configuration */
let maxParticles = 50000;
let currentParticleCount = parseInt(uiParticleCount.value);

const positions = new Float32Array(maxParticles * 3);
const basePositions = new Float32Array(maxParticles * 3);
const velocities = new Float32Array(maxParticles * 3);
const colors = new Float32Array(maxParticles * 3);

// Initialize geometry to hidden (trigger explosion to show particles)
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setDrawRange(0, 0);

// Helper for drawing additive blended glowing neon particles
const material = new THREE.PointsMaterial({
    size: 0.2, // increased size slightly for better neon visibility
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

/* Physics / Interaction State */
let handPositions = []; // Array of tracking vectors
let repulsionStrength = parseFloat(uiGravityStrength.value);
let gesturesEnabled = uiGestureToggle.checked;
const returnSpeed = 0.015; // smoother slower return
const friction = 0.93; // more floaty

let hasExploded = false;
let currentHandSpeed = 0; // global to pass to animate loop
const paletteHex = ['#ff003c', '#00ffff', '#b000ff', '#00ff73', '#ffff00'];
const colorObj = new THREE.Color();
const baseColorObj = new THREE.Color();

window.triggerExplosion = function (centerX, centerY, centerZ, intensity = 1.0) {
    if (currentParticleCount === 0 || hasExploded) return;
    hasExploded = true;
    geometry.setDrawRange(0, currentParticleCount);

    // Antigravity style custom vibrant palette
    for (let i = 0; i < currentParticleCount; i++) {
        const i3 = i * 3;

        positions[i3] = centerX + (Math.random() - 0.5) * 1.5;
        positions[i3 + 1] = centerY + (Math.random() - 0.5) * 1.5;
        positions[i3 + 2] = centerZ + (Math.random() - 0.5) * 1.5;

        const r = 30 + Math.random() * 50;
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);

        basePositions[i3] = r * Math.sin(phi) * Math.cos(theta) * 2.0;
        basePositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 1.5;
        basePositions[i3 + 2] = r * Math.cos(phi);

        const speed = (2 + Math.random() * 6) * intensity;
        velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[i3 + 2] = Math.cos(phi) * speed;

        colorObj.set(paletteHex[Math.floor(Math.random() * paletteHex.length)]);
        colors[i3] = colorObj.r;
        colors[i3 + 1] = colorObj.g;
        colors[i3 + 2] = colorObj.b;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
};

window.changeParticleColors = function () {
    if (!hasExploded) return;
    const colorArray = geometry.attributes.color.array;
    for (let i = 0; i < currentParticleCount; i++) {
        // Only randomly switch a percentage to create a dynamic look
        if (Math.random() > 0.4) {
            const i3 = i * 3;
            // Generate full spectrum random neon HSL (sat: 1.0, light: 0.5)
            colorObj.setHSL(Math.random(), 1.0, 0.5);
            colorArray[i3] = colorObj.r;
            colorArray[i3 + 1] = colorObj.g;
            colorArray[i3 + 2] = colorObj.b;
        }
    }
    geometry.attributes.color.needsUpdate = true;
    console.log("🎨 Vibrant Colors Changed via Gestures!");
};

/* Mouse Fallback */
const mouseInfo = { active: false, x: 0, y: 0, z: 0 };
let lastMousePos = null;
let lastMouseTime = 0;

window.addEventListener('mousemove', (e) => {
    if (gesturesEnabled && handPositions.length > 0) return; // Prefer hands

    mouseInfo.active = true;
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    mouseInfo.x = pos.x;
    mouseInfo.y = pos.y;
    mouseInfo.z = pos.z;

    const now = performance.now();
    let velocityMultiplier = 1.0;
    if (lastMousePos) {
        const dt = Math.max(now - lastMouseTime, 16);
        const dist = lastMousePos.distanceTo(pos);
        velocityMultiplier = Math.min(dist / dt * 50, 4.0);
    }
    currentHandSpeed = velocityMultiplier; // mirror for mouse behavior

    lastMousePos = pos.clone();
    lastMouseTime = now;

    if (!hasExploded) {
        window.triggerExplosion(pos.x, pos.y, pos.z, Math.max(velocityMultiplier, 1.2));
    }

    clearTimeout(mouseInfo.timeout);
    mouseInfo.timeout = setTimeout(() => { mouseInfo.active = false; lastMousePos = null; }, 300);
});

/* Animation Engine */
let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);
    frameCount++;

    // Draw trail fade
    renderer.render(fadeScene, fadeCamera);

    if (!hasExploded) return; // Do not draw particles until triggered

    const posAttribute = geometry.attributes.position;
    const posArray = posAttribute.array;
    const colorArray = geometry.attributes.color.array;
    baseColorObj.set(uiParticleColor.value);

    // Dampen global hand speed over frames
    currentHandSpeed *= 0.92;

    const interactors = [];
    if (gesturesEnabled) handPositions.forEach(hand => interactors.push(hand));
    if (interactors.length === 0 && mouseInfo.active) interactors.push(mouseInfo);

    for (let i = 0; i < currentParticleCount; i++) {
        const i3 = i * 3;

        let tx = basePositions[i3];
        let ty = basePositions[i3 + 1];
        let tz = basePositions[i3 + 2];

        let fx = 0, fy = 0, fz = 0;

        interactors.forEach(interactor => {
            const dx = posArray[i3] - interactor.x;
            const dy = posArray[i3 + 1] - interactor.y;
            const dz = posArray[i3 + 2] - interactor.z;

            // Repel in a cylinder (ignoring deep Z differences) so the hand sweeps everything
            const distSq = dx * dx + dy * dy;
            const radiusSq = 1200; // Large influence

            if (distSq < radiusSq) {
                const force = repulsionStrength / (distSq + 2);
                fx += dx * force;
                fy += dy * force;
                fz += dz * force * 0.1; // Gentle push in Z to give 3D depth to the shockwave

                // Color explosion on fast hand movement using HSL
                if (currentHandSpeed > 1.2 && distSq < radiusSq * 0.5 && Math.random() > 0.5) {
                    colorObj.setHSL(Math.random(), 1.0, 0.5);
                    colorArray[i3] = colorObj.r;
                    colorArray[i3 + 1] = colorObj.g;
                    colorArray[i3 + 2] = colorObj.b;
                }
            }
        });

        const angle = 0.001;
        const rx = tx * Math.cos(angle) - tz * Math.sin(angle);
        const rz = tx * Math.sin(angle) + tz * Math.cos(angle);
        basePositions[i3] = rx;
        basePositions[i3 + 2] = rz;
        tx = rx; tz = rz;

        const springX = (tx - posArray[i3]) * returnSpeed;
        const springY = (ty - posArray[i3 + 1]) * returnSpeed;
        const springZ = (tz - posArray[i3 + 2]) * returnSpeed;

        velocities[i3] = (velocities[i3] + fx + springX) * friction;
        velocities[i3 + 1] = (velocities[i3 + 1] + fy + springY) * friction;
        velocities[i3 + 2] = (velocities[i3 + 2] + fz + springZ) * friction;

        posArray[i3] += velocities[i3];
        posArray[i3 + 1] += velocities[i3 + 1];
        posArray[i3 + 2] += velocities[i3 + 2];

        // Lerp color slowly back to default base color
        colorArray[i3] += (baseColorObj.r - colorArray[i3]) * 0.015;
        colorArray[i3 + 1] += (baseColorObj.g - colorArray[i3 + 1]) * 0.015;
        colorArray[i3 + 2] += (baseColorObj.b - colorArray[i3 + 2]) * 0.015;
    }

    posAttribute.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    camera.position.x += (Math.sin(frameCount * 0.002) * 8 - camera.position.x) * 0.02;
    camera.position.y += (Math.cos(frameCount * 0.003) * 5 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}
animate();

/* Window Resize Handling */
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* Dashboard Interactions */
uiParticleColor.addEventListener('input', (e) => {
    material.color.set(e.target.value);
});

uiBgColor.addEventListener('input', (e) => {
    fadeMaterial.color.set(e.target.value);
    scene.fog.color.set(e.target.value);
});

uiParticleCount.addEventListener('input', (e) => {
    currentParticleCount = parseInt(e.target.value);
    uiCountValue.textContent = currentParticleCount;
    geometry.setDrawRange(0, currentParticleCount);
});

uiGravityStrength.addEventListener('input', (e) => {
    repulsionStrength = parseFloat(e.target.value);
    uiGravityValue.textContent = e.target.value;
});

uiGestureToggle.addEventListener('change', (e) => {
    gesturesEnabled = e.target.checked;
    if (gesturesEnabled) {
        if (!mediaPipeInitialized) {
            initMediaPipe();
        } else {
            camera_start();
        }
    } else {
        camera_stop();
        handPositions = [];
    }
});


/* MediaPipe Integration (Google Hands AI) */
let mediaPipeInitialized = false;
let mpCamera = null;

let lastHandCenter = null;
let lastHandTime = 0;

function onResults(results) {
    if (!gesturesEnabled) return;

    handPositions = [];
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        console.log("👐 Hand detected. Number of hands:", results.multiHandLandmarks.length);

        statusMsg.textContent = "AI Vision Active - Hand detected";
        statusMsg.style.color = "#00ffcc";

        let currentCenter = null;

        for (const landmarks of results.multiHandLandmarks) {
            // Extract the index finger landmark position (landmark 8)
            const tip = landmarks[8];

            // X is mirrored intentionally for typical front-facing camera usage
            const ndcX = -(tip.x * 2 - 1);
            const ndcY = -(tip.y * 2 - 1);

            // Convert hand coordinates to screen/world space
            const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));

            handPositions.push({ x: pos.x, y: pos.y, z: pos.z });
            if (!currentCenter) currentCenter = pos.clone();

            // Log coordinates dynamically to console
            console.log(`☝️ Index finger mapped to screen coords: X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}`);
        }

        const now = performance.now();
        let handVelocityVal = 0;
        if (lastHandCenter) {
            // dt in ms, rough approximation of speed
            const dt = Math.max(now - lastHandTime, 16);
            const dist = lastHandCenter.distanceTo(currentCenter);
            handVelocityVal = Math.min((dist / dt) * 100, 5.0);
            currentHandSpeed = Math.max(currentHandSpeed, handVelocityVal); // Inject to global scope

            // Trigger global color explosion on fast swipe
            if (handVelocityVal > 1.8) {
                window.changeParticleColors();
            }
        }

        lastHandCenter = currentCenter;
        lastHandTime = now;

        if (!hasExploded && handPositions.length > 0) {
            const intensity = Math.max(handVelocityVal, 1.5);
            console.log(`💥 Triggering Explosion! Hand Speed Intensity: ${intensity.toFixed(2)}`);
            // Trigger massive birth of particles based on hand speed
            window.triggerExplosion(handPositions[0].x, handPositions[0].y, handPositions[0].z, intensity);
        }

    } else {
        lastHandCenter = null;
        statusMsg.textContent = "AI Vision Active - Waiting for hands...";
        statusMsg.style.color = "#ffaa00";
    }
}

function initMediaPipe() {
    mediaPipeInitialized = true;
    statusMsg.textContent = "Loading Hand Tracking...";
    statusMsg.style.color = "#ff3366";

    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    hands.onResults(onResults);

    mpCamera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    camera_start();
}

function camera_start() {
    if (mpCamera) {
        mpCamera.start().then(() => {
            statusMsg.textContent = "Webcam Active - Show your hands!";
            statusMsg.style.color = "#ffaa00";
        }).catch(err => {
            console.error(err);
            statusMsg.textContent = "Webcam error. Please allow access.";
            statusMsg.style.color = "#ff3366";
        });
    }
}

function camera_stop() {
    if (mpCamera) {
        mpCamera.stop();
        statusMsg.textContent = "Gestures Disabled.";
        statusMsg.style.color = "#8c9bb0";
    }
}

// Boot Sequence
if (gesturesEnabled) {
    initMediaPipe();
} else {
    statusMsg.textContent = "Gestures Disabled.";
    statusMsg.style.color = "#8c9bb0";
}
