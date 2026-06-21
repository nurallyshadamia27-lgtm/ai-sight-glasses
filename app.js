// AI Sight - Core JavaScript Engine

// DOM Element References
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const ctx = canvasElement.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const statusBadge = document.getElementById('status-badge');
const btnToggleCamera = document.getElementById('btn-toggle-camera');
const btnSwitchCamera = document.getElementById('btn-switch-camera');
const chkAudio = document.getElementById('chk-audio');
const rangeRate = document.getElementById('range-rate');
const rateValue = document.getElementById('rate-value');
const statFps = document.getElementById('stat-fps');
const statCount = document.getElementById('stat-count');
const logsList = document.getElementById('logs-list');
const guidanceOverlay = document.getElementById('guidance-overlay');
const guidanceText = document.getElementById('guidance-text');
const permissionModal = document.getElementById('permission-modal');
const btnGrantPermission = document.getElementById('btn-grant-permission');

// Web Audio Context for Spatial Beeps
let audioCtx = null;

// Application State
let model = null;
let webcamStream = null;
let isStreaming = false;
let facingMode = "environment"; // default to back camera on phones
let detectionLoopId = null;

// Speech Cooldown & Throttling
let lastSpeechTime = 0;
const SPEECH_COOLDOWN_MS = 2500; // Say warning every 2.5 seconds to prevent spam
let lastSpokenObject = "";

// FPS calculation
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0.0;

// Initialize App
window.addEventListener('DOMContentLoaded', async () => {
    addLog("Initializing AI system...", "system");
    
    // Check if browser supports Web Speech API
    if (!('speechSynthesis' in window)) {
        addLog("Warning: Your browser does not support Text-to-Speech.", "warning");
        chkAudio.checked = false;
        chkAudio.disabled = true;
    }

    // Load TensorFlow COCO-SSD Model
    try {
        loadingText.innerText = "Downloading Lite AI Model...";
        // Use 'lite_mobilenet_v2' for faster loading and execution on mobile browsers
        model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.style.display = 'none', 500);
        
        statusBadge.innerText = "Ready";
        statusBadge.className = "badge ready";
        addLog("AI Model successfully loaded (Lite MobileNet V2).", "ready");
        
        // Enable Controls
        btnToggleCamera.disabled = false;
        btnSwitchCamera.disabled = false;

        // Check for camera permission status first
        let showModal = true;
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                if (permissionStatus.state === 'granted') {
                    showModal = false;
                    addLog("Camera permission already granted. Starting camera...", "system");
                    startCamera();
                }
            } catch (e) {
                console.warn("Permissions API query failed:", e);
            }
        }
        
        if (showModal) {
            permissionModal.classList.remove('hidden');
            addLog("Camera permission required. Showing prompt...", "system");
        }
    } catch (error) {
        console.error("Failed to load model:", error);
        loadingText.innerText = "Error loading model. Please reload the page.";
        loadingText.style.color = "var(--color-rose)";
        addLog("Critical error: Failed to download AI model.", "alert");
    }
});

// Sound Settings Input Listeners
rangeRate.addEventListener('input', (e) => {
    rateValue.innerText = `${e.target.value}x`;
});

// Button: Grant Permission Modal Click
btnGrantPermission.addEventListener('click', async () => {
    permissionModal.classList.add('hidden');
    await startCamera();
});

// Button: Toggle Camera (Start/Stop)
btnToggleCamera.addEventListener('click', () => {
    if (isStreaming) {
        stopCamera();
    } else {
        startCamera();
    }
});

// Button: Switch Camera (Front/Back)
btnSwitchCamera.addEventListener('click', () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    const modeText = facingMode === "user" ? "Front" : "Back";
    addLog(`Switching camera to ${modeText} camera.`, "system");
    btnSwitchCamera.innerHTML = `<span>🔄</span> Camera: ${modeText}`;
    
    if (isStreaming) {
        stopCamera();
        startCamera();
    }
});

