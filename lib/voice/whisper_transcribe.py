#!/usr/bin/env python3
"""
whisper_transcribe.py

CLI wrapper for faster-whisper.
Reads an audio file, transcribes it, and prints a JSON result to stdout.

Usage:
    python whisper_transcribe.py --audio /path/to/audio.webm --model base --compute_type int8

Output (stdout):
    {
        "transcript": "...",
        "language": "ar",
        
        "probability": 0.98
    }
"""

import argparse
import json
import os
import sys
import tempfile
import subprocess

# Try importing faster_whisper; if missing, print a clean JSON error
try:
    from faster_whisper import WhisperModel
except ImportError as e:
    print(json.dumps({"error": f"faster-whisper not installed: {e}"}), file=sys.stderr)
    sys.exit(1)


def convert_to_wav(input_path: str) -> str:
    """Convert any audio to 16kHz mono WAV using ffmpeg."""
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        wav_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")
    return wav_path


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("--audio", required=True, help="Path to input audio file")
    parser.add_argument("--model", default="base", help="Whisper model size (tiny, base, small, medium, large)")
    parser.add_argument("--compute_type", default="int8", help="Compute type (int8, float16, float32)")
    parser.add_argument("--beam_size", type=int, default=5, help="Beam size for decoding")
    parser.add_argument("--vad_filter", action="store_true", default=True, help="Enable VAD filter")
    parser.add_argument("--device", default="cpu", help="Device (cpu or cuda)")
    args = parser.parse_args()

    try:
        # Convert input to WAV if needed
        input_path = args.audio
        if not input_path.lower().endswith(".wav"):
            input_path = convert_to_wav(input_path)

        # Load model (cached automatically in ~/.cache/whisper)
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
        )

        # Transcribe
        segments, info = model.transcribe(
            input_path,
            beam_size=args.beam_size,
            vad_filter=args.vad_filter,
        )

        # Concatenate segments
        transcript = " ".join(seg.text.strip() for seg in segments).strip()

        result = {
            "transcript": transcript,
            "language": info.language,
            "probability": round(float(info.language_probability), 4),
        }

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up temp WAV if we created one
        if 'input_path' in locals() and input_path != args.audio and os.path.exists(input_path):
            os.remove(input_path)


if __name__ == "__main__":
    main()
