import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth } from "../firebase/firebase";

const initialForm = {
  name: "",
  email: "",
  password: ""
};

function AuthCard({ onAuthenticated }) {
  const [mode, setMode] = useState("signup");
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        if (formData.name.trim()) {
          await updateProfile(result.user, {
            displayName: formData.name.trim()
          });
        }

        onAuthenticated(result.user);
      } else {
        const result = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        onAuthenticated(result.user);
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card auth-card">
      <p className="eyebrow">Step 1</p>
      <h1>Create your StyleAI account</h1>
      <p className="muted">
        Sign up or log in to unlock face scan onboarding and image uploads.
      </p>

      <div className="auth-switch">
        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <label>
            Full name
            <input
              name="name"
              type="text"
              placeholder="Taylor Smith"
              value={formData.name}
              onChange={handleChange}
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            placeholder="Minimum 6 characters"
            value={formData.password}
            onChange={handleChange}
            minLength={6}
            required
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "signup"
              ? "Create account"
              : "Continue"}
        </button>
      </form>
    </section>
  );
}

export default AuthCard;