// Start Camera Stream
async function startCamera() {
    try {
        let constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };
        
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (initialErr) {
            console.warn("Initial camera constraints failed, trying fallback...", initialErr);
            // Fallback: request any available camera
            constraints = { video: true, audio: false };
            webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        
        webcamElement.srcObject = webcamStream;
        
        // Start playing the video
        webcamElement.onloadedmetadata = () => {
            webcamElement.play();
            
            // Adjust canvas rendering size to match video aspect ratio
            canvasElement.width = webcamElement.videoWidth;
            canvasElement.height = webcamElement.videoHeight;
            
            isStreaming = true;
            btnToggleCamera.innerHTML = "<span>⏹️</span> Stop Camera";
            btnToggleCamera.className = "btn btn-primary recording";
            
            statusBadge.innerText = "Active (AI)";
            statusBadge.className = "badge active";
            
            // Hide the permission modal since stream started successfully
            permissionModal.classList.add('hidden');
            
            addLog("Camera activated. Starting AI scan...", "ready");
            
            // Start real-time detection loop
            detectionLoopId = requestAnimationFrame(detectFrame);
        };
        
    } catch (err) {
        console.error("Camera access error:", err);
        addLog("Failed to open camera. Please ensure camera permissions are granted.", "alert");
        permissionModal.classList.remove('hidden');
    }
}

// Stop Camera Stream
function stopCamera() {
    if (detectionLoopId) {
        cancelAnimationFrame(detectionLoopId);
        detectionLoopId = null;
    }
    
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamElement.srcObject = null;
    }
    
    isStreaming = false;
    btnToggleCamera.innerHTML = "<span>▶️</span> Start Camera";
    btnToggleCamera.className = "btn btn-primary";
    
    statusBadge.innerText = "Ready";
    statusBadge.className = "badge ready";
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    guidanceOverlay.classList.add('hidden');
    statFps.innerText = "0.0";
    statCount.innerText = "0";
    
    addLog("Camera stopped.", "system");
}

// Core Detection Loop
async function detectFrame() {
    if (!isStreaming) return;
    
    // FPS calculation
    const now = performance.now();
    frameCount++;
    if (now - lastFrameTime >= 1000) {
        fps = (frameCount * 1000) / (now - lastFrameTime);
        statFps.innerText = fps.toFixed(1);
        frameCount = 0;
        lastFrameTime = now;
    }
    
    try {
        // Run object detection model
        const predictions = await model.detect(webcamElement);
        
        // Clear canvas overlay
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        let detectedCount = 0;
        let highestRiskObject = null;
        
        predictions.forEach(prediction => {
            // Filter confidence score (only show 50%+ certainty)
            if (prediction.score > 0.50) {
                detectedCount++;
                const [x, y, width, height] = prediction.bbox;
                const className = prediction.class;
                const confidence = Math.round(prediction.score * 100);
                
                // Draw Glowing Bounding Box
                ctx.strokeStyle = "rgba(6, 182, 212, 0.8)";
                ctx.lineWidth = 3;
                ctx.shadowBlur = 8;
                ctx.shadowColor = "rgb(6, 182, 212)";
                ctx.strokeRect(x, y, width, height);
                
                // Reset shadow for text
                ctx.shadowBlur = 0;
                
                // Draw Bounding Box Label
                ctx.fillStyle = "rgba(6, 182, 212, 0.85)";
                ctx.font = "bold 14px 'Space Grotesk', sans-serif";
                const labelText = `${className.toUpperCase()} (${confidence}%)`;
                const textWidth = ctx.measureText(labelText).width;
                
                ctx.fillRect(x, y > 25 ? y - 25 : y, textWidth + 14, 25);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(labelText, x + 7, y > 25 ? y - 8 : y + 17);
                
                // Determine Object Direction (Spatial Mapping)
                const centerX = x + width / 2;
                const frameWidth = canvasElement.width;
                let direction = "center";
                let panValue = 0.0; // 3D Audio pan value (-1 left, +1 right)
                
                if (centerX < frameWidth * 0.4) {
                    direction = "left";
                    panValue = -0.8;
                } else if (centerX > frameWidth * 0.6) {
                    direction = "right";
                    panValue = 0.8;
                }
                
                // Estimate object size/distance
                // Larger bounding box area means the object is closer to the user
                const boxArea = (width * height) / (canvasElement.width * canvasElement.height);
                const isClose = boxArea > 0.08; // threshold for "dangerous/close" objects
                
                const objectData = {
                    name: className,
                    direction: direction,
                    pan: panValue,
                    isClose: isClose,
                    score: prediction.score
                };
                
                // Track the closest or highest confidence danger object
                if (isClose && (!highestRiskObject || boxArea > (highestRiskObject.width * highestRiskObject.height))) {
                    highestRiskObject = prediction;
                    highestRiskObject.meta = objectData;
                } else if (!highestRiskObject && (className === "person" || className === "car" || className === "motorcycle")) {
                    highestRiskObject = prediction;
                    highestRiskObject.meta = objectData;
                }
            }
        });
        
        statCount.innerText = detectedCount;
        
        // Handle Alarms & Speech Synthesis Warnings
        if (highestRiskObject) {
            const meta = highestRiskObject.meta;
            
            // Show red warnings on screen if object is close
            if (meta.isClose) {
                guidanceOverlay.classList.remove('hidden');
                guidanceText.innerText = `WARNING: ${meta.name.toUpperCase()} directly ahead on the ${meta.direction}!`;
            } else {
                guidanceOverlay.classList.add('hidden');
            }
            
            // Trigger 3D Spatial Audio and Speech Text
            triggerAudioWarning(meta);
        } else {
            guidanceOverlay.classList.add('hidden');
        }
        
    } catch (error) {
        console.error("Error during detection loop:", error);
    }
    
    // Continue loop
    if (isStreaming) {
        detectionLoopId = requestAnimationFrame(detectFrame);
    }
}

