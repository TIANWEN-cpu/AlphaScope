"""测试各 LLM API 可用性"""
import os
from dotenv import load_dotenv
from openai import OpenAI

from project_paths import ENV_FILE

load_dotenv(ENV_FILE)

providers = [
    ("DeepSeek", os.getenv("DEEPSEEK_API_KEY"), "https://api.deepseek.com/v1", "deepseek-chat"),
    ("Kimi", os.getenv("KIMI_API_KEY"), os.getenv("KIMI_BASE_URL"), "moonshot-v1-8k"),
    ("Claude", os.getenv("CLAUDE_API_KEY"), os.getenv("CLAUDE_BASE_URL"), "claude-3-5-sonnet-20241022"),
    ("GPT", os.getenv("GPT_API_KEY"), os.getenv("GPT_BASE_URL"), "gpt-4o-mini"),
    ("SenseNova", os.getenv("SENSENOVA_API_KEY"), os.getenv("SENSENOVA_BASE_URL"), "SenseChat-5"),
]

for name, key, base, model in providers:
    try:
        client = OpenAI(api_key=key, base_url=base, timeout=15.0)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "用一句话回答：今天天气如何？"}],
            max_tokens=50,
        )
        print(f"OK  {name:12s} -> {resp.choices[0].message.content[:60]}")
    except Exception as e:
        msg = str(e)[:120].replace("\n", " ")
        print(f"FAIL {name:12s} -> {msg}")
