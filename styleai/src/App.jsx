import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate, Route, Routes } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import AuthPage from "./pages/auth/AuthPage";
import { auth } from "./firebase/firebase";
import GenerateModel from "./pages/GenerateModel";
import GenerateOutfit from "./pages/GenerateOutfit";
import Discover from "./pages/Discover";
import Home from "./pages/Home";
import Me from "./pages/Me";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import Wardrobe from "./pages/wardrobe/Wardrobe";
import Wishlist from "./pages/Wishlist";

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  return user ? children : null;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generate-model"
        element={
          <ProtectedRoute>
            <GenerateModel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generate-outfit"
        element={
          <ProtectedRoute>
            <GenerateOutfit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <Discover />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wardrobe"
        element={
          <ProtectedRoute>
            <Wardrobe />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wishlist"
        element={
          <ProtectedRoute>
            <Wishlist />
          </ProtectedRoute>
        }
      />
      <Route
        path="/me"
        element={
          <ProtectedRoute>
            <Me />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
