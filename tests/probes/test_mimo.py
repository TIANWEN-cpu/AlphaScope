"""快速测试 Mimo 代理"""

import os
from dotenv import load_dotenv
from openai import OpenAI

from project_paths import ENV_FILE

load_dotenv(ENV_FILE)

# Mimo 一般中转 OpenAI 协议
candidates = [
    ("mimo-default", os.getenv("MIMO_BASE_URL"), "deepseek-chat"),
    ("mimo-v1", os.getenv("MIMO_BASE_URL") + "/v1", "deepseek-chat"),
    ("mimo-claude", os.getenv("MIMO_BASE_URL"), "claude-sonnet-4-5"),
    ("mimo-gpt", os.getenv("MIMO_BASE_URL"), "gpt-4o-mini"),
]

for name, base, model in candidates:
    try:
        client = OpenAI(api_key=os.getenv("MIMO_API_KEY"), base_url=base, timeout=10.0)
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=20,
        )
        print(f"OK   {name} | {model} -> {r.choices[0].message.content[:60]}")
    except Exception as e:
        msg = str(e)[:140].replace("\n", " ")
        print(f"FAIL {name} | {model} -> {msg}")
