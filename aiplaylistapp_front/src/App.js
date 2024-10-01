import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

function App() {
  const [files, setFiles] = useState([]);
  const [metadata, setMetadata] = useState([]); // To store metadata of files
  const [analyzed, setAnalyzed] = useState(false); // To track whether the "Analyze" button was clicked

  const onDrop = (acceptedFiles) => {
    setFiles(acceptedFiles);
    setAnalyzed(false); // Reset analyzed state if new files are uploaded
    setMetadata([]); // Reset metadata if new files are uploaded
    console.log("Files dropped:", acceptedFiles); // Debugging
  };

  const handleAnalyze = () => {
    setAnalyzed(true); // Show "Analyzing..." on button
    console.log("Analyzing files...");

    const promises = files.map((file) => {
      const formData = new FormData();
      formData.append("file", file);

      console.log("Sending file to backend:", file.name);

      return axios
        .post("http://localhost:5001/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((response) => {
          console.log("File analysis response:", response.data.metadata); // Debugging
          const fileMetadata = response.data.metadata;
          return { name: file.name, metadata: fileMetadata };
        })
        .catch((error) => {
          console.error("Error uploading file:", error);
          return { name: file.name, metadata: "Error processing file" };
        });
    });

    // Once all files are processed, update the state
    Promise.all(promises)
      .then((results) => {
        setMetadata(results); // Update all metadata at once
        setAnalyzed(false); // Reset button state
      })
      .catch((error) => {
        console.error("Error analyzing files:", error);
        setAnalyzed(false); // Reset button state
      });
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: ".mp3,.flac",
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">Upload Your Music Library</h1>

      {/* Dropzone with dashed border */}
      <div
        {...getRootProps()}
        className="cursor-pointer border-4 border-dashed border-blue-500 bg-white text-blue-500 px-4 py-6 rounded hover:bg-gray-100 w-80 h-48 flex flex-col items-center justify-center">
        <input {...getInputProps()} />
        <p className="text-center">
          Drag & drop your MP3/FLAC files here, or click to select
        </p>
      </div>

      <div className="mt-4">
        {files.length > 0 && <p>{files.length} file(s) uploaded.</p>}

        {/* Analyze Button */}
        {files.length > 0 && (
          <button
            onClick={handleAnalyze}
            className="bg-green-500 text-white px-4 py-2 mt-4 rounded hover:bg-green-600"
            disabled={analyzed}>
            {analyzed ? "Analyzing..." : "Analyze Files"}
          </button>
        )}

        {/* Display file metadata */}
        <div className="mt-4">
          {metadata.length > 0 && (
            <ul>
              {metadata.map((fileMeta, index) => (
                <li key={index} className="mb-4">
                  <h3 className="font-bold">{fileMeta.name}</h3>
                  <pre className="bg-gray-200 p-2 rounded">
                    {JSON.stringify(fileMeta.metadata, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
