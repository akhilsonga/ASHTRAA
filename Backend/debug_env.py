import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
print(f"Attempting to load .env from: {env_path}")
load_dotenv(env_path)

key = os.getenv('DEEPGRAM_API_KEY')
print(f"DEEPGRAM_API_KEY loaded: {key is not None}")
if key:
    print(f"Key value: {key}")
else:
    print("Key is None")
