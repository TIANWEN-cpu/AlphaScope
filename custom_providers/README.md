# Custom Providers

This directory is for user-created data source providers. Any `.py` file placed here that contains a `BaseProvider` subclass will be **automatically discovered and registered** on application startup.

## Quick Start

### Option 1: Use the generator script

```bash
python scripts/create_provider.py --name my_source --markets CN --types news,reports --custom
```

### Option 2: Copy the template

```bash
cp custom_providers/_template.py custom_providers/my_source.py
# Edit my_source.py
```

## Requirements

1. The file must be a valid Python module (`.py` extension)
2. The file name must NOT start with `_` (files starting with `_` are skipped)
3. The module must contain a class that inherits from `BaseProvider`
4. The class must define the required class attributes: `name`, `markets`, `data_types`, `priority`

## Configuration

After creating your provider, add a config entry in `config/data_sources.yaml` under the relevant data type section:

```yaml
# For a news provider:
news_providers:
  my_source:
    enabled: true
    priority: 50
    timeout: 10
    retry: 2
    description: "My custom news source"
```

For providers that support multiple data types, add entries in each relevant section.

## API Key

If your provider needs an API key:

1. Add the key to `.env`: `MY_SOURCE_API_KEY=xxx`
2. Override `is_available()` to check for the key:

```python
@classmethod
def is_available(cls) -> bool:
    import os
    return bool(os.getenv("MY_SOURCE_API_KEY"))
```

## Verification

Check that your provider is registered:

```python
from backend.providers.registry import get_registry
providers = get_registry().list_providers()
print([p["name"] for p in providers])
```

Or check the Dashboard's "数据源健康" tab.
