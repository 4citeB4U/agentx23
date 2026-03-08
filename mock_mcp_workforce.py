from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/mcp/<agent_type>', methods=['POST'])
def mock_qwen3_response(agent_type):
    data = request.json or {}
    print(f"🛠️ [MOCK {agent_type.upper()}] Received task: {data.get('action')}")

    responses = {
        "health": {"status": "analyzed", "metrics": {"cpu": 45, "ram": 60}, "diagnosis": "UI_REDO_REQUIRED"},
        "vision": {"status": "seen", "issue": "Submit button is 5px off-center", "coordinates": [102, 450]},
        "coder": {"status": "patched", "fix": "Set margin-left: auto;", "verification": "SYNTAX_OK"}
    }

    return jsonify(responses.get(agent_type, {"error": "unknown agent"}))


if __name__ == '__main__':
    # Running on 8080 to act as our local Qwen3 fleet
    print("[MOCK WORKFORCE] Starting on port 8080")
    app.run(host='127.0.0.1', port=8080)
