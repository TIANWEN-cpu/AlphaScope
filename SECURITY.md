# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.13.x  | Yes |
| < 0.13  | No |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: 3508137206@qq.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact

You should receive a response within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Security Measures

- **Prompt injection protection** — `sanitize_prompt_input()` filters injection patterns from user inputs before they reach LLM prompts
- **Input validation** — stock codes validated via whitelist (`validate_stock_code()`)
- **LLM base URL validation** — custom base URLs reject private/local addresses by default
- **Credential isolation** — fallback LLM providers do not reuse primary provider API keys
- **Thread safety** — database and vector store operations use double-checked locking

## Known Limitations

- This is a research tool, not a production trading system
- LLM outputs are not audited for financial advice compliance
- No authentication or multi-user isolation currently
