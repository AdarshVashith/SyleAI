import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { uploadToCloudinary } from "../utils/cloudinary";

function ImageUploadStep({ user, faceScanResult, onComplete }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedItems, setUploadedItems] = useState([]);

  const handleFileSelection = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }

    setFiles((current) => {
      if (current.length >= 2) {
        setStatus("You can only add 2 full-body photos.");
        return current;
      }

      setStatus("");
      return [...current, nextFile];
    });

    // Allow selecting the same file name again if needed.
    event.target.value = "";
  };

  const removeFile = (indexToRemove) => {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
    setStatus("");
  };

  const handleUpload = async () => {
    if (!files.length) {
      setStatus("Please choose 2 full-body photos.");
      return;
    }

    if (files.length !== 2) {
      setStatus("Please upload exactly 2 full-body photos.");
      return;
    }

    setLoading(true);
    setStatus("Uploading full-body photos...");

    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          let downloadURL = "";
          try {
            downloadURL = await uploadToCloudinary(file, "styleai/body-photos");
          } catch (error) {
            throw new Error("Failed to upload image. Please try again.");
          }

          return {
            name: file.name,
            downloadURL
          };
        })
      );

      const bodyPhotoUrls = uploads.map((item) => item.downloadURL);
      await setDoc(
        doc(db, "users", user.uid),
        {
          bodyPhotoUrls,
          bodyPhotosDone: true
        },
        { merge: true }
      );

      setUploadedItems(uploads);
      setStatus("Upload complete. Continue to body details.");
      onComplete(uploads);
    } catch (uploadError) {
      const rawMessage = String(uploadError?.message || "");
      setStatus(rawMessage || "Failed to upload image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card upload-card">
      <p className="eyebrow">Step 2</p>
      <h2>Upload full-body photos</h2>
      <p className="muted">
        After face scan, upload 2 clear full-body photos one by one.
      </p>

      <div className="scan-summary">
        <span>
          Expression: {faceScanResult?.dominantExpression || faceScanResult?.expression || "Unknown"}
        </span>
        <span>Face shape: {faceScanResult?.faceShape || "Unknown"}</span>
        <span>Skin tone: {faceScanResult?.skinTone || "Unknown"}</span>
      </div>

      <label className="upload-field">
        Select photo {files.length + 1 > 2 ? 2 : files.length + 1} of 2
        <input
          type="file"
          accept="image/*"
          disabled={files.length >= 2 || loading || uploadedItems.length > 0}
          onChange={handleFileSelection}
        />
      </label>

      {files.length ? (
        <div className="selected-files">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="selected-file-item">
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={loading || uploadedItems.length > 0}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="primary-button"
        onClick={handleUpload}
        disabled={loading || uploadedItems.length > 0}
      >
        {loading ? "Uploading..." : uploadedItems.length ? "Uploaded" : "Upload photos"}
      </button>

      {status ? <p className="status-text">{status}</p> : null}

      {uploadedItems.length ? (
        <div className="upload-results">
          {uploadedItems.map((item) => (
            <a key={item.downloadURL} href={item.downloadURL} target="_blank" rel="noreferrer">
              {item.name}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default ImageUploadStep;
