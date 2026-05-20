"""AI 对话编排器

路由用户请求到适当的分析管道：
- FREE: ai_chat.send_message (简单问答)
- STANDARD: llm_agents.run_agents_with_mode(STANDARD) (3 Agent)
- DEEP: llm_agents.run_agents_with_mode(DEEP) (5 Agent + Critic + Chairman)
- EXPERT: expert_panel.run_team_roundtable (专家团圆桌)

不重复实现分析逻辑，只做路由和上下文拼接。
"""

from __future__ import annotations

import logging
import os
import sys
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 确保 backend 在 path 中
_backend_dir = os.path.join(os.path.dirname(__file__), "..")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from .compliance import wrap_with_disclaimer
from .conversation_store import ConversationStore
from .report_generator import generate_report


class AnalysisMode(Enum):
    FREE = "free"
    STANDARD = "standard"
    DEEP = "deep"
    EXPERT = "expert"


# 模式标签映射
MODE_LABELS = {
    AnalysisMode.FREE: "自由问答",
    AnalysisMode.STANDARD: "标准分析",
    AnalysisMode.DEEP: "深度分析",
    AnalysisMode.EXPERT: "专家团圆桌",
}


def _import_ai_chat():
    """延迟导入 ai_chat 模块"""
    from ai_chat import new_session, send_message

    return new_session, send_message


def _import_llm_agents():
    """延迟导入 llm_agents 模块"""
    from agent_modes import AnalysisMode as AgentAnalysisMode
    from llm_agents import build_market_brief, run_agents_with_mode

    return run_agents_with_mode, build_market_brief, AgentAnalysisMode


def _import_expert_panel():
    """延迟导入 expert_panel 模块"""
    from expert_panel import (
        ExpertTeamConfig,
        load_default_team,
        load_experts_config_v2,
        run_team_roundtable,
    )

    return (
        run_team_roundtable,
        load_experts_config_v2,
        load_default_team,
        ExpertTeamConfig,
    )


