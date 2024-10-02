import sys
import json
from pydub import AudioSegment
from mutagen.mp3 import MP3
import librosa
import numpy as np

def is_serializable(value):
    try:
        json.dumps(value)
        return True
    except (TypeError, OverflowError):
        return False

def sanitize_metadata(metadata):
    binary_fields = ['APIC', 'PRIV', 'GEOB', 'COMM']  # Add any other known binary fields

    if isinstance(metadata, dict):
        sanitized = {}
        for key, value in metadata.items():
            if key in binary_fields:
                continue
            if isinstance(value, dict) or isinstance(value, list):
                sanitized_value = sanitize_metadata(value)
                if sanitized_value is not None:
                    sanitized[key] = sanitized_value
            else:
                if is_serializable(value):
                    sanitized[key] = value
                else:
                    # Skip non-serializable fields
                    print(f"Skipping non-serializable field: {key}", file=sys.stderr)
        return sanitized
    elif isinstance(metadata, list):
        sanitized_list = []
        for item in metadata:
            sanitized_item = sanitize_metadata(item)
            if sanitized_item is not None:
                sanitized_list.append(sanitized_item)
        return sanitized_list
    else:
        if is_serializable(metadata):
            return metadata
        else:
            return None

# Ensure the file path is passed as an argument
if len(sys.argv) > 1:
    mp3_file_path = sys.argv[1]  # Get the file path from the argument
else:
    print("No MP3 file path provided.", file=sys.stderr)
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

# Define binary fields to skip
binary_fields = ['APIC', 'PRIV', 'GEOB', 'COMM']  # Add any other known binary fields

# Extract metadata (tags)
if audio_file.tags:
    for key, value in audio_file.tags.items():
        if key.startswith('APIC'):
            # Skip or handle APIC separately if needed
            continue
        elif key in binary_fields:
            # Skip binary fields
            continue
        else:
            # Convert value to a serializable form
            try:
                metadata[key] = str(value)
            except Exception as e:
                print(f"Skipping field {key} due to error: {e}", file=sys.stderr)

# Add additional audio properties
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

# Sanitize metadata before converting to JSON
sanitized_metadata = sanitize_metadata(metadata)

# ----- Print the sanitized metadata as JSON -----
print(json.dumps(sanitized_metadata, ensure_ascii=False))
