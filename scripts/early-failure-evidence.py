#!/usr/bin/env python3
"""Runner-independent, stdlib-only early-failure audit evidence."""
import json
import os
import pathlib
import re
import sys
from datetime import datetime, timezone

STAGES = (
    "caller", "checkout_qa", "checkout_app", "revisions", "node_setup",
    "qa_deps", "app_deps", "gate_selftest", "policy_selftest",
    "triage_selftest", "ai_contract", "app_build", "chromium",
    "validate", "report_gate", "provenance", "evidence_selftest",
    "evidence_manifest",
)
STATES = {"success", "failure", "cancelled", "skipped"}
SHA = re.compile(r"^[a-fA-F0-9]{40}$")
RUN = re.compile(r"^[0-9]+$")
REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")

def safe(name, value):
    if name in ("runId", "runAttempt"):
        return value if value and RUN.fullmatch(value) else None
    if name in ("eventSha", "qaPin", "appTestSha"):
        return value.lower() if value and SHA.fullmatch(value) else None
    if name == "repository":
        return value if value and REPO.fullmatch(value) else None
    if name == "event":
        return value if value in ("push", "pull_request", "workflow_dispatch") else None
    return None

def build(env):
    outcomes = {}
    for name in STAGES:
        value = env.get("STAGE_" + name.upper(), "").lower()
        outcomes[name] = value if value in STATES else "unknown"
    non_success = [(name, value) for name, value in outcomes.items()
                   if value in ("failure", "cancelled")]
    if non_success:
        failure = non_success[0]
    else:
        unverified = [(name, value) for name, value in outcomes.items()
                      if value in ("skipped", "unknown")]
        failure = unverified[0] if unverified else None
    status = "incomplete" if failure or any(x != "success" for x in outcomes.values()) else "steps-successful"
    return {
        "schemaVersion": 1,
        "kind": "portfolio-qa-early-failure",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "evidenceStatus": status,
        "firstNonSuccessStage": failure[0] if failure else None,
        "firstNonSuccessOutcome": failure[1] if failure else None,
        "context": {
            "repository": safe("repository", env.get("GITHUB_REPOSITORY")),
            "runId": safe("runId", env.get("GITHUB_RUN_ID")),
            "runAttempt": safe("runAttempt", env.get("GITHUB_RUN_ATTEMPT")),
            "event": safe("event", env.get("GITHUB_EVENT_NAME")),
            "eventSha": safe("eventSha", env.get("GITHUB_SHA")),
            "qaPin": safe("qaPin", env.get("QA_SOURCE_PIN")),
            "appTestSha": safe("appTestSha", env.get("APP_TEST_PIN")),
        },
        "stages": outcomes,
        "note": "Advisory stage evidence only; cannot override the GitHub job verdict or strict Playwright report.",
    }

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("write", "selftest"):
        raise SystemExit("usage: python3 early-failure-evidence.py write|selftest")
    if sys.argv[1] == "selftest":
        env = {"GITHUB_RUN_ID": "12", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": "a" * 40}
        for stage in STAGES:
            env["STAGE_" + stage.upper()] = "success"
        healthy = build(env)
        assert healthy["evidenceStatus"] == "steps-successful"
        for failed_stage in ("caller", "checkout_qa", "qa_deps", "app_build", "validate", "report_gate"):
            modified = dict(env)
            modified["STAGE_" + failed_stage.upper()] = "failure"
            result = build(modified)
            assert result["evidenceStatus"] == "incomplete"
            assert result["firstNonSuccessStage"] == failed_stage
        modified = dict(env)
        modified["STAGE_QA_DEPS"] = "skipped"
        assert build(modified)["evidenceStatus"] == "incomplete"
        modified["STAGE_QA_DEPS"] = "not-valid"
        assert build(modified)["stages"]["qa_deps"] == "unknown"
        modified["GITHUB_SHA"] = "secret-token"
        modified["GITHUB_REPOSITORY"] = "evil injected text"
        assert build(modified)["context"]["eventSha"] is None
        assert build(modified)["context"]["repository"] is None
        print("Early-failure contract self-tests passed.")
        return
    dest = pathlib.Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "portfolio-qa-early-evidence"
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / "early-failure.json"
    temp = dest / "early-failure.json.tmp"
    temp.write_text(json.dumps(build(os.environ), indent=2) + "\n", encoding="utf-8")
    temp.replace(path)
    print("Early-failure stage evidence recorded at runner temp.")

if __name__ == "__main__":
    main()