class ChatOrchestrator:
    """路由用户查询到适当的分析管道。

    包装现有模块，管理对话生命周期。
    """

    def __init__(self, store: Optional[ConversationStore] = None):
        self._store = store or ConversationStore()
        self._chat_sessions = {}  # conversation_id -> ChatSession (for FREE mode)

    def new_conversation(
        self,
        stock_symbol: str = "",
        stock_name: str = "",
        mode: AnalysisMode = AnalysisMode.FREE,
        provider: str = "deepseek",
        model: str = "deepseek-chat",
        title: str = "",
    ) -> str:
        """创建新对话，返回 ID"""
        if not title:
            mode_label = MODE_LABELS.get(mode, mode.value)
            if stock_symbol:
                title = f"{stock_name}({stock_symbol}) - {mode_label}"
            else:
                title = f"{mode_label} - {__import__('datetime').datetime.now().strftime('%m-%d %H:%M')}"
        return self._store.create_conversation(
            title=title,
            stock_symbol=stock_symbol,
            stock_name=stock_name,
            mode=mode.value,
            provider=provider,
            model=model,
        )

    def send_message(
        self,
        conversation_id: str,
        user_input: str,
        stock_data: Optional[Dict[str, Any]] = None,
        expert_team_id: Optional[str] = None,
        global_ai_settings: Optional[dict] = None,
    ) -> dict:
        """处理用户消息，返回响应。

        Args:
            conversation_id: 对话 ID
            user_input: 用户输入
            stock_data: 股票数据字典 (来自 dashboard 的 stock_data)
            expert_team_id: 专家团 ID (仅 EXPERT 模式)
            global_ai_settings: 全局 AI 设置

        Returns:
            {
                "mode": str,
                "content": str,
                "agents": dict,       # standard/deep/expert
                "evidence": list,     # evidence chain
                "summary": dict,      # voting summary
                "compliance_note": str,
            }
        """
        # 存储用户消息
        self._store.add_message(conversation_id, "user", user_input)

        # 获取对话信息
        conv = self._store.get_conversation(conversation_id)
        if not conv:
            return {"mode": "error", "content": "对话不存在"}

        mode_str = conv.get("mode", "free")
        try:
            mode = AnalysisMode(mode_str)
        except ValueError:
            mode = AnalysisMode.FREE

        # 路由到对应的处理函数
        try:
            if mode == AnalysisMode.FREE:
                result = self._handle_free_mode(
                    conversation_id, user_input, stock_data, conv
                )
            elif mode in (AnalysisMode.STANDARD, AnalysisMode.DEEP):
                result = self._handle_agent_mode(
                    conversation_id, user_input, stock_data, mode, conv
                )
            elif mode == AnalysisMode.EXPERT:
                result = self._handle_expert_mode(
                    conversation_id, user_input, stock_data, expert_team_id, conv
                )
            else:
                result = {"mode": mode_str, "content": "不支持的分析模式"}
        except Exception as e:
            logger.error("分析失败: %s", e, exc_info=True)
            result = {
                "mode": mode_str,
                "content": f"分析过程中出现错误: {str(e)[:300]}",
                "error": True,
            }

        # 追加合规提示
        content = result.get("content", "")
        result["compliance_note"] = wrap_with_disclaimer("", mode_str)
        result["content"] = wrap_with_disclaimer(content, mode_str)

        # 存储助手回复
        self._store.add_message(
            conversation_id,
            "assistant",
            result["content"],
            metadata={
                "mode": mode_str,
                "agents": result.get("agents", {}),
                "evidence": result.get("evidence", []),
                "summary": result.get("summary", {}),
            },
        )

        return result

    def _handle_free_mode(
        self,
        conversation_id: str,
        user_input: str,
        stock_data: Optional[dict],
        conv: dict,
    ) -> dict:
        """自由问答模式 - 委托给 ai_chat.send_message"""
        new_session, send_message = _import_ai_chat()

        # 构建上下文
        ctx = {}
        if stock_data:
            ctx = {
                "close": stock_data.get("close", 0),
                "day_change": stock_data.get("day_change", 0),
                "period_change": stock_data.get("period_change", 0),
                "ma5": stock_data.get("ma5", "N/A"),
                "ma20": stock_data.get("ma20", "N/A"),
                "ma60": stock_data.get("ma60", "N/A"),
                "fund_dir": stock_data.get("fund_dir", "暂无主力资金数据"),
                "data_date": stock_data.get("data_date", ""),
            }

        # 获取或创建 chat session
        if conversation_id not in self._chat_sessions:
            provider = conv.get("provider", "deepseek")
            self._chat_sessions[conversation_id] = new_session(
                stock_symbol=conv.get("stock_symbol", ""),
                stock_name=conv.get("stock_name", ""),
                ctx=ctx,
                provider=provider if provider != "deepseek" else None,
            )

        session = self._chat_sessions[conversation_id]
        session = send_message(session, user_input)
        self._chat_sessions[conversation_id] = session

        # 取最后一条助手消息
        reply = ""
        for msg in reversed(session.messages):
            if msg.role == "assistant":
                reply = msg.content
                break

        return {"mode": "free", "content": reply}

    def _handle_agent_mode(
        self,
        conversation_id: str,
        user_input: str,
        stock_data: Optional[dict],
        mode: AnalysisMode,
        conv: dict,
    ) -> dict:
        """Agent 分析模式 - 委托给 llm_agents.run_agents_with_mode"""
        if not stock_data:
            return {
                "mode": mode.value,
                "content": "请先选择一只股票后再进行分析。可以在左侧输入股票代码。",
            }

        run_agents_with_mode, build_market_brief, AgentAnalysisMode = (
            _import_llm_agents()
        )

        # 注入用户问题到 stock_data
        enhanced_data = dict(stock_data)
        if user_input:
            enhanced_data["user_question"] = user_input
            # 在 related_news_brief 前加入用户关注点
            existing_news = enhanced_data.get("related_news_brief", "")
            user_focus = f"【用户特别关注】\n{user_input}\n"
            if existing_news:
                enhanced_data["related_news_brief"] = user_focus + "\n" + existing_news
            else:
                enhanced_data["related_news_brief"] = user_focus

        # 确定 Agent 模式
        agent_mode = (
            AgentAnalysisMode.STANDARD
            if mode == AnalysisMode.STANDARD
            else AgentAnalysisMode.DEEP
        )

        # 运行分析
        result = run_agents_with_mode(
            enhanced_data, mode=agent_mode, global_ai_settings=None
        )

        # 格式化输出
        agents = result.get("agents", {})
        summary = result.get("summary", {})
        chairman = result.get("chairman", "")

        content_parts = []
        if chairman:
            content_parts.append(f"## 主席总结\n\n{chairman}")

        # 投票汇总
        buy = summary.get("buy", 0)
        sell = summary.get("sell", 0)
        hold = summary.get("hold", 0)
        content_parts.append(f"\n**投票**: 买入 {buy} / 观望 {hold} / 卖出 {sell}")

        # 各 Agent 观点摘要
        content_parts.append("\n## 各 Agent 观点\n")
        for agent_key, agent_result in agents.items():
            signal = agent_result.get("signal", "hold")
            confidence = agent_result.get("confidence", 0)
            reason = agent_result.get("reason", agent_result.get("summary", ""))[:150]
            content_parts.append(
                f"- **{agent_key}**: {signal} (置信度 {confidence}%) - {reason}"
            )

        # 证据链
        evidence = []
        for agent_result in agents.values():
            ev_list = agent_result.get("evidence", [])
            if isinstance(ev_list, list):
                evidence.extend(ev_list)

        return {
            "mode": mode.value,
            "content": "\n".join(content_parts),
            "agents": agents,
            "evidence": evidence,
            "summary": summary,
        }

    def _handle_expert_mode(
        self,
        conversation_id: str,
        user_input: str,
        stock_data: Optional[dict],
        expert_team_id: Optional[str],
        conv: dict,
    ) -> dict:
        """专家团模式 - 委托给 expert_panel.run_team_roundtable"""
        if not stock_data:
            return {
                "mode": "expert",
                "content": "请先选择一只股票后再进行专家团分析。可以在左侧输入股票代码。",
            }

        (
            run_team_roundtable,
            load_experts_config_v2,
            load_default_team,
            ExpertTeamConfig,
        ) = _import_expert_panel()

        # 加载专家团
        teams = load_experts_config_v2()
        team = None
        if expert_team_id:
            for t in teams:
                if t.id == expert_team_id:
                    team = t
                    break
        if team is None:
            team = teams[0] if teams else load_default_team()

        # 构建 stock_brief
        _, build_market_brief, _ = _import_llm_agents()

        enhanced_data = dict(stock_data)
        if user_input:
            enhanced_data["user_question"] = user_input

        stock_brief = build_market_brief(enhanced_data)
        if user_input:
            stock_brief = f"【用户特别关注】\n{user_input}\n\n{stock_brief}"

        stock_name = stock_data.get("name", conv.get("stock_name", ""))

        # 运行专家团
        result = run_team_roundtable(team, stock_brief, stock_name, None)

        # 格式化输出
        opinions = result.get("opinions", {})
        summary = result.get("summary", {})

        content_parts = [f"## {team.display_name} 分析结果\n"]

        # 专家观点
        for expert_key, opinion in opinions.items():
            action = getattr(opinion, "action", "观望")
            position = getattr(opinion, "position", 0)
            view = getattr(opinion, "view", "")[:200]
            confidence = getattr(opinion, "confidence", 0)
            expert_name = getattr(opinion, "expert_name", expert_key)

            content_parts.append(f"### {expert_name}")
            content_parts.append(
                f"- **操作建议**: {action} | 仓位: {position}% | 置信度: {confidence}%"
            )
            content_parts.append(f"- **观点**: {view}")
            content_parts.append("")

        # 汇总
        buy = summary.get("buy", 0)
        hold = summary.get("hold", 0)
        reduce = summary.get("reduce", 0)
        sell = summary.get("sell", 0)
        avg_pos = summary.get("avg_position", 0)
        content_parts.append(
            f"**投票汇总**: 买入 {buy} / 观望 {hold} / 减持 {reduce} / 卖出 {sell}"
        )
        content_parts.append(f"**平均建议仓位**: {avg_pos:.0f}%")

        # 收集证据
        evidence = []
        for opinion in opinions.values():
            ev_list = getattr(opinion, "evidence", [])
            if isinstance(ev_list, list):
                evidence.extend(ev_list)

        return {
            "mode": "expert",
            "content": "\n".join(content_parts),
            "opinions": {
                k: {
                    "expert_name": getattr(v, "expert_name", k),
                    "action": getattr(v, "action", ""),
                    "position": getattr(v, "position", 0),
                    "confidence": getattr(v, "confidence", 0),
                    "view": getattr(v, "view", ""),
                    "stop_loss": getattr(v, "stop_loss", ""),
                    "invalid_if": getattr(v, "invalid_if", ""),
                }
                for k, v in opinions.items()
            },
            "evidence": evidence,
            "summary": summary,
            "team_name": team.display_name,
        }

    def load_conversation(self, conversation_id: str) -> dict:
        """加载完整对话用于显示"""
        conv = self._store.get_conversation(conversation_id)
        if not conv:
            return {}
        messages = self._store.get_messages(conversation_id)
        return {"conversation": conv, "messages": messages}

    def list_conversations(
        self, stock_symbol: Optional[str] = None, limit: int = 50
    ) -> List[dict]:
        """列出最近对话"""
        return self._store.list_conversations(stock_symbol=stock_symbol, limit=limit)

    def delete_conversation(self, conversation_id: str) -> None:
        """删除对话"""
        self._chat_sessions.pop(conversation_id, None)
        self._store.delete_conversation(conversation_id)

    def export_conversation(self, conversation_id: str) -> str:
        """导出对话为 Markdown 报告"""
        data = self.load_conversation(conversation_id)
        if not data:
            return "对话不存在"
        return generate_report(data["conversation"], data["messages"])

    def get_available_teams(self) -> List[dict]:
        """获取可用的专家团列表"""
        try:
            _, load_experts_config_v2, _, _ = _import_expert_panel()
            teams = load_experts_config_v2()
            return [
                {
                    "id": t.id,
                    "name": t.display_name,
                    "name_en": t.display_name_en,
                    "description": t.description,
                    "member_count": len(t.members),
                }
                for t in teams
            ]
        except Exception as e:
            logger.warning("加载专家团列表失败: %s", e)
            return []