// 3D Spatial Audio & Voice Generator
function triggerAudioWarning(obj) {
    const now = performance.now();
    
    // Check speech toggle and cooldown to avoid voice overlapping
    if (chkAudio.checked && (now - lastSpeechTime > SPEECH_COOLDOWN_MS)) {
        
        // Initialize Web Audio Context if not done yet
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // 1. Play Spatial Stereo Beep
        playSpatialBeep(obj.pan, obj.isClose);
        
        // 2. Log event in English
        const dangerPrefix = obj.isClose ? "DANGER: " : "Detected: ";
        const logType = obj.isClose ? "alert" : "warning";
        addLog(`${dangerPrefix}${obj.name} on the ${obj.direction}.`, logType);
        
        // 3. Web Speech API (Text-to-Speech)
        let warningText = "";
        if (obj.isClose) {
            warningText = `Warning, ${obj.name} close on your ${obj.direction}!`;
        } else {
            warningText = `${obj.name} on your ${obj.direction}.`;
        }
        
        const utterance = new SpeechSynthesisUtterance(warningText);
        utterance.lang = 'en-US'; // Set language to English
        utterance.rate = parseFloat(rangeRate.value); // voice speed
        
        // Find an English voice if available
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(voice => voice.lang.includes('en'));
        if (enVoice) {
            utterance.voice = enVoice;
        }
        
        window.speechSynthesis.speak(utterance);
        
        // Update states
        lastSpeechTime = now;
        lastSpokenObject = obj.name;
    }
}

// Web Audio API Stereo Panner Beep Generator
function playSpatialBeep(panValue, isHighRisk) {
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        let pannerNode;
        
        // Create stereo panner node to direct audio to left/right channel
        if (audioCtx.createStereoPanner) {
            pannerNode = audioCtx.createStereoPanner();
            pannerNode.pan.value = panValue; // -1.0 (left) to 1.0 (right)
        } else {
            // Fallback for Safari/Legacy browsers
            pannerNode = audioCtx.createPanner();
            pannerNode.panningModel = 'HRTF';
            pannerNode.setPosition(panValue, 0, 1 - Math.abs(panValue));
        }
        
        // Beep frequency: High risk gets high pitch double beep, low risk gets soft deep beep
        const freq = isHighRisk ? 1200 : 600;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.type = isHighRisk ? 'sawtooth' : 'sine';
        
        // Volume envelopes
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (isHighRisk ? 0.15 : 0.3));
        
        // Connect nodes
        osc.connect(pannerNode);
        pannerNode.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + (isHighRisk ? 0.15 : 0.3));
        
        // If high risk, play a second immediate double-beep
        if (isHighRisk) {
            setTimeout(() => {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.frequency.setValueAtTime(freq, audioCtx.currentTime);
                osc2.type = 'sawtooth';
                gain2.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                osc2.connect(pannerNode);
                gain2.connect(audioCtx.destination);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.15);
            }, 180);
        }
    } catch (e) {
        console.error("Audio beep generation error:", e);
    }
}

// Helper: Add log entry to UI panel
function addLog(message, type = "info") {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logElement = document.createElement('div');
    logElement.className = `log-entry ${type}`;
    logElement.innerHTML = `[${time}] ${message}`;
    
    logsList.appendChild(logElement);
    
    // Auto scroll to bottom
    logsList.scrollTop = logsList.scrollHeight;
    
    // Limit logs length to last 50 entries
    while (logsList.children.length > 50) {
        logsList.removeChild(logsList.firstChild);
    }
}

// Reload speech voice list in Chrome/Opera
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        // trigger loading voice lists implicitly
    };
}
