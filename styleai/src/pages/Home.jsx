import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase/firebase";
import { BottomTabNav } from "../components/TabNav";
import StyleScoreCard from "../components/StyleScoreCard";

const getSuggestedColors = (skinToneHex) => {
  const r = parseInt(skinToneHex.slice(1, 3), 16);
  const g = parseInt(skinToneHex.slice(3, 5), 16);
  const b = parseInt(skinToneHex.slice(5, 7), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const isWarm = r > b;

  if (brightness > 150 && isWarm) {
    return [
      { name: "Terracotta", hex: "#C4552A" },
      { name: "Olive", hex: "#6B7B3A" },
      { name: "Mustard", hex: "#D4A017" },
      { name: "Warm brown", hex: "#8B5E3C" },
      { name: "Rust", hex: "#B7410E" }
    ];
  } else if (brightness > 150 && !isWarm) {
    return [
      { name: "Navy", hex: "#1B3A6B" },
      { name: "Lavender", hex: "#9B72AA" },
      { name: "Teal", hex: "#008080" },
      { name: "Slate", hex: "#6B7B8D" },
      { name: "Rose", hex: "#C47A8A" }
    ];
  } else if (brightness <= 150 && isWarm) {
    return [
      { name: "Cream", hex: "#FFFDD0" },
      { name: "Gold", hex: "#FFD700" },
      { name: "Burgundy", hex: "#800020" },
      { name: "Forest green", hex: "#228B22" },
      { name: "Camel", hex: "#C19A6B" }
    ];
  } else {
    return [
      { name: "White", hex: "#FFFFFF" },
      { name: "Cobalt blue", hex: "#0047AB" },
      { name: "Emerald", hex: "#50C878" },
      { name: "Crimson", hex: "#DC143C" },
      { name: "Charcoal", hex: "#36454F" }
    ];
  }
};

function greetingForCurrentTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [profile, setProfile] = useState(null);
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/login");
      } else {
        setUser(firebaseUser);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError("");

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          throw new Error("User profile not found.");
        }
        setProfile(userDoc.data());
      } catch (error) {
        setProfileError(error.message || "Failed to load profile.");
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!profile?.city) return;

    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError("");

      try {
        const key = import.meta.env.VITE_OPENWEATHER_API_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          profile.city
        )}&appid=${key}&units=metric`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Failed to fetch weather.");
        }

        setWeather(data);
      } catch (error) {
        setWeatherError(error.message || "Failed to fetch weather.");
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [profile?.city]);

  const colors = useMemo(() => {
    const skinTone = profile?.skinTone || "#f5c5a3";
    return getSuggestedColors(skinTone);
  }, [profile?.skinTone]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-28 pt-6 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {`${greetingForCurrentTime()}, ${profile?.name || "there"}`}
          </h1>
        </header>

        {profileLoading ? (
          <section className="flex min-h-[280px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          </section>
        ) : profileError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {profileError}
          </section>
        ) : (
          <>
            <section className="grid gap-6 md:grid-cols-2">
              <article className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Your 2D Avatar</h2>
                <div className="overflow-hidden rounded-2xl bg-gray-100 p-4">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="StyleAI avatar"
                      className="mx-auto h-[420px] w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-[420px] items-center justify-center text-sm text-gray-500">
                      No avatar generated yet.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/generate-outfit')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#111827',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '12px'
                  }}
                >
                  ✦ Generate Outfit
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/wardrobe')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'white',
                    color: '#111827',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  Try on outfits
                </button>
              </article>

              <article className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Weather</h2>
                {weatherLoading ? (
                  <div className="flex min-h-[220px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
                  </div>
                ) : weatherError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {weatherError}
                  </div>
                ) : weather ? (
                  <div className="space-y-3">
                    <p className="text-xl font-semibold text-gray-900">{weather.name}</p>
                    <div className="flex items-center gap-3">
                      {weather.weather?.[0]?.icon ? (
                        <img
                          src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
                          alt={weather.weather?.[0]?.main || "Weather icon"}
                          className="h-14 w-14"
                        />
                      ) : null}
                      <div>
                        <p className="text-3xl font-bold text-gray-900">
                          {Math.round(weather.main?.temp)}°C
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {weather.weather?.[0]?.description || "Unknown"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Add your city in profile to see weather.
                  </p>
                )}
              </article>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Colour Suggestions</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {colors.map((color, index) => (
                  <div
                    key={color.hex}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center"
                  >
                    <div
                      className="mx-auto h-14 w-14 rounded-full border border-gray-200"
                      style={{ backgroundColor: color.hex }}
                    />
                    <p className="mt-2 text-sm font-medium text-gray-800">{color.name}</p>
                    {index === 0 ? (
                      <p className="mt-1 text-xs font-semibold text-green-700">Best for you</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <StyleScoreCard userId={user?.uid} />
            </section>
          </>
        )}
      </div>
      <BottomTabNav />
    </main>
  );
}

export default Home;
