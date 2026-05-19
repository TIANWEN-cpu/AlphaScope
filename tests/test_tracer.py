"""Tests for lightweight tracing module"""

import pytest
import time

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.utils.tracer import (
    Tracer,
    Span,
    traced,
    traced_func,
    get_tracer,
    get_all_stats,
)


class TestSpan:
    def test_create(self):
        span = Span(name="test.op", operation="op")
        assert span.name == "test.op"
        assert span.status == "ok"
        assert span.duration_ms == 0

    def test_set_attribute(self):
        span = Span(name="test")
        span.set("key", "value")
        assert span.attributes["key"] == "value"

    def test_finish(self):
        span = Span(name="test", start_time=time.time())
        span.finish("ok")
        assert span.duration_ms >= 0
        assert span.status == "ok"

    def test_finish_with_error(self):
        span = Span(name="test", start_time=time.time())
        span.finish("error", "something broke")
        assert span.status == "error"
        assert span.error == "something broke"

    def test_to_dict(self):
        span = Span(name="test.op", operation="op", start_time=time.time())
        span.set("count", 42)
        span.finish()
        d = span.to_dict()
        assert d["name"] == "test.op"
        assert d["operation"] == "op"
        assert d["status"] == "ok"
        assert d["attributes"]["count"] == 42
        assert "timestamp" in d


class TestTracer:
    def test_start_end_span(self):
        tracer = Tracer("test")
        span = tracer.start_span("op1")
        assert span.name == "test.op1"
        span.finish()
        tracer.end_span(span)
        traces = tracer.get_traces()
        assert len(traces) == 1
        assert traces[0]["name"] == "test.op1"

    def test_max_spans_ring_buffer(self):
        tracer = Tracer("test", max_spans=5)
        for i in range(10):
            span = tracer.start_span(f"op{i}")
            span.finish()
            tracer.end_span(span)
        traces = tracer.get_traces(limit=100)
        assert len(traces) == 5
        # Should keep the last 5
        assert traces[0]["operation"] == "op5"

    def test_get_traces_filter_status(self):
        tracer = Tracer("test")
        s1 = tracer.start_span("ok_op")
        s1.finish("ok")
        tracer.end_span(s1)
        s2 = tracer.start_span("err_op")
        s2.finish("error", "fail")
        tracer.end_span(s2)
        assert len(tracer.get_traces(status="ok")) == 1
        assert len(tracer.get_traces(status="error")) == 1

    def test_stats(self):
        tracer = Tracer("test")
        for i in range(3):
            s = tracer.start_span(f"op{i}")
            time.sleep(0.001)
            s.finish("ok" if i < 2 else "error", "" if i < 2 else "fail")
            tracer.end_span(s)
        stats = tracer.get_stats()
        assert stats["total"] == 3
        assert stats["errors"] == 1
        assert stats["avg_ms"] > 0

    def test_clear(self):
        tracer = Tracer("test")
        s = tracer.start_span("op")
        s.finish()
        tracer.end_span(s)
        tracer.clear()
        assert len(tracer.get_traces()) == 0


class TestTracedContextManager:
    def test_success(self):
        tracer = get_tracer("ctx_test")
        tracer.clear()
        with traced("test_op", "ctx_test", key="val") as span:
            span.set("result", 42)
        traces = tracer.get_traces()
        assert len(traces) >= 1
        last = traces[-1]
        assert last["status"] == "ok"
        assert last["attributes"]["result"] == 42

    def test_error(self):
        tracer = get_tracer("ctx_err_test")
        tracer.clear()
        with pytest.raises(ValueError):
            with traced("failing_op", "ctx_err_test"):
                raise ValueError("boom")
        traces = tracer.get_traces(status="error")
        assert len(traces) >= 1
        assert "boom" in traces[-1]["error"]


class TestTracedDecorator:
    def test_basic(self):
        @traced_func("my_func", "decorator_test")
        def my_func(x, y):
            return x + y

        result = my_func(1, 2)
        assert result == 3

    def test_traced(self):
        tracer = get_tracer("decorator_test2")
        tracer.clear()

        @traced_func("add", "decorator_test2")
        def add(a, b):
            return a + b

        add(3, 4)
        traces = tracer.get_traces()
        assert len(traces) >= 1
        assert traces[-1]["operation"] == "add"


class TestGetAllStats:
    def test_returns_dict(self):
        stats = get_all_stats()
        assert isinstance(stats, dict)
