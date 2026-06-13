import json

from types import SimpleNamespace

from ledger import LedgerSink, MAX_BATCH_BYTES, MAX_RECORD_BYTES, build_model_invocation


def test_ledger_sink_builds_schema_shaped_records_and_dag_links():
    sink = LedgerSink("test-session")
    first = sink.observing(
        trigger_source="pytest",
        trigger_type="unit",
        trigger_description="unit test",
        trigger_payload_summary="payload",
    )
    second = sink.tool_calling(tool_name="sportmonks", description="fetch", input_payload={"id": 1}, output_payload={"ok": True})
    third = sink.thinking(prompt="digest", output_payload={"answer": 1})
    fourth = sink.acting(action_type="prediction", target_system="arena", action_summary="predict", parameters={"probability": 0.5}, dry_run=True)

    assert first["behavior"] == "Observing"
    assert second["upstream_record_id"] == [first["record_id"]]
    assert third["upstream_record_id"] == [second["record_id"]]
    assert json.loads(third["output_payload"]) == {"answer": 1}
    assert fourth["dry_run"] is True
    assert "agent_id" not in fourth


def test_prediction_record_is_cloned_for_batch_trace():
    sink = LedgerSink("test-session")
    first = sink.thinking(prompt="digest", output_payload="ready")
    prediction = sink.acting(
        action_type="prediction",
        target_system="arena",
        action_summary="predict",
        parameters={"fixture_id": "WC2026-GS-M1", "outcome": "MEX", "probability": 0.5},
        dry_run=False,
    )
    order = sink.acting(action_type="open_order", target_system="arena", action_summary="order", parameters={}, dry_run=True)

    result = sink.submit(dry_run=True)
    batch_prediction = result["records"][1]
    batch_order = result["records"][2]

    assert batch_prediction["record_id"] != prediction["record_id"]
    assert batch_prediction["parameters"] == prediction["parameters"]
    assert batch_order["upstream_record_id"] == [batch_prediction["record_id"]]
    assert result["records"][0]["record_id"] == first["record_id"]


def test_build_model_invocation_uses_structured_openrouter_fields_and_reasoning():
    metrics = SimpleNamespace(input_tokens=[10, 5], output_tokens=[7])
    response = SimpleNamespace(extra_data={"reasoning_content": "private provider reasoning"})

    invocation = build_model_invocation(metrics=metrics, response=response)

    assert invocation["provider"] == "openrouter"
    assert invocation["model_name"]
    assert invocation["tokens_in"] == 15
    assert invocation["tokens_out"] == 7
    assert invocation["internal_reasoning"] == "private provider reasoning"


def test_ledger_sink_dry_run_submit_does_not_post():
    sink = LedgerSink("test-session")
    sink.observing(trigger_source="pytest", trigger_type="unit", trigger_description="unit test", trigger_payload_summary="payload")

    result = sink.submit(dry_run=True)

    assert result["dry_run"] is True
    assert result["submitted"] is False
    assert result["record_count"] == 1


def test_ledger_sink_dry_run_submit_carries_fixture_id():
    sink = LedgerSink("test-session")
    sink.observing(trigger_source="pytest", trigger_type="unit", trigger_description="unit test", trigger_payload_summary="payload")

    result = sink.submit(dry_run=True, fixture_id="19609127")

    assert result["fixture_id"] == "19609127"


