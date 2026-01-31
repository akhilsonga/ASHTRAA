import os
import requests
import time
from openai import OpenAI
from dotenv import load_dotenv

# Load .env from the same directory as the script
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)

client = OpenAI()

def generate_response(messages, image_base64=None):
    # Check if we need to inject image into the last user message
    if image_base64 and messages:
        last_msg = messages[-1]
        if last_msg.get("role") == "user":
            # Convert simple text content to list content with image
            text_content = last_msg["content"]
            new_content = [
                { "type": "input_text", "text": text_content },
                {
                    "type": "input_image", 
                    "image_url": f"data:image/jpeg;base64,{image_base64}" if not image_base64.startswith("data:") else image_base64
                }
            ]
            last_msg["content"] = new_content

    response = client.responses.create(
        model="gpt-5-nano",
        input=messages,
        text={
            "format": {
                "type": "text"
            },
            "verbosity": "medium"
        },
        reasoning={
            "effort": "minimal"
        },
        tools=[],
        store=True,
        include=[
            "reasoning.encrypted_content",
            "web_search_call.action.sources"
        ]
    )
    return response.output_text


def generate_audio(text, model, filepath=None):
    model_map = {
        1: "aura-orpheus-en",
        2: "aura-asteria-en",
        3: "aura-arcas-en",
        4: "aura-luna-en",
        5: "aura-helios-en",
        6: "aura-stella-en",
    }
    
    selected_model = model_map.get(model, model)

    url = "https://api.deepgram.com/v1/speak"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Token {os.getenv('DEEPGRAM_API_KEY')}"
    }
    params = {
        "model": selected_model
    }
    data = {
        "text": text
    }

    response = requests.post(url, headers=headers, params=params, json=data)

    if response.status_code == 200:
        if filepath:
            final_path = filepath
            os.makedirs(os.path.dirname(os.path.abspath(final_path)), exist_ok=True)
        else:
            output_dir = os.path.join(os.path.dirname(__file__), "AudioStream")
            os.makedirs(output_dir, exist_ok=True)
            filename = f"output_{int(time.time())}.mp3"
            final_path = os.path.join(output_dir, filename)

        with open(final_path, "wb") as f:
            f.write(response.content)
        return final_path
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None


if __name__ == "__main__":
    print(generate_response([{"role": "user", "content": "Hello, how are you?"}]))
    # Example usage with model ID 2 (female voice)
    output_path = generate_audio("Hello, how are you?", 2)
    print(f"Audio saved to: {output_path}")




