import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import AuthCard from "../../components/AuthCard";
import { auth } from "../../firebase/firebase";

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/onboarding", { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  return (
    <main className="single-panel">
      <AuthCard onAuthenticated={() => navigate("/onboarding", { replace: true })} />
    </main>
  );
}

export default AuthPage;
