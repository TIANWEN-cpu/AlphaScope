"""第二轮探测：修复 base_url 和模型名"""

import os
from dotenv import load_dotenv
from project_paths import ENV_FILE

load_dotenv(ENV_FILE)
from openai import OpenAI


def probe(label, key, base, model, max_tok=20):
    try:
        client = OpenAI(api_key=key, base_url=base, timeout=15.0)
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "回复：好"}],
            max_tokens=max_tok,
        )
        return True, r.choices[0].message.content[:40]
    except Exception as e:
        return False, str(e)[:200]


# 重点排查：Claude / GPT (代理可能需要 /v1) / Mimo (参数) / SenseNova (新模型名)
TESTS = [
    # Claude 代理：base + /v1
    (
        "Claude+/v1",
        os.getenv("CLAUDE_API_KEY"),
        os.getenv("CLAUDE_BASE_URL") + "/v1",
        "claude-3-5-sonnet-20241022",
    ),
    (
        "Claude+/v1",
        os.getenv("CLAUDE_API_KEY"),
        os.getenv("CLAUDE_BASE_URL") + "/v1",
        "claude-sonnet-4-5",
    ),
    (
        "Claude+/v1",
        os.getenv("CLAUDE_API_KEY"),
        os.getenv("CLAUDE_BASE_URL") + "/v1",
        "claude-sonnet-4-20250514",
    ),
    # GPT 代理：base + /v1
    (
        "GPT+/v1",
        os.getenv("GPT_API_KEY"),
        os.getenv("GPT_BASE_URL") + "/v1",
        "gpt-4o-mini",
    ),
    ("GPT+/v1", os.getenv("GPT_API_KEY"), os.getenv("GPT_BASE_URL") + "/v1", "gpt-4o"),
    ("GPT+/v1", os.getenv("GPT_API_KEY"), os.getenv("GPT_BASE_URL") + "/v1", "gpt-4.1"),
    # Mimo
    (
        "Mimo /v1",
        os.getenv("MIMO_API_KEY"),
        os.getenv("MIMO_BASE_URL") + "/v1",
        "deepseek-v3",
    ),
    (
        "Mimo /v1",
        os.getenv("MIMO_API_KEY"),
        os.getenv("MIMO_BASE_URL") + "/v1",
        "kimi-k2",
    ),
    (
        "Mimo /v1",
        os.getenv("MIMO_API_KEY"),
        os.getenv("MIMO_BASE_URL") + "/v1",
        "qwen3-coder",
    ),
    (
        "Mimo /v1",
        os.getenv("MIMO_API_KEY"),
        os.getenv("MIMO_BASE_URL") + "/v1",
        "glm-4.5",
    ),
    # SenseNova 新模型名
    (
        "SenseNova",
        os.getenv("SENSENOVA_API_KEY"),
        os.getenv("SENSENOVA_BASE_URL"),
        "SenseChat-5-1202",
    ),
    (
        "SenseNova",
        os.getenv("SENSENOVA_API_KEY"),
        os.getenv("SENSENOVA_BASE_URL"),
        "SenseNova-V6-Pro",
    ),
    (
        "SenseNova",
        os.getenv("SENSENOVA_API_KEY"),
        os.getenv("SENSENOVA_BASE_URL"),
        "SenseNova-V6-Turbo",
    ),
    (
        "SenseNova",
        os.getenv("SENSENOVA_API_KEY"),
        os.getenv("SENSENOVA_BASE_URL"),
        "SenseNova-V6-Reasoner",
    ),
    # Kimi 用官方 moonshot 域名试试（覆盖 BASE_URL）
    (
        "Kimi-moonshot",
        os.getenv("KIMI_API_KEY"),
        "https://api.moonshot.cn/v1",
        "moonshot-v1-8k",
    ),
    (
        "Kimi-moonshot",
        os.getenv("KIMI_API_KEY"),
        "https://api.moonshot.cn/v1",
        "kimi-latest",
    ),
]

print(f"{'测试':<18}{'模型':<32}{'状态':<8}消息")
print("-" * 120)
for label, key, base, model in TESTS:
    ok, msg = probe(label, key, base, model)
    flag = "OK" if ok else "FAIL"
    print(f"{label:<18}{model:<32}{flag:<8}{msg.replace(chr(10), ' ')[:80]}")
