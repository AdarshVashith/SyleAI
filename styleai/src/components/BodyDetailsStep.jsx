import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const initialForm = {
  name: "",
  age: "",
  gender: "",
  weightKg: "",
  heightCm: "",
  bodyType: "average",
  city: "",
  job: ""
};

function BodyDetailsStep({ user, onComplete }) {
  const [formData, setFormData] = useState(initialForm);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: formData.name.trim(),
          age: Number(formData.age),
          gender: formData.gender.trim(),
          weight: Number(formData.weightKg),
          height: Number(formData.heightCm),
          bodyType: formData.bodyType,
          city: formData.city.trim(),
          job: formData.job.trim(),
          onboardingDone: true
        },
        { merge: true }
      );

      setStatus("Details saved. Redirecting...");
      onComplete();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card upload-card">
      <p className="eyebrow">Step 3</p>
      <h2>Body details</h2>
      <p className="muted">
        Fill out your profile details to complete onboarding.
      </p>

      <form className="stack body-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={formData.name} onChange={handleChange} required />
        </label>

        <label>
          Age
          <input
            name="age"
            type="number"
            min={1}
            max={120}
            value={formData.age}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Gender
          <input name="gender" value={formData.gender} onChange={handleChange} required />
        </label>

        <label>
          Weight (kg)
          <input
            name="weightKg"
            type="number"
            min={1}
            value={formData.weightKg}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Height (cm)
          <input
            name="heightCm"
            type="number"
            min={1}
            value={formData.heightCm}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Body type
          <select name="bodyType" value={formData.bodyType} onChange={handleChange}>
            <option value="slim">slim</option>
            <option value="athletic">athletic</option>
            <option value="average">average</option>
            <option value="plus">plus</option>
          </select>
        </label>

        <label>
          City
          <input name="city" value={formData.city} onChange={handleChange} required />
        </label>

        <label>
          Job
          <input name="job" value={formData.job} onChange={handleChange} required />
        </label>

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving..." : "Finish onboarding"}
        </button>
      </form>

      {status ? <p className="status-text">{status}</p> : null}
    </section>
  );
}

export default BodyDetailsStep;
