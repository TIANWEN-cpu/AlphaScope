"""第三轮探测：重试 GPT 503，深挖 SenseNova 模型，Mimo 参数细节"""

import os
import time
import json
from dotenv import load_dotenv
from project_paths import ENV_FILE

load_dotenv(ENV_FILE)
from openai import OpenAI
import requests

# 1) GPT 503 重试 + 看看有没有 /models 列表
print("【1】GPT 代理 - 列模型")
try:
    r = requests.get(
        os.getenv("GPT_BASE_URL") + "/v1/models",
        headers={"Authorization": f"Bearer {os.getenv('GPT_API_KEY')}"},
        timeout=12,
    )
    print(f"  HTTP {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        models = [m["id"] for m in data.get("data", [])][:20]
        print(f"  前 20 个模型: {models}")
    else:
        print(f"  {r.text[:200]}")
except Exception as e:
    print(f"  失败: {e}")

# 2) Claude 代理 /models
print("\n【2】Claude 代理 - 列模型")
try:
    r = requests.get(
        os.getenv("CLAUDE_BASE_URL") + "/v1/models",
        headers={"Authorization": f"Bearer {os.getenv('CLAUDE_API_KEY')}"},
        timeout=12,
    )
    print(f"  HTTP {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        models = [m["id"] for m in data.get("data", [])][:30]
        print(f"  模型: {models}")
    else:
        print(f"  {r.text[:200]}")
except Exception as e:
    print(f"  失败: {e}")

# 3) Mimo /models
print("\n【3】Mimo - 列模型")
for path in ["/v1/models", "/models", "/api/v1/models"]:
    try:
        r = requests.get(
            os.getenv("MIMO_BASE_URL") + path,
            headers={"Authorization": f"Bearer {os.getenv('MIMO_API_KEY')}"},
            timeout=12,
        )
        print(f"  {path}: HTTP {r.status_code}")
        if r.status_code == 200:
            try:
                data = r.json()
                print(f"    {json.dumps(data, ensure_ascii=False)[:400]}")
            except:
                print(f"    {r.text[:300]}")
            break
    except Exception as e:
        print(f"  {path}: {e}")

# 4) SenseNova /models
print("\n【4】SenseNova - 列模型")
try:
    r = requests.get(
        os.getenv("SENSENOVA_BASE_URL") + "/models",
        headers={"Authorization": f"Bearer {os.getenv('SENSENOVA_API_KEY')}"},
        timeout=12,
    )
    print(f"  HTTP {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        models = [m["id"] for m in data.get("data", [])][:30]
        print(f"  模型: {models}")
    else:
        print(f"  {r.text[:300]}")
except Exception as e:
    print(f"  失败: {e}")

# 5) GPT 503 二次重试
print("\n【5】GPT 503 重试 (gpt-4o-mini)")
for i in range(3):
    try:
        client = OpenAI(
            api_key=os.getenv("GPT_API_KEY"),
            base_url=os.getenv("GPT_BASE_URL") + "/v1",
            timeout=15,
        )
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10,
        )
        print(f"  尝试 {i + 1}: OK -> {r.choices[0].message.content[:30]}")
        break
    except Exception as e:
        print(f"  尝试 {i + 1}: {str(e)[:120]}")
        time.sleep(2)
