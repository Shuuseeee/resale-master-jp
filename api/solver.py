# -*- coding: utf-8 -*-
"""Vercel Python 函数：出货方案求解（POST /api/solver）。

只供本应用的 MCP 路由（app/api/mcp）在服务端调用：请求头 x-solver-secret 必须等于环境变量 SOLVER_SECRET。
请求体 JSON：
  {"action": "plan", "items": [...], "exclude_stores": [...], "stale_limit": 7, "day": "YYYY-MM-DD"}
  {"action": "rules", "day": "YYYY-MM-DD"}
计算在 solver/service.py（规则与求解器在 solver/core/，来自原 ResaleAssist）。
"""
import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "solver"))

import service  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        secret = os.environ.get("SOLVER_SECRET", "")
        given = self.headers.get("x-solver-secret", "")
        if not secret or not hmac.compare_digest(secret, given):
            return self._send(401, {"ok": False, "error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._send(400, {"ok": False, "error": "invalid json"})
        action = payload.get("action")
        try:
            if action == "plan":
                return self._send(200, service.plan(payload))
            if action == "rules":
                return self._send(200, service.rules_summary(payload.get("day")))
        except Exception as e:  # noqa: BLE001 — 把求解失败原样告诉调用方，而不是 500 空响应
            return self._send(500, {"ok": False, "error": "%s: %s" % (type(e).__name__, e)})
        return self._send(400, {"ok": False, "error": "unknown action"})
