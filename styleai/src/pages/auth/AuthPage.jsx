import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import AuthCard from "../../components/AuthCard";
import { auth, db } from "../../firebase/firebase";

function AuthPage() {
  const navigate = useNavigate();

  const handleRedirect = async (user) => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.avatarUrl) {
          navigate("/home", { replace: true });
          return;
        }
      }
      // If no avatarUrl, go to onboarding
      navigate("/onboarding", { replace: true });
    } catch (error) {
      console.error("Error checking user profile:", error);
      navigate("/onboarding", { replace: true });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        handleRedirect(user);
      }
    });

    return unsubscribe;
  }, [navigate]);

  return (
    <main className="single-panel">
      <AuthCard onAuthenticated={handleRedirect} />
    </main>
  );
}

export default AuthPage;
