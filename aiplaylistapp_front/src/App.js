import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

function App() {
  const [files, setFiles] = useState([]);
  const [metadata, setMetadata] = useState([]); // To store metadata of files
  const [analyzed, setAnalyzed] = useState(false); // To track whether the "Analyze" button was clicked
  const [uploadProgress, setUploadProgress] = useState({}); // To store progress of each file
  const [analysisProgress, setAnalysisProgress] = useState({}); // To store analysis progress
  const [extraInput, setExtraInput] = useState(""); // The extra input for testing

  const onDrop = (acceptedFiles) => {
    setFiles(acceptedFiles);
    setAnalyzed(false); // Reset analyzed state if new files are uploaded
    setMetadata([]); // Reset metadata if new files are uploaded
    setUploadProgress({}); // Reset upload progress
    setAnalysisProgress({}); // Reset analysis progress
    console.log("Files dropped:", acceptedFiles); // Debugging
  };

  const handleAnalyze = () => {
    setAnalyzed(true); // Show "Analyzing..." on button
    console.log("Analyzing files...");

    const promises = files.map((file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("extraInput", extraInput); // Append the extra input

      console.log("Sending file to backend:", file.name);

      return axios
        .post("http://localhost:5001/upload", formData, {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress((prevProgress) => ({
              ...prevProgress,
              [file.name]: percentCompleted,
            }));
            console.log(`File ${file.name} is ${percentCompleted}% uploaded.`);
          },
        })
        .then((response) => {
          // Once upload completes, begin file analysis phase
          setAnalysisProgress((prevProgress) => ({
            ...prevProgress,
            [file.name]: "Analyzing...",
          }));

          console.log("File analysis response:", response.data);
          const { metadata, rivetResult } = response.data;

          // Update analysis progress
          setAnalysisProgress((prevProgress) => ({
            ...prevProgress,
            [file.name]: "Complete",
          }));

          return { name: file.name, metadata, rivetResult };
        })
        .catch((error) => {
          console.error("Error uploading file:", error);
          setAnalysisProgress((prevProgress) => ({
            ...prevProgress,
            [file.name]: "Error",
          }));
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

      {/* Extra input field */}
      <div className="mt-4">
        <input
          type="text"
          value={extraInput}
          onChange={(e) => setExtraInput(e.target.value)}
          placeholder="Enter extra input for testing"
          className="border border-gray-400 p-2 rounded w-64"
        />
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

        {/* Display upload and analysis progress */}
        <div className="mt-4">
          {files.map((file) => (
            <div key={file.name} className="mb-2">
              <p>{file.name}</p>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
                <div
                  className="bg-blue-600 h-4 rounded-full"
                  style={{
                    width: `${uploadProgress[file.name] || 0}%`,
                  }}></div>
              </div>
              <p>Upload: {uploadProgress[file.name] || 0}%</p>
              <p>Analysis Status: {analysisProgress[file.name] || "Waiting"}</p>
            </div>
          ))}
        </div>

        {/* Display file metadata and Rivet result */}
        <div className="mt-4">
          {metadata.length > 0 && (
            <ul>
              {metadata.map((fileMeta, index) => (
                <li key={index} className="mb-4">
                  <h3 className="font-bold">{fileMeta.name}</h3>
                  <pre className="bg-gray-200 p-2 rounded">
                    {JSON.stringify(fileMeta.metadata, null, 2)}
                  </pre>
                  {/* Display Rivet Result if available */}
                  {fileMeta.rivetResult && (
                    <div>
                      <h4 className="font-bold">Rivet Result:</h4>
                      <pre className="bg-gray-200 p-2 rounded">
                        {JSON.stringify(fileMeta.rivetResult, null, 2)}
                      </pre>
                    </div>
                  )}
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
