import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate, useNavigate } from "react-router-dom";
import BodyDetailsStep from "../../components/BodyDetailsStep";
import ImageUploadStep from "../../components/ImageUploadStep";
import { auth } from "../../firebase/firebase";
import FaceScan from "./FaceScan";

function OnboardingPage() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [faceScanResult, setFaceScanResult] = useState(null);
  const [bodyPhotos, setBodyPhotos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (loadingAuth) {
    return <main className="single-panel">Checking your session...</main>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <main className="app-shell onboarding-shell">
      <section className="hero-panel">
        <p className="eyebrow">/onboarding</p>
        <h1>Complete your profile in 3 steps</h1>
        <p className="hero-copy">
          Step 1 Face scan, Step 2 full-body photos, Step 3 body details.
        </p>
        <div className="hero-badges">
          <span className={faceScanResult ? "done" : ""}>Step 1</span>
          <span className={bodyPhotos.length ? "done" : ""}>Step 2</span>
          <span>Step 3</span>
        </div>
      </section>

      <section className="flow-panel">
        {!faceScanResult ? (
          <FaceScan user={user} onComplete={setFaceScanResult} />
        ) : null}

        {faceScanResult && !bodyPhotos.length ? (
          <ImageUploadStep
            user={user}
            faceScanResult={faceScanResult}
            onComplete={setBodyPhotos}
          />
        ) : null}

        {faceScanResult && bodyPhotos.length ? (
          <BodyDetailsStep
            user={user}
            onComplete={() => navigate("/generate-model")}
          />
        ) : null}
      </section>
    </main>
  );
}

export default OnboardingPage;
