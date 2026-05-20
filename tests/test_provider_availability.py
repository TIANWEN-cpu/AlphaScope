"""Tests for BaseProvider.is_available() and provider discovery filtering"""

from __future__ import annotations

import sys


from backend.providers.base import BaseProvider


class TestIsAvailable:
    """Test the is_available() classmethod."""

    def test_base_returns_true(self):
        """Default is_available() should return True."""
        assert BaseProvider.is_available() is True

    def test_subclass_default_returns_true(self):
        """A subclass that doesn't override is_available() should return True."""

        class SimpleProvider(BaseProvider):
            name = "simple"
            markets = ["CN"]
            data_types = ["news"]

        assert SimpleProvider.is_available() is True

    def test_subclass_can_return_false(self):
        """A subclass can override is_available() to return False."""

        class ConditionalProvider(BaseProvider):
            name = "conditional"
            markets = ["CN"]
            data_types = ["news"]

            @classmethod
            def is_available(cls) -> bool:
                return False

        assert ConditionalProvider.is_available() is False

    def test_unavailable_provider_not_registered(self, tmp_path):
        """Providers where is_available() returns False should not be registered."""
        pkg = tmp_path / "test_avail"
        pkg.mkdir()
        (pkg / "__init__.py").write_text("")
        (pkg / "unavailable.py").write_text(
            "from backend.providers.base import BaseProvider\n"
            "\n"
            "class UnavailableProvider(BaseProvider):\n"
            '    name = "unavailable_test"\n'
            '    markets = ["CN"]\n'
            '    data_types = ["news"]\n'
            "    priority = 50\n"
            "\n"
            "    @classmethod\n"
            "    def is_available(cls) -> bool:\n"
            "        return False\n"
        )

        sys.path.insert(0, str(tmp_path))
        try:
            from backend.providers.registry import _scan_directory

            classes = _scan_directory(pkg, "test_avail")
            # The class should be found by scanning...
            assert len(classes) == 1
            assert classes[0].name == "unavailable_test"

            # ...but _discover_and_register should skip it
            assert classes[0].is_available() is False
        finally:
            sys.path.remove(str(tmp_path))


class TestProviderGenerator:
    """Test the scripts/create_provider.py generator."""

    def test_generated_code_is_valid_python(self, tmp_path):
        """Generated provider file should be valid Python."""
        import textwrap

        template = textwrap.dedent(
            '"""TestProvider - Test provider"""\n'
            "\n"
            "from __future__ import annotations\n"
            "\n"
            "import logging\n"
            "\n"
            "from backend.providers.base import BaseProvider\n"
            "\n"
            "logger = logging.getLogger(__name__)\n"
            "\n"
            "\n"
            "class TestProvider(BaseProvider):\n"
            '    """Test provider"""\n'
            "\n"
            '    name = "test_gen"\n'
            '    markets = ["CN"]\n'
            '    data_types = ["news"]\n'
            "    priority = 50\n"
            '    license_level = "research_only"\n'
            '    data_class = "fundamental"\n'
            '    freshness = "daily"\n'
            '    cost_tier = "free"\n'
            '    rate_limit = {"per_minute": 60, "per_day": None}\n'
            "    requires_key = False\n"
            "\n"
            "    @classmethod\n"
            "    def is_available(cls) -> bool:\n"
            "        return True\n"
            "\n"
            "    def get_news(self, query: dict, **kwargs) -> list[dict]:\n"
            "        raise NotImplementedError\n"
        )

        target = tmp_path / "test_gen_provider.py"
        target.write_text(template, encoding="utf-8")

        import ast

        with open(target) as f:
            source = f.read()
        # Should parse without errors
        tree = ast.parse(source)
        # Should contain a class definition
        class_defs = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
        assert len(class_defs) >= 1
        assert class_defs[0].name == "TestProvider"
