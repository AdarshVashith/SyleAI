import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { uploadToCloudinary } from "../../utils/cloudinary";
const MODEL_URL = "/models";

function FaceScan({ user, onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (error) {
        setError("Failed to load face detection models. Please refresh.");
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    if (!modelsLoaded) {
      return undefined;
    }

    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user"
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (cameraError) {
        setError("Could not access webcam. Please allow camera permission.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [modelsLoaded]);

  const extractSkinTone = (canvas, box) => {
    const context = canvas.getContext("2d");
    const centerX = Math.floor(box.x + box.width / 2);
    const centerY = Math.floor(box.y + box.height / 2.5);
    const pixel = context.getImageData(centerX, centerY, 1, 1).data;
    const red = pixel[0].toString(16).padStart(2, "0");
    const green = pixel[1].toString(16).padStart(2, "0");
    const blue = pixel[2].toString(16).padStart(2, "0");
    return `#${red}${green}${blue}`;
  };

  const estimateFaceShape = (landmarks) => {
    const jaw = landmarks.getJawOutline();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const faceWidth = Math.abs(jaw[16].x - jaw[0].x);
    const faceHeight = Math.abs(jaw[8].y - leftEye[0].y);
    const jawWidth = Math.abs(jaw[12].x - jaw[4].x);
    const foreheadWidth = Math.abs(rightEye[3].x - leftEye[0].x) * 1.5;
    const ratio = faceWidth / faceHeight;

    if (ratio > 0.88) {
      return "Round";
    }

    if (jawWidth < foreheadWidth * 0.75) {
      return "Heart";
    }

    if (jawWidth > foreheadWidth * 0.9) {
      return "Square";
    }

    return "Oval";
  };

  const handleScan = async () => {
    setError(null);
    setCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        throw new Error("Camera is not ready yet.");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0);

      const imageDataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImage(imageDataUrl);
      setCapturing(false);
      setAnalyzing(true);

      let facePhotoUrl = "";
      try {
        facePhotoUrl = await uploadToCloudinary(imageDataUrl, "styleai/face-scans");
      } catch (error) {
        throw new Error("Failed to upload image. Please try again.");
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Detection timed out")), 15000);
      });

      const detectionPromise = faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const detection = await Promise.race([detectionPromise, timeoutPromise]);

      if (!detection) {
        throw new Error("No face detected. Please center your face and ensure good lighting.");
      }

      const skinTone = extractSkinTone(canvas, detection.detection.box);
      const faceShape = estimateFaceShape(detection.landmarks);
      const [dominantExpression, confidence] = Object.entries(detection.expressions).sort(
        (left, right) => right[1] - left[1]
      )[0];
      const expressions = Object.fromEntries(
        Object.entries(detection.expressions).map(([key, value]) => [key, Number(value)])
      );

      const analysisResults = {
        skinTone,
        faceShape,
        dominantExpression,
        confidence,
        expressions,
        faceScanDone: true,
        faceScanAt: new Date().toISOString(),
        preview: imageDataUrl,
        facePhotoUrl
      };

      setResults(analysisResults);
      setAnalyzing(false);
      await setDoc(
        doc(db, "users", user.uid),
        {
          skinTone: analysisResults.skinTone,
          faceShape: analysisResults.faceShape,
          dominantExpression: analysisResults.dominantExpression,
          facePhotoUrl: analysisResults.facePhotoUrl,
          faceScanDone: true
        },
        { merge: true }
      );
      await onComplete(analysisResults);
    } catch (error) {
      setError(error.message);
      setCapturing(false);
      setAnalyzing(false);
    }
  };

  return (
    <section className="card face-card">
      <p className="eyebrow">Step 1</p>
      <h2>Scan your face</h2>
      <p className="muted">
        Signed in as {user.email}. We analyze your face locally to estimate skin
        tone, face shape, and expression before you continue.
      </p>

      {!modelsLoaded ? (
        <div className="loading-row">
          <div className="spinner" />
          <span>Loading face detection models...</span>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="scan-layout">
        <div>
          <div className="camera-shell">
            <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
          </div>
          <canvas ref={canvasRef} className="hidden-canvas" />

          <button
            type="button"
            className="primary-button scan-button"
            onClick={handleScan}
            disabled={!modelsLoaded || capturing || analyzing}
          >
            {!modelsLoaded
              ? "Loading models..."
              : capturing
                ? "Capturing..."
                : analyzing
                  ? "Analyzing face..."
                  : "Capture and analyze"}
          </button>
        </div>

        <div className="result-panel">
          {capturedImage ? (
            <div className="result-card">
              <p className="result-title">Captured photo</p>
              <img src={capturedImage} alt="Captured" className="result-image" />
            </div>
          ) : null}

          {results ? (
            <div className="result-card">
              <p className="result-title">Analysis results</p>
              <div className="result-row">
                <div className="swatch" style={{ backgroundColor: results.skinTone }} />
                <div>
                  <p className="result-label">Skin tone</p>
                  <p className="result-value">{results.skinTone}</p>
                </div>
              </div>
              <div className="result-row">
                <div>
                  <p className="result-label">Face shape</p>
                  <p className="result-value">{results.faceShape}</p>
                </div>
              </div>
              <div className="result-row">
                <div>
                  <p className="result-label">Dominant expression</p>
                  <p className="result-value">{results.dominantExpression}</p>
                </div>
              </div>
              <div className="success-pill">Face scan complete. Continue to Step 2.</div>
            </div>
          ) : null}

          {!results && !capturedImage ? (
            <div className="result-card placeholder-card">
              No face scan saved yet. Capture your photo to begin analysis.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default FaceScan;
