import json

from ledger import LedgerSink


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


def test_ledger_sink_dry_run_submit_does_not_post():
    sink = LedgerSink("test-session")
    sink.observing(trigger_source="pytest", trigger_type="unit", trigger_description="unit test", trigger_payload_summary="payload")

    result = sink.submit(dry_run=True)

    assert result["dry_run"] is True
    assert result["submitted"] is False
    assert result["record_count"] == 1