def test_ledger_sink_enforces_64kb_payload_size_limit():
    sink = LedgerSink("test-session")
    
    # Add a huge thinking record with 80KB of output_payload
    large_payload = "A" * 80000
    sink.thinking(prompt="heavy output", output_payload=large_payload)
    
    # Add a second heavy model invocation thinking record with 70KB of reasoning
    large_reasoning = "B" * 70000
    sink.thinking(
        prompt="heavy reasoning", 
        output_payload="short final answer", 
        model_invocation={
            "provider": "openrouter",
            "model_name": "deepseek/deepseek-v4-pro",
            "internal_reasoning": large_reasoning
        }
    )

    result = sink.submit(dry_run=True)
    
    # Access the records after they passed through submit()'s size limiter
    batch_records = result["records"]
    assert len(batch_records) == 2
    
    first_record = batch_records[0]
    second_record = batch_records[1]
    
    # Ensure they have been truncated
    assert len(first_record["output_payload"]) < 80000
    assert "[TRUNCATED]" in first_record["output_payload"]
    assert len(json.dumps(first_record, ensure_ascii=True).encode("utf-8")) <= MAX_RECORD_BYTES
    
    assert len(second_record["model_invocation"]["internal_reasoning"]) < 70000
    assert "[TRUNCATED]" in second_record["model_invocation"]["internal_reasoning"]
    assert len(json.dumps(second_record, ensure_ascii=True).encode("utf-8")) <= MAX_RECORD_BYTES
    assert len(json.dumps({"records": batch_records}, ensure_ascii=True).encode("utf-8")) <= MAX_BATCH_BYTES


def test_submit_record_dry_run_applies_single_record_size_limit():
    sink = LedgerSink("test-session")
    record = sink.thinking(
        prompt="heavy output",
        output_payload="X" * 90000,
        model_invocation={
            "provider": "openrouter",
            "model_name": "deepseek/deepseek-v4-pro",
            "internal_reasoning": "Y" * 90000,
        },
    )

    result = sink.submit_record(record, dry_run=True)
    submitted = result["record"]

    assert "[TRUNCATED]" in submitted["output_payload"]
    assert "[TRUNCATED]" in submitted["model_invocation"]["internal_reasoning"]
    assert len(json.dumps(submitted, ensure_ascii=True).encode("utf-8")) <= MAX_RECORD_BYTES


def test_planning_record_builds_correct_shape():
    sink = LedgerSink("test-session")
    plan = sink.planning(
        goal="Analyze fixture and place bet.",
        description="Pre-match trading plan.",
        steps=[
            {"index": 0, "description": "Select fixture."},
            {"index": 1, "description": "Gather data.", "depends_on": [0]},
        ],
        contingencies=["Skip if no edge."],
    )

    assert plan["behavior"] == "Planning"
    assert plan["goal"] == "Analyze fixture and place bet."
    assert len(plan["steps"]) == 2
    assert plan["contingencies"] == ["Skip if no edge."]
    assert plan["description"] == "Pre-match trading plan."


def test_reflecting_record_builds_correct_shape():
    sink = LedgerSink("test-session")
    think = sink.thinking(prompt="digest", output_payload="ready")
    reflect = sink.reflecting(
        inputs=[{"input_payload": json.dumps({"prediction": {"outcome": "MEX", "probability": 0.5}})}],
        output_payload=json.dumps({"edge_pp": 3.5, "confidence": "moderate"}),
        description="Post-decision quality assessment.",
    )

    assert reflect["behavior"] == "Reflecting"
    assert reflect["upstream_record_id"] == [think["record_id"]]
    assert json.loads(reflect["output_payload"])["edge_pp"] == 3.5
    assert reflect["description"] == "Post-decision quality assessment."


def test_full_trace_with_planning_and_reflecting():
    sink = LedgerSink("test-session")
    obs = sink.observing(trigger_source="pytest", trigger_type="cron_trigger", trigger_description="test", trigger_payload_summary="payload")
    plan = sink.planning(goal="Test plan.", steps=[{"index": 0, "description": "Step 1."}])
    tool = sink.tool_calling(tool_name="sportmonks", description="fetch data", input_payload={}, output_payload={})
    think = sink.thinking(prompt="digest", output_payload="ready")
    act = sink.acting(action_type="prediction", target_system="arena", action_summary="predict", parameters={"probability": 0.5}, dry_run=True)
    reflect = sink.reflecting(inputs=[{"input_payload": "test"}], output_payload="done")

    result = sink.submit(dry_run=True)
    assert result["record_count"] == 6
    behaviors = [r["behavior"] for r in result["records"]]
    assert behaviors == ["Observing", "Planning", "ToolCalling", "Thinking", "Acting", "Reflecting"]
