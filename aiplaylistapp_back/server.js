const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const cors = require("cors");
const Rivet = require("@ironclad/rivet-node");
const { startDebuggerServer } = require("@ironclad/rivet-node");

require("dotenv").config();

const app = express();
const port = 5001;

// Middleware to parse form data (for multipart/form-data)
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Set up multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Start the debugger server
const debuggerServer = startDebuggerServer({
  port: 21888,
  // host: 'localhost', // Optional: default is 'localhost'
});
console.log("Rivet Debugger Server started on ws://localhost:21888");

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

  // Get the extra input from the request body
  const extraInput = req.body.extraInput || "";
  console.log("Extra input from request body:", extraInput);

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
  process.on("close", async (code) => {
    console.log(`Python script exited with code ${code}`);
    console.log("Raw Python output:", pythonOutput);

    try {
      // Parse the JSON output from the Python script
      const metadata = JSON.parse(pythonOutput);

      // Run the Rivet graph with the extra input (metadata is optional)
      const rivetResult = await runRivetGraph(extraInput);

      // Send both metadata and Rivet result back to the client
      return res.json({ metadata, rivetResult });
    } catch (error) {
      console.error("Error parsing Python script output:", error);
      return res.status(500).send("Error parsing Python script output.");
    }
  });
});

// Function to run the Rivet graph
async function runRivetGraph(extraInput) {
  console.log("Running Rivet graph with inputs:");
  console.log("Extra Input:", extraInput);

  // Path to your Rivet project file
  const rivetProjectPath = path.join(
    __dirname,
    "rivet",
    "AIPlaylistProject.rivet-project"
  );

  try {
    // Run the graph with the debugger server
    const result = await Rivet.runGraphInFile(rivetProjectPath, {
      graph: "AIPlaylist", // The name of your graph in Rivet
      inputs: {
        input: extraInput, // The extra input from the user
      },
      openAiKey: process.env.OPENAI_API_KEY,
      remoteDebugger: debuggerServer, // Pass the debugger server
    });

    console.log("Rivet Result:", result);
    return result;
  } catch (error) {
    console.error("Error running Rivet graph:", error);
    throw error;
  }
}

// Start the backend server
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
