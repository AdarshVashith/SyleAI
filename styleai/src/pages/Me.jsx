import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { BottomTabNav } from "../components/TabNav";

function Me() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/login");
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        } else {
          setError("Profile not found.");
        }
      } catch (err) {
        setError("Failed to load profile.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  const stats = [
    { label: "Height", value: profile?.height || "—" },
    { label: "Weight", value: profile?.weight || "—" },
    { label: "Age", value: profile?.age || "—" },
    { label: "Gender", value: profile?.gender || "—" },
    { label: "Body type", value: profile?.bodyType || "—" },
    { label: "Face shape", value: profile?.faceShape || "—" },
  ];

  return (
    <main className="min-h-screen bg-gray-50 px-4 pt-6 pb-28">
      <div className="mx-auto max-w-2xl space-y-8">
        
        {/* Section 1: Profile Header */}
        <section className="flex items-center gap-4">
          <div className="relative">
            {profile?.avatarUrl ? (
              <img 
                src={profile.avatarUrl} 
                alt="Avatar" 
                className="h-20 w-20 rounded-full object-cover ring-2 ring-black"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gray-200 ring-2 ring-black flex items-center justify-center">
                <span className="text-gray-400 text-xs italic">No Avatar</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-[20px] font-bold text-gray-900 leading-tight">
              {profile?.name || "Style Enthusiast"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[14px] text-gray-500">{profile?.city || "Location unknown"}</p>
              <div 
                className="h-[20px] w-[20px] rounded-full border border-gray-100 shadow-sm"
                style={{ backgroundColor: profile?.skinTone || "#f5c5a3" }}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Body Stats Grid */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Physical Profile</h2>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-tighter">{stat.label}</p>
                <p className="text-base font-bold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Appearance */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Appearance</h2>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <div 
                className="h-12 w-12 rounded-xl shadow-inner border border-gray-100"
                style={{ backgroundColor: profile?.skinTone || "#f5c5a3" }}
              />
              <span className="text-[10px] font-mono font-bold text-gray-500">{profile?.skinTone || "#f5c5a3"}</span>
            </div>
            <p className="text-sm text-gray-600 leading-snug">
              Your AI color palette and virtual try-ons are optimized for this <span className="font-semibold text-gray-900">skin tone</span>.
            </p>
          </div>
        </section>

        {/* Section 4: Account Actions */}
        <section className="space-y-3 pt-4">
          <button 
            onClick={() => navigate('/onboarding')}
            className="w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
          >
            Edit Profile
          </button>
          
          <button 
            onClick={() => navigate('/generate-model')}
            className="w-full rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-bold text-gray-700 transition-all active:scale-[0.98]"
          >
            Regenerate Avatar
          </button>
          
          <button 
            onClick={handleSignOut}
            className="w-full rounded-xl border border-red-200 bg-red-180/10 py-3.5 text-sm font-bold text-red-600 transition-all active:scale-[0.98] hover:bg-red-50"
          >
            Sign Out
          </button>
        </section>

        {/* Section 5: App Info Footer */}
        <footer className="pt-6 pb-4">
          <p className="text-center text-[12px] text-gray-400">
            SyleAI v0.0.1 · Made with ♥ by your team
          </p>
        </footer>

      </div>
      <BottomTabNav />
    </main>
  );
}

export default Me;
