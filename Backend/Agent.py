import json
import glob
import os
import re
import base64
import io
from pypdf import PdfReader
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from LLM import generate_audio, generate_response
from prompt import prompt

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# -------------------------------------------------------------------------
# Global State (Simple in-memory for this demo)
# -------------------------------------------------------------------------

# Initialize chat history with the system prompt
CHAT_HISTORY = [
    {"role": "system", "content": prompt}
]

# Audio counter for the session
AUDIO_COUNTER = 0

# Determine Session Directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_STREAM_DIR = os.path.join(BASE_DIR, "AudioStream")
os.makedirs(AUDIO_STREAM_DIR, exist_ok=True)

# Find the next available conversation folder on startup
i = 1
while True:
    SESSION_DIR = os.path.join(AUDIO_STREAM_DIR, f"conversation{i}")
    if not os.path.exists(SESSION_DIR):
        os.makedirs(SESSION_DIR)
        break
    i += 1

print(f"Server initialized. Audio will be saved to: {SESSION_DIR}")

# -------------------------------------------------------------------------
# Helper Functions
# -------------------------------------------------------------------------

def tools_handler(response_text, output_dir, current_index, session_name):
    """
    Parses LLM response for <voiceN> tags, generates audio for each segment,
    and returns metadata for the frontend.
    """
    pattern = r'<voice(\d+)>([\s\S]*?)</voice\1>'
    segments = list(re.finditer(pattern, response_text))
    
    generated_segments = []
    
    if not segments:
        return current_index, generated_segments

    print(f"\n[Tools Handler] Processing {len(segments)} audio segments (Starting index: {current_index + 1})...")
    
    for match in segments:
        current_index += 1
        voice_id = int(match.group(1))
        content = match.group(2).strip()
        
        # Filename: voice{voice_id}-{current_index}.mp3
        filename = f"voice{voice_id}-{current_index}.mp3"
        filepath = os.path.join(output_dir, filename)
        
        print(f"  - Generating audio for voice {voice_id}: {filename}")
        
        # Call generate_audio (assuming it blocks)
        generate_audio(content, voice_id, filepath=filepath)
        
        # Add to metadata
        # We construct a URL that points to our local server
        generated_segments.append({
            "id": current_index,
            "voice": f"Voice {voice_id}",
            "filename": filename,
            "text": content,
            # URL will be constructed by the frontend or relative here?
            # Let's provide a relative path or full URL
            # URL includes session name to support history
            "url": f"http://localhost:5011/audio/{session_name}/{filename}"
        })
    
    print(f"[Tools Handler] Done.\n")
    return current_index, generated_segments

# -------------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------------

@app.route('/chat', methods=['POST'])
def chat():
    global CHAT_HISTORY, AUDIO_COUNTER
    
    data = request.json
    user_input = data.get('message', '')
    file_data = data.get('file_data', None)
    file_type = data.get('file_type', None)
    
    # Handle File Inputs
    image_base64 = None
    
    if file_data and file_type:
        if file_type == 'application/pdf':
            try:
                # Decode and extract text from PDF
                pdf_bytes = base64.b64decode(file_data.split(',')[1] if ',' in file_data else file_data)
                reader = PdfReader(io.BytesIO(pdf_bytes))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                
                # Limit to first 5000 words
                words = text.split()
                if len(words) > 5000:
                    words = words[:5000]
                    text = " ".join(words) + "... [Content Truncated]"
                
                user_input += f"\n\n[PDF Content ({len(words)} words)]:\n{text}"
                print(f"Processed PDF content ({len(words)} words)")
            except Exception as e:
                print(f"Error processing PDF: {e}")
                return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 400
        
        elif file_type.startswith('image/'):
            # Pass image base64 to LLM
            # Ensure it's just the base64 part if formatted as data url
            image_base64 = file_data.split(',')[1] if ',' in file_data else file_data
            print("Processed Image input")

    if not user_input and not image_base64:
        # Allow empty text if image is present?
        # If only image is present, user_input might be empty
        if not image_base64:
            return jsonify({"error": "No message or file provided"}), 400
        user_input = "Analyze this image." # Default text if none provided with image

    # 1. Append User Input
    CHAT_HISTORY.append({"role": "user", "content": user_input})
    
    try:
        # 2. Call LLM
        response_text = generate_response(CHAT_HISTORY, image_base64=image_base64)
        
        # 3. Append Assistant Response
        CHAT_HISTORY.append({"role": "assistant", "content": response_text})
        
        session_name = os.path.basename(SESSION_DIR)
        
        # 4. Handle Tools (Audio Generation)
        updated_index, new_segments = tools_handler(response_text, SESSION_DIR, AUDIO_COUNTER, session_name)
        AUDIO_COUNTER = updated_index
        
        # 5. Persist Metadata
        metadata_path = os.path.join(SESSION_DIR, "metadata.json")
        metadata = {}
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
        else:
            metadata = {"title": user_input[:50], "segments": []} # Use first query as title
            
        metadata["segments"].extend(new_segments)
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return jsonify({
            "responseed_text": response_text,
            "audio_segments": new_segments,
            "folder_name": session_name
        })
        
    except Exception as e:
        print(f"Error during chat processing: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    # Serve global assets from the root AudioStream directory
    return send_from_directory(AUDIO_STREAM_DIR, filename)

@app.route('/audio/<session_name>/<path:filename>')
def serve_audio(session_name, filename):
    # Serve from the specific session directory
    directory = os.path.join(AUDIO_STREAM_DIR, session_name)
    return send_from_directory(directory, filename)

@app.route('/history', methods=['GET'])
def get_history():
    sessions = []
    # List all conversation folders
    folders = sorted(glob.glob(os.path.join(AUDIO_STREAM_DIR, "conversation*")), key=os.path.getmtime, reverse=True)
    
    for folder in folders:
        meta_path = os.path.join(folder, "metadata.json")
        folder_name = os.path.basename(folder)
        title = folder_name
        
        if os.path.exists(meta_path):
            try:
                with open(meta_path, 'r') as f:
                    data = json.load(f)
                    title = data.get("title", folder_name)
            except:
                pass
                
        sessions.append({
            "id": folder_name,
            "title": title
        })
        
    return jsonify(sessions)

@app.route('/history/<session_id>', methods=['GET'])
def get_session(session_id):
    folder = os.path.join(AUDIO_STREAM_DIR, session_id)
    meta_path = os.path.join(folder, "metadata.json")
    
    if not os.path.exists(meta_path):
        return jsonify({"error": "Session not found"}), 404
        
    with open(meta_path, 'r') as f:
        data = json.load(f)
        
    return jsonify(data)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "session_dir": SESSION_DIR})

if __name__ == "__main__":
    app.run(port=5011, debug=True)
