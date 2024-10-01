import json
import subprocess
from mutagen.flac import FLAC
import librosa
import numpy as np
from numba import jit
import concurrent.futures

# Path to your FLAC file
flac_file_path = "/Users/thibaudaptel/Desktop/06 - Confidence Man - Holiday.flac"

# ----- Extract metadata using mutagen -----
audio_file = FLAC(flac_file_path)

# Basic data (Mutagen FLAC Metadata)
metadata = {
    "Sample rate (mutagen)": audio_file.info.sample_rate,
    "Channels (mutagen)": audio_file.info.channels,
    "Duration (mutagen)": audio_file.info.length,
    "Bitrate (mutagen)": audio_file.info.bitrate / 1000
}

# Extract additional tags if they exist
if audio_file.tags:
    metadata.update({key: value for key, value in audio_file.tags.items() if key != "traktor4"})

# ----- Optimized Feature Extraction with librosa -----
# Load only the first 30 seconds of the audio file
y, sr = librosa.load(flac_file_path, sr=None, duration=30)

@jit(nopython=True)
def calculate_syncopation(onset_env, beat_intervals):
    onset_diff = np.diff(onset_env)
    syncopation_score = np.var(onset_diff) + np.var(beat_intervals)
    return syncopation_score

# --- Timbre (MFCCs) ---
mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
metadata["MFCCs (mean)"] = mfccs.mean(axis=1).tolist()

# Spectral contrast
spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
metadata["Spectral Contrast (mean)"] = spectral_contrast.mean(axis=1).tolist()

# Zero crossing rate
zcr = librosa.feature.zero_crossing_rate(y)
metadata["Zero Crossing Rate (mean)"] = zcr.mean().tolist()

# --- Rhythmic Patterns ---
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
tempo_value, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
metadata["Estimated Tempo (BPM)"] = tempo_value.tolist()

# Store beat times
beat_times = librosa.frames_to_time(beat_frames, sr=sr)
metadata["Beat Times (seconds)"] = beat_times[:10].tolist()

# Beat intervals and tempo variability
beat_intervals = np.diff(beat_times)
metadata["Beat Intervals (seconds)"] = beat_intervals.tolist()
metadata["Tempo Variability"] = np.var(beat_intervals)

# Syncopation detection
syncopation_score = calculate_syncopation(onset_env, beat_intervals)
metadata["Syncopation Score"] = syncopation_score

# --- Melodic Structure (Chroma, Pitch) ---
harmonic, percussive = librosa.effects.hpss(y)

chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr)
metadata["Chroma Features (mean)"] = chroma.mean(axis=1).tolist()

pitches, magnitudes = librosa.core.piptrack(y=harmonic, sr=sr)
pitch_values = pitches[pitches > 0]  # Filter out non-zero pitches
metadata["Pitch Distribution (mean)"] = pitch_values.mean().tolist()

# Tonnetz
tonnetz = librosa.feature.tonnetz(y=harmonic, sr=sr)
metadata["Tonnetz (mean)"] = tonnetz.mean(axis=1).tolist()

# Spectral centroid
spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
metadata["Spectral Centroid (mean)"] = spectral_centroid.mean().tolist()

# Spectrogram data
D = librosa.amplitude_to_db(np.abs(librosa.stft(y)), ref=np.max)
metadata["Spectrogram Data (mean)"] = D.mean().tolist()

# ----- Parallel ffprobe extraction -----
def get_ffprobe_detailed_data(filepath):
    try:
        command = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', filepath
        ]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return json.loads(result.stdout)
    except Exception as e:
        print(f"Error running ffprobe: {e}")
        return None

# Use a ThreadPoolExecutor to handle ffprobe I/O
with concurrent.futures.ThreadPoolExecutor() as executor:
    future = executor.submit(get_ffprobe_detailed_data, flac_file_path)
    ffprobe_detailed_data = future.result()

# Extracting detailed ffprobe information
if ffprobe_detailed_data:
    streams = ffprobe_detailed_data.get('streams', [])
    for i, stream in enumerate(streams):
        metadata[f"Stream #{i + 1} Codec"] = stream.get('codec_name')
        metadata[f"Stream #{i + 1} Bit Rate"] = stream.get('bit_rate')
        metadata[f"Stream #{i + 1} Channels"] = stream.get('channels')
        metadata[f"Stream #{i + 1} Duration"] = stream.get('duration')

# ----- Print or Save Metadata -----
print(json.dumps(metadata, indent=4))

# Optionally save to a file
with open("audio_metadata.json", "w") as outfile:
    json.dump(metadata, outfile, indent=4)
