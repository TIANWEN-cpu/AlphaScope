"""
Plugin System: 插件/扩展系统基础。

职责：
- 插件发现和加载
- 插件生命周期管理
- 插件注册（Agent、Tool、Provider 扩展点）

架构文档要求的"插件市场"基础。
"""

import importlib
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

PLUGIN_DIRS = [
    Path("custom_plugins"),
    Path("plugins"),
]


@dataclass
class PluginInfo:
    """插件信息"""

    plugin_id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = ""
    plugin_type: str = "generic"  # agent, tool, provider, workflow
    enabled: bool = True
    module_path: str = ""
    entry_point: str = ""


@dataclass
class PluginManifest:
    """插件清单"""

    id: str
    name: str
    version: str
    description: str = ""
    author: str = ""
    type: str = "generic"
    entry: str = "plugin.py"
    dependencies: List[str] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)


class PluginManager:
    """插件管理器"""

    def __init__(self):
        self._plugins: Dict[str, PluginInfo] = {}
        self._loaded_modules: Dict[str, Any] = {}
        self._extension_points: Dict[str, List[Callable]] = {
            "agent": [],
            "tool": [],
            "provider": [],
            "workflow": [],
        }

    def discover_plugins(self):
        """发现所有可用插件"""
        for plugin_dir in PLUGIN_DIRS:
            if not plugin_dir.exists():
                continue

            for item in plugin_dir.iterdir():
                if item.is_dir():
                    manifest_path = item / "manifest.json"
                    if manifest_path.exists():
                        self._load_manifest(item, manifest_path)
                elif item.suffix == ".py" and item.name != "__init__.py":
                    self._register_single_file_plugin(item)

    def _load_manifest(self, plugin_dir: Path, manifest_path: Path):
        """从 manifest.json 加载插件信息"""
        try:
            import json

            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest = PluginManifest(**data)

            plugin = PluginInfo(
                plugin_id=manifest.id,
                name=manifest.name,
                version=manifest.version,
                description=manifest.description,
                author=manifest.author,
                plugin_type=manifest.type,
                module_path=str(plugin_dir / manifest.entry),
                entry_point=manifest.entry,
            )
            self._plugins[plugin.plugin_id] = plugin
            logger.info(f"发现插件: {plugin.name} ({plugin.plugin_id})")

        except Exception as e:
            logger.warning(f"加载插件清单失败 {manifest_path}: {e}")

    def _register_single_file_plugin(self, file_path: Path):
        """注册单文件插件"""
        plugin_id = file_path.stem
        if plugin_id not in self._plugins:
            self._plugins[plugin_id] = PluginInfo(
                plugin_id=plugin_id,
                name=plugin_id.replace("_", " ").title(),
                module_path=str(file_path),
            )

    def load_plugin(self, plugin_id: str) -> bool:
        """加载插件"""
        if plugin_id in self._loaded_modules:
            return True

        plugin = self._plugins.get(plugin_id)
        if not plugin:
            logger.warning(f"插件不存在: {plugin_id}")
            return False

        try:
            spec = importlib.util.spec_from_file_location(plugin_id, plugin.module_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                self._loaded_modules[plugin_id] = module

                # 调用插件初始化函数
                if hasattr(module, "on_load"):
                    module.on_load()

                logger.info(f"已加载插件: {plugin.name}")
                return True

        except Exception as e:
            logger.error(f"加载插件失败 {plugin_id}: {e}")

        return False

    def unload_plugin(self, plugin_id: str):
        """卸载插件"""
        module = self._loaded_modules.pop(plugin_id, None)
        if module and hasattr(module, "on_unload"):
            try:
                module.on_unload()
            except Exception as e:
                logger.warning(f"插件卸载回调失败 {plugin_id}: {e}")

    def register_extension(self, point: str, handler: Callable):
        """注册扩展点"""
        if point not in self._extension_points:
            self._extension_points[point] = []
        self._extension_points[point].append(handler)

    def get_extensions(self, point: str) -> List[Callable]:
        """获取扩展点的所有处理器"""
        return self._extension_points.get(point, [])

    def list_plugins(self) -> List[Dict[str, Any]]:
        """列出所有插件"""
        return [
            {
                "id": p.plugin_id,
                "name": p.name,
                "version": p.version,
                "type": p.plugin_type,
                "enabled": p.enabled,
                "loaded": p.plugin_id in self._loaded_modules,
            }
            for p in self._plugins.values()
        ]

    def enable_plugin(self, plugin_id: str):
        """启用插件"""
        if plugin_id in self._plugins:
            self._plugins[plugin_id].enabled = True

    def disable_plugin(self, plugin_id: str):
        """禁用插件"""
        if plugin_id in self._plugins:
            self._plugins[plugin_id].enabled = False
            self.unload_plugin(plugin_id)


# 单例
_manager: Optional[PluginManager] = None


def get_plugin_manager() -> PluginManager:
    """获取全局插件管理器"""
    global _manager
    if _manager is None:
        _manager = PluginManager()
        _manager.discover_plugins()
    return _manager
