/**
 * Pose Detector - Real MediaPipe pose detection integration
 * Uses camera to detect user pose and extract hand positions for bubble popping
 */
class PoseDetector {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // MediaPipe components
    this.pose = null;
    this.poseCanvas = null;
    this.camera = null;
    this.poseCtx = null;
    this.videoElement = null;
    this.pictogramMode = false; // pictogram overlay toggle

    // Hand tracking state
    this.handPositions = {
      leftHand: { x: 0, y: 0, visible: false },
      rightHand: { x: 0, y: 0, visible: false },
    };

    // Configuration
    this.config = {
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      smoothingFactor: 0.7,
      enableSegmentation: false,
      smoothLandmarks: true,
    };

    // Callbacks
    this.onHandMove = null;
    this.onPoseDetected = null;

    // Smoothing for hand positions
    this.smoothedPositions = {
      leftHand: { x: 0, y: 0 },
      rightHand: { x: 0, y: 0 },
    };

    // Pose visualization
    this.showPoseOverlay = true;
    this.poseCanvas = null;
    this.poseCtx = null;

    // Hand data tracker
    this.handDataTracker = null;

    this.isInitialized = false;
  }

  /**
   * Initialize MediaPipe pose detection with camera
   */
  async init() {
    try {
      console.log('Initializing MediaPipe pose detection...');
      
      // Initialize hand data tracker
      if (window.HandDataTracker) {
        this.handDataTracker = new window.HandDataTracker();
      }
      
      if (!(window.Pose && window.Camera && window.drawConnectors)) {
        throw new Error('MediaPipe scripts not loaded. Check index.html local paths.');
      }
      await this.setupCamera();
      await this.initializeMediaPipe();
      this.createPoseOverlay();
      await this.startPoseDetection();
      this.isInitialized = true;
      console.log('MediaPipe pose detection initialized successfully');
      console.log('Move your hands in front of the camera to control the game!');
      return true;
    } catch (err) {
      console.error('Failed to initialize MediaPipe pose detection:', err);
      console.log('Falling back to mouse control...');
      
      // Initialize data tracker even in mouse mode
      if (window.HandDataTracker && !this.handDataTracker) {
        this.handDataTracker = new window.HandDataTracker();
      }
      
      this.setupMouseFallback();
      return true;
    }
  }

  /**
   * Stop camera and release resources
   */
  stop() {
    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject;
      const tracks = stream.getTracks();
      
      tracks.forEach(track => {
        track.stop();
        console.log(`Stopped camera track: ${track.kind}`);
      });
      
      this.videoElement.srcObject = null;
    }
    
    if (this.camera) {
      // MediaPipe Camera util doesn't have a public stop method, 
      // but stopping the source stream is usually enough
      this.camera = null;
    }
  }

  /**
   * Set up camera for pose detection - using side panel
   */
  async setupCamera() {
    // Ensure old stream is cleaned up first
    this.stop();

    // Use video element in side panel
    this.videoElement = document.getElementById("pose-video");
    if (!this.videoElement) {
      throw new Error("Pose video element not found in panel");
    }

    // Get camera stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      this.videoElement.srcObject = stream;
      console.log("Camera access granted");

      // Clean up on page unload
      window.addEventListener('beforeunload', () => {
        this.stop();
      });

      return new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error("Camera access denied:", error);
      
      let errorMessage = "Camera access required for pose detection";
      
      if (error.name === 'NotReadableError' || error.message.includes('Device in use')) {
        errorMessage = "Camera is in use by another program (NotReadableError). Please close other programs using the camera (e.g., Zoom, Teams, or other browser tabs) and refresh the page.";
        alert(errorMessage);
      } else if (error.name === 'NotAllowedError') {
        errorMessage = "Camera access denied. Please allow camera access in browser settings.";
        alert(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Initialize MediaPipe Pose
   */
  async initializeMediaPipe() {
    // Wait for MediaPipe to be available
    let attempts = 0;
    while (typeof window.Pose === "undefined" && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (typeof window.Pose === "undefined") {
      throw new Error("MediaPipe Pose not available");
    }

    // Create Pose instance
    this.pose = new window.Pose({
      locateFile: (file) => `vendor/mediapipe/pose/${file}`  // local files
    });

    // Configure pose detection
    this.pose.setOptions({
      modelComplexity: this.config.modelComplexity,
      smoothLandmarks: this.config.smoothLandmarks,
      enableSegmentation: this.config.enableSegmentation,
      smoothSegmentation: true,
      minDetectionConfidence: this.config.minDetectionConfidence,
      minTrackingConfidence: this.config.minTrackingConfidence,
    });

    // Set up results callback
    this.pose.onResults(this.onPoseResults.bind(this));

    console.log("MediaPipe Pose initialized");
  }

  /**
   * Create pose visualization overlay - using side panel
   */
  createPoseOverlay() {
    // Use canvas element in side panel
    this.poseCanvas = document.getElementById("pose-canvas");
    if (!this.poseCanvas) {
      throw new Error("Pose canvas element not found in panel");
    }
    
    // Set canvas dimensions
    this.poseCanvas.width = 320;
    this.poseCanvas.height = 240;
    this.poseCtx = this.poseCanvas.getContext("2d");

    console.log("Pose visualization overlay created");
  }

  /**
   * Start pose detection
   */
  async startPoseDetection() {
    // Wait for MediaPipe Camera to be available
    let attempts = 0;
    while (typeof window.Camera === "undefined" && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (typeof window.Camera === "undefined") {
      // Fallback to manual frame processing
      this.startManualProcessing();
      return;
    }

    // Use MediaPipe Camera utility
    this.camera = new window.Camera(this.videoElement, {
      onFrame: async () => {
        await this.pose.send({ image: this.videoElement });
      },
      width: 640,
      height: 480,
    });

    await this.camera.start();
    console.log("Pose detection started");
  }

  /**
   * Manual frame processing fallback
   */
  startManualProcessing() {
    const processFrame = async () => {
      if (this.videoElement.readyState >= 2) {
        await this.pose.send({ image: this.videoElement });
      }
      requestAnimationFrame(processFrame);
    };

    processFrame();
    console.log("Manual pose processing started");
  }

  /**
   * Handle pose detection results - fix mirror issue
   */
  onPoseResults(results) {
    // Clear pose overlay
    if (this.poseCtx) {
      this.poseCtx.clearRect(
        0,
        0,
        this.poseCanvas.width,
        this.poseCanvas.height
      );
      
      // Apply mirror transform to canvas drawing
      this.poseCtx.save();
      this.poseCtx.scale(-1, 1);
      this.poseCtx.translate(-this.poseCanvas.width, 0);
    }

    // Draw pose landmarks if available
    if (results.poseLandmarks && this.showPoseOverlay) {
      if (this.pictogramMode) {
        this.drawPictogram(results.poseLandmarks);
      } else {
        this.drawPoseLandmarks(results.poseLandmarks);
      }
    }

    // Extract hand positions (no mirror, use raw coordinates)
    if (results.poseLandmarks) {
      this.updateHandPositions(results.poseLandmarks);
    }

    if (this.poseCtx) {
      this.poseCtx.restore();
    }

    // Trigger pose detected callback
    if (this.onPoseDetected) {
      this.onPoseDetected(results);
    }
  }

  /**
   * Draw pose landmarks on overlay
   */
  drawPoseLandmarks(landmarks) {
    if (!this.poseCtx || !window.drawConnectors || !window.drawLandmarks)
      return;

    // Draw connections
    window.drawConnectors(this.poseCtx, landmarks, window.POSE_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 2,
    });

    // Draw landmarks
    window.drawLandmarks(this.poseCtx, landmarks, {
      color: "#FF0000",
      lineWidth: 1,
      radius: 3,
    });

    // Highlight hands
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (leftWrist && leftWrist.visibility > 0.5) {
      this.poseCtx.beginPath();
      this.poseCtx.arc(
        leftWrist.x * this.poseCanvas.width,
        leftWrist.y * this.poseCanvas.height,
        8,
        0,
        2 * Math.PI
      );
      this.poseCtx.fillStyle = "#00FF00";
      this.poseCtx.fill();
    }

    if (rightWrist && rightWrist.visibility > 0.5) {
      this.poseCtx.beginPath();
      this.poseCtx.arc(
        rightWrist.x * this.poseCanvas.width,
        rightWrist.y * this.poseCanvas.height,
        8,
        0,
        2 * Math.PI
      );
      this.poseCtx.fillStyle = "#0000FF";
      this.poseCtx.fill();
    }
  }

  /**
   * Draw Tokyo2020-style pictogram visualization
   * Based on the original Tokyo2020-Pictogram-using-MediaPipe project
   */
  drawPictogram(landmarks) {
    if (!this.poseCtx) return;
    const ctx = this.poseCtx;
    const w = this.poseCanvas.width;
    const h = this.poseCanvas.height;
    const visibilityThreshold = 0.5;

    // Tokyo2020 authentic colors - use more visible contrast colors
    const bgColor = "#643321"; // Tokyo2020 brown background
    const figureColor = "#FFFFFF"; // White figure

    // Clear with Tokyo2020 background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Convert landmarks to pixel coordinates with visibility
    const landmarkPoints = landmarks.map((landmark, index) => ({
      index,
      visibility: landmark.visibility || 1,
      x: Math.min(Math.floor(landmark.x * w), w - 1),
      y: Math.min(Math.floor(landmark.y * h), h - 1),
      z: landmark.z || 0,
    }));

    // Adjust leg root positions to hip center (Tokyo2020 style)
    const rightLeg = landmarkPoints[23];
    const leftLeg = landmarkPoints[24];
    if (rightLeg && leftLeg) {
      const legCenterX = Math.floor((rightLeg.x + leftLeg.x) / 2);
      const legCenterY = Math.floor((rightLeg.y + leftLeg.y) / 2);
      landmarkPoints[23].x = legCenterX;
      landmarkPoints[23].y = legCenterY;
      landmarkPoints[24].x = legCenterX;
      landmarkPoints[24].y = legCenterY;
    }

    // Calculate face circle (Tokyo2020 style)
    const faceIndices = [1, 4, 7, 8, 9, 10];
    const facePoints = faceIndices
      .map((i) => landmarkPoints[i])
      .filter((p) => p && p.visibility > visibilityThreshold);

    if (facePoints.length > 0) {
      // Calculate face center and radius
      const faceX =
        facePoints.reduce((sum, p) => sum + p.x, 0) / facePoints.length;
      const faceY =
        facePoints.reduce((sum, p) => sum + p.y, 0) / facePoints.length;
      const faceRadius = Math.max(
        15,
        Math.min(
          facePoints.reduce((max, p) => {
            const dist = Math.sqrt((p.x - faceX) ** 2 + (p.y - faceY) ** 2);
            return Math.max(max, dist);
          }, 0) * 1.5,
          40
        )
      );

      // Draw face circle (Tokyo2020 style)
      ctx.fillStyle = figureColor;
      ctx.beginPath();
      ctx.arc(faceX, faceY, faceRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Calculate stick radii based on face size (Tokyo2020 proportions)
      const stickRadius1 = Math.floor(faceRadius * 0.8);
      const stickRadius2 = Math.floor(stickRadius1 * 0.75);
      const stickRadius3 = Math.floor(stickRadius2 * 0.75);

      // Draw limbs (Tokyo2020 stick figure style)
      const drawList = [11, 12, 23, 24]; // Right arm, left arm, right leg, left leg

      // Sort by z-depth for proper layering
      const sortedPoints = [...landmarkPoints].sort((a, b) => b.z - a.z);

      for (const point of sortedPoints) {
        if (drawList.includes(point.index) && landmarkPoints[point.index + 4]) {
          const point1 = landmarkPoints[point.index];
          const point2 = landmarkPoints[point.index + 2];
          const point3 = landmarkPoints[point.index + 4];

          // Draw upper limb segment
          if (
            point1 &&
            point2 &&
            point1.visibility > visibilityThreshold &&
            point2.visibility > visibilityThreshold
          ) {
            this.drawTokyoStick(
              ctx,
              { x: point1.x, y: point1.y },
              stickRadius1,
              { x: point2.x, y: point2.y },
              stickRadius2,
              figureColor
            );
          }

          // Draw lower limb segment
          if (
            point2 &&
            point3 &&
            point2.visibility > visibilityThreshold &&
            point3.visibility > visibilityThreshold
          ) {
            this.drawTokyoStick(
              ctx,
              { x: point2.x, y: point2.y },
              stickRadius2,
              { x: point3.x, y: point3.y },
              stickRadius3,
              figureColor
            );
          }
        }
      }
    }
  }

  /**
   * Draw stick segment (Tokyo2020 authentic style)
   * Replicates the exact algorithm from the original Python project
   */
  drawTokyoStick(ctx, point1, radius1, point2, radius2, color) {
    // Draw joint circles first
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point1.x, point1.y, radius1, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point2.x, point2.y, radius2, 0, 2 * Math.PI);
    ctx.fill();

    // Calculate connecting stick polygon (Tokyo2020 method)
    const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x);

    const drawPoints = [];
    for (let i = 0; i < 2; i++) {
      const rad = angle + Math.PI / 2 + Math.PI * i;

      // Points for first circle
      const point1X = Math.floor(radius1 * Math.cos(rad)) + point1.x;
      const point1Y = Math.floor(radius1 * Math.sin(rad)) + point1.y;
      drawPoints.push({ x: point1X, y: point1Y });

      // Points for second circle
      const point2X = Math.floor(radius2 * Math.cos(rad)) + point2.x;
      const point2Y = Math.floor(radius2 * Math.sin(rad)) + point2.y;
      drawPoints.push({ x: point2X, y: point2Y });
    }

    // Draw the connecting polygon (Tokyo2020 style)
    ctx.beginPath();
    ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
    ctx.lineTo(drawPoints[1].x, drawPoints[1].y);
    ctx.lineTo(drawPoints[3].x, drawPoints[3].y);
    ctx.lineTo(drawPoints[2].x, drawPoints[2].y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Toggle pictogram mode
   */
  togglePictogramMode() {
    this.pictogramMode = !this.pictogramMode;
    console.log(
      `Pictogram mode ${this.pictogramMode ? "enabled" : "disabled"}`
    );
    return this.pictogramMode;
  }

  /**
   * Update hand positions from pose landmarks - bubble popping logic
   */
  updateHandPositions(landmarks) {
    // MediaPipe landmark indices for hands
    const LEFT_WRIST = 15;
    const RIGHT_WRIST = 16;
    const LEFT_INDEX = 19;  // Left index finger tip
    const RIGHT_INDEX = 20; // Right index finger tip

    // Bubble popping rule: use wrist position (for Tokyo2020 pictogram which has no fingers)
    
    // Update left hand position - use wrist directly
    const leftWrist = landmarks[LEFT_WRIST];
    let leftHandPoint = null;
    
    if (leftWrist && leftWrist.visibility > 0.5) {
      // Use wrist position (Tokyo2020 pictogram hand position)
      leftHandPoint = leftWrist;
    }
    
    if (leftHandPoint) {
      // Restore mirror transform - MediaPipe coordinates need mirroring to match user intuition
      const x = leftHandPoint.x * this.canvasWidth;
      const y = leftHandPoint.y * this.canvasHeight;

      this.handPositions.leftHand = {
        x: this.canvasWidth - x, // Mirror x coordinate so right hand appears on right side
        y: y,
        visible: true,
        confidence: leftHandPoint.visibility,
        type: 'wrist'
      };
    } else {
      this.handPositions.leftHand.visible = false;
    }

    // Update right hand position - use wrist directly
    const rightWrist = landmarks[RIGHT_WRIST];
    let rightHandPoint = null;
    
    if (rightWrist && rightWrist.visibility > 0.5) {
      // Use wrist position (Tokyo2020 pictogram hand position)
      rightHandPoint = rightWrist;
    }
    
    if (rightHandPoint) {
      // Restore mirror transform - MediaPipe coordinates need mirroring to match user intuition
      const x = rightHandPoint.x * this.canvasWidth;
      const y = rightHandPoint.y * this.canvasHeight;

      this.handPositions.rightHand = {
        x: this.canvasWidth - x, // Mirror x coordinate so right hand appears on right side
        y: y,
        visible: true,
        confidence: rightHandPoint.visibility,
        type: 'wrist'
      };
    } else {
      this.handPositions.rightHand.visible = false;
    }

    // Apply smoothing
    this.applySmoothingToHands();
    
    // Update hand data tracking
    if (this.handDataTracker) {
      this.handDataTracker.updateHandPosition(
        'leftHand', 
        this.smoothedPositions.leftHand.x, 
        this.smoothedPositions.leftHand.y, 
        this.handPositions.leftHand.visible
      );
      this.handDataTracker.updateHandPosition(
        'rightHand', 
        this.smoothedPositions.rightHand.x, 
        this.smoothedPositions.rightHand.y, 
        this.handPositions.rightHand.visible
      );
    }
    
    // Update UI status
    this.updateHandStatus();

    // Trigger hand move callback
    if (this.onHandMove) {
      
      this.onHandMove({
        leftHand: { 
          x: this.smoothedPositions.leftHand.x, 
          y: this.smoothedPositions.leftHand.y, 
          visible: this.handPositions.leftHand.visible 
        },
        rightHand: { 
          x: this.smoothedPositions.rightHand.x, 
          y: this.smoothedPositions.rightHand.y, 
          visible: this.handPositions.rightHand.visible 
        }
      });
    }
  }
  
  /**
   * Update hand status display - includes coordinate debug info
   */
  updateHandStatus() {
    const leftStatus = document.getElementById('left-hand-status');
    const rightStatus = document.getElementById('right-hand-status');
    const gestureStatus = document.getElementById('gesture-status');
    
    if (leftStatus) {
      if (this.handPositions.leftHand.visible) {
        const icon = '✋'; // Tokyo2020 pictogram only has wrist, show palm
        const x = Math.round(this.handPositions.leftHand.x);
        const y = Math.round(this.handPositions.leftHand.y);
        leftStatus.textContent = `${icon} (${x},${y})`;
        leftStatus.className = 'active';
      } else {
        leftStatus.textContent = '❌';
        leftStatus.className = '';
      }
    }
    
    if (rightStatus) {
      if (this.handPositions.rightHand.visible) {
        const icon = this.handPositions.rightHand.type === 'mouse' ? '🖱️' : '✋';
        const x = Math.round(this.handPositions.rightHand.x);
        const y = Math.round(this.handPositions.rightHand.y);
        rightStatus.textContent = `${icon} (${x},${y})`;
        rightStatus.className = 'active';
      } else {
        rightStatus.textContent = '❌';
        rightStatus.className = '';
      }
    }
    
    if (gestureStatus) {
      const activeHands = [this.handPositions.leftHand.visible, this.handPositions.rightHand.visible].filter(Boolean).length;
      if (activeHands > 0) {
        gestureStatus.textContent = `Detected ${activeHands} hand(s)`;
        gestureStatus.style.color = '#4CAF50';
      } else {
        gestureStatus.textContent = 'No gesture detected';
        gestureStatus.style.color = '#757575';
      }
    }
  }

  /**
   * Apply smoothing to hand positions for stable tracking
   */
  applySmoothingToHands() {
    const factor = this.config.smoothingFactor;

    // Smooth left hand
    if (this.handPositions.leftHand.visible) {
      this.smoothedPositions.leftHand.x =
        this.smoothedPositions.leftHand.x * factor +
        this.handPositions.leftHand.x * (1 - factor);
      this.smoothedPositions.leftHand.y =
        this.smoothedPositions.leftHand.y * factor +
        this.handPositions.leftHand.y * (1 - factor);
    }

    // Smooth right hand
    if (this.handPositions.rightHand.visible) {
      this.smoothedPositions.rightHand.x =
        this.smoothedPositions.rightHand.x * factor +
        this.handPositions.rightHand.x * (1 - factor);
      this.smoothedPositions.rightHand.y =
        this.smoothedPositions.rightHand.y * factor +
        this.handPositions.rightHand.y * (1 - factor);
    }
  }

  /**
   * Set up mouse fallback for testing without camera
   */
  setupMouseFallback() {
    console.log("Setting up mouse fallback for pose detection");

    // Get canvas element to track mouse
    const canvas = document.getElementById("game-canvas") || document.getElementById("test-canvas");
    if (!canvas) {
      console.error("Canvas not found for mouse fallback");
      return;
    }

    // Track mouse movement
    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      // Simulate right hand position - keep consistent with gesture detection coordinate system
      this.handPositions.rightHand = {
        x: x,
        y: y,
        visible: true,
        type: 'mouse'
      };

      // Update smoothed positions immediately for better responsiveness
      this.smoothedPositions.rightHand.x = x;
      this.smoothedPositions.rightHand.y = y;

      this.handPositions.leftHand.visible = false;

      // Update data tracking (mouse mode)
      if (this.handDataTracker) {
        this.handDataTracker.updateHandPosition('rightHand', x, y, true);
        this.handDataTracker.updateHandPosition('leftHand', 0, 0, false);
      }

      // Trigger hand move callback for bubble interaction
      if (this.onHandMove) {
        this.onHandMove({
          leftHand: { x: 0, y: 0, visible: false },
          rightHand: { x: x, y: y, visible: true }
        });
      }
    });

    // Track mouse clicks as attempts
    canvas.addEventListener("click", (event) => {
      // Record attempt in game result manager
      if (window.gameResultManager) {
        window.gameResultManager.recordAttempt();
      }
    });

    // Track touch events as attempts (for mobile)
    canvas.addEventListener("touchstart", (event) => {
      // Record attempt in game result manager
      if (window.gameResultManager) {
        window.gameResultManager.recordAttempt();
      }
    });

    // Hide hand when mouse leaves canvas
    canvas.addEventListener("mouseleave", () => {
      this.handPositions.rightHand.visible = false;
      this.handPositions.leftHand.visible = false;
      
      // Update data tracking - mouse left
      if (this.handDataTracker) {
        this.handDataTracker.updateHandPosition('rightHand', 0, 0, false);
        this.handDataTracker.updateHandPosition('leftHand', 0, 0, false);
      }
      
      if (this.onHandMove) {
        this.onHandMove({
          leftHand: { x: 0, y: 0, visible: false },
          rightHand: { x: 0, y: 0, visible: false }
        });
      }
    });

    // Show hand cursor for better UX
    canvas.style.cursor = "crosshair";

    console.log("Mouse fallback initialized - move mouse over canvas to pop bubbles!");
  }

  /**
   * Toggle pose overlay visibility
   */
  togglePoseOverlay() {
    this.showPoseOverlay = !this.showPoseOverlay;
    if (this.poseCanvas) {
      this.poseCanvas.style.display = this.showPoseOverlay ? "block" : "none";
    }
    if (this.videoElement) {
      this.videoElement.style.display = this.showPoseOverlay ? "block" : "none";
    }
    console.log(
      `Pose overlay ${this.showPoseOverlay ? "enabled" : "disabled"}`
    );
  }

  /**
   * Get current hand positions
   */
  getHandPositions() {
    return {
      leftHand: {
        ...this.smoothedPositions.leftHand,
        visible: this.handPositions.leftHand.visible,
      },
      rightHand: {
        ...this.smoothedPositions.rightHand,
        visible: this.handPositions.rightHand.visible,
      },
    };
  }

  /**
   * Set callback for hand movement
   */
  setHandMoveCallback(callback) {
    this.onHandMove = callback;
  }

  /**
   * Set callback for pose detection
   */
  setPoseDetectedCallback(callback) {
    this.onPoseDetected = callback;
  }

  /**
   * Check if a point (hand) intersects with a circle (bubble)
   */
  checkBubbleCollision(handX, handY, bubbleX, bubbleY, bubbleRadius) {
    const distance = Math.sqrt(
      Math.pow(handX - bubbleX, 2) + Math.pow(handY - bubbleY, 2)
    );

    // Add some tolerance for easier interaction
    const tolerance = 20;
    return distance <= bubbleRadius + tolerance;
  }

  /**
   * Update canvas dimensions
   */
  updateCanvasDimensions(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Stop camera
    if (this.camera && this.camera.stop) {
      this.camera.stop();
    }

    // Stop video stream
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    }

    // Remove elements
    if (this.videoElement) {
      document.body.removeChild(this.videoElement);
    }

    if (this.poseCanvas) {
      document.body.removeChild(this.poseCanvas);
    }

    this.isInitialized = false;
    console.log("Pose detector destroyed");
  }
}

// Export for use in other modules
window.PoseDetector = PoseDetector;