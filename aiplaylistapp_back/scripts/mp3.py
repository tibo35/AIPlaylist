import sys
import json
from pydub import AudioSegment
from mutagen.mp3 import MP3
import librosa
import numpy as np

# Ensure the file path is passed as an argument
if len(sys.argv) > 1:
    mp3_file_path = sys.argv[1]  # Get the file path from the argument
else:
    print("No MP3 file path provided.")
    sys.exit(1)

# ----- Load audio properties using pydub -----
audio = AudioSegment.from_file(mp3_file_path, format="mp3")

# Basic data
sample_rate = audio.frame_rate
channels = audio.channels
duration = len(audio) / 1000.0  # in seconds
bit_depth = audio.sample_width * 8  # in bits (sample width in bytes)
bit_rate = sample_rate * channels * bit_depth  # calculate bit rate in bits per second
frame_count = audio.frame_count()

# Store audio properties in a metadata dictionary
metadata = {
    "Sample rate": sample_rate,
    "Channels": channels,
    "Duration (seconds)": duration,
    "Bit Depth": bit_depth,
    "Bit Rate (kbps)": bit_rate / 1000,
    "Total Frames": frame_count
}

# ----- Extract metadata using mutagen -----
audio_file = MP3(mp3_file_path)

# Extract metadata (tags)
if audio_file.tags:
    for key, value in audio_file.tags.items():
        if key.startswith('APIC'):
            metadata["APIC"] = {
                "MIME type": value.mime,
                "Description": value.desc,
                "Picture Type": value.type
            }
        else:
            metadata[key] = str(value)

metadata.update({
    "Sample rate (mutagen)": audio_file.info.sample_rate,
    "Channels (mutagen)": audio_file.info.channels,
    "Duration (mutagen)": audio_file.info.length,
    "Bitrate (mutagen)": audio_file.info.bitrate / 1000
})

# ----- Feature Extraction with librosa -----
y, sr = librosa.load(mp3_file_path, sr=None, duration=30)

# --- Timbre (MFCCs) ---
mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
metadata["MFCCs (mean)"] = mfccs.mean(axis=1).tolist()

# Spectral contrast
spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
metadata["Spectral Contrast (mean)"] = spectral_contrast.mean(axis=1).tolist()

# Zero crossing rate
zcr = librosa.feature.zero_crossing_rate(y)
metadata["Zero Crossing Rate (mean)"] = zcr.mean().tolist()

# ----- Print the metadata as JSON -----
print(json.dumps(metadata))
