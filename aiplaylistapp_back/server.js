const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 5001;

app.use(cors()); // Enable CORS for cross-origin requests

// Set up multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads")); // Use absolute path for uploads folder
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Upload route
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  // Construct absolute path for the uploaded file
  const filePath = path.join(__dirname, "uploads", req.file.filename);

  // Determine which Python script to run based on file type
  const script =
    req.file.mimetype === "audio/flac"
      ? path.join(
          __dirname,
          "scripts",
          "extract_flac_basic_metadata_combined.py"
        )
      : path.join(__dirname, "scripts", "mp3.py");

  console.log("Running Python script:", script);
  console.log("With file:", filePath);

  // Run the Python script using spawn
  const process = spawn("python3", [script, filePath]);

  let pythonOutput = "";

  // Capture Python script's stdout data
  process.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });

  // Capture any error from the Python script
  process.stderr.on("data", (data) => {
    console.error(`Python script error: ${data}`);
  });

  // Handle the script completion
  process.on("close", (code) => {
    console.log(`Python script exited with code ${code}`);
    console.log("Raw Python output:", pythonOutput); // Debug: print the raw output

    try {
      // Parse the JSON output from the Python script
      const metadata = JSON.parse(pythonOutput);
      return res.json({ metadata });
    } catch (error) {
      console.error("Error parsing Python script output:", error);
      return res.status(500).send("Error parsing Python script output.");
    }
  });
});

// Start the backend server
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
