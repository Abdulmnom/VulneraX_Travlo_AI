from gtts import gTTS
import os

output_dir = os.path.dirname(os.path.abspath(__file__))

# English test
tts_en = gTTS(
    text="Hello Travlo! Can you recommend a good restaurant in Muscat?",
    lang="en",
    slow=False
)
tts_en.save(os.path.join(output_dir, "test_en.mp3"))
print("Created test_en.mp3")

# Arabic test
tts_ar = gTTS(
    text="مرحبا ترافلو! هل يمكنك أن توصي لي بأماكن سياحية في مسقط؟",
    lang="ar",
    slow=False
)
tts_ar.save(os.path.join(output_dir, "test_ar.mp3"))
print("Created test_ar.mp3")
