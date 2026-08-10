#!/usr/bin/env python3
"""Validate and merge minimal-bridge expansion packs.

This helper works on exported model JSON snapshots. It does not rewrite the
Argument Chain Lab application source.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any


class PackError(ValueError):
    pass


def load_json(path: str | Path) -> dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            value = json.load(fh)
    except FileNotFoundError as exc:
        raise PackError(f"File not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PackError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PackError(f"Expected a JSON object in {path}")
    return value


def validate_with_schema(pack: dict[str, Any], schema_path: str | Path | None) -> list[str]:
    warnings: list[str] = []
    if not schema_path:
        return warnings
    schema = load_json(schema_path)
    try:
        import jsonschema  # type: ignore
    except ImportError:
        warnings.append("jsonschema is not installed; skipped JSON Schema validation.")
        return warnings
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(pack), key=lambda e: list(e.absolute_path))
    if errors:
        rendered = []
        for error in errors[:30]:
            path = ".".join(str(x) for x in error.absolute_path) or "<root>"
            rendered.append(f"{path}: {error.message}")
        extra = "" if len(errors) <= 30 else f"\n... and {len(errors) - 30} more"
        raise PackError("Schema validation failed:\n- " + "\n- ".join(rendered) + extra)
    return warnings


def collect_global_ids(model: dict[str, Any]) -> dict[str, str]:
    registry: dict[str, str] = {}
    for section in ("facts", "claims", "arguments"):
        values = model.get(section, {})
        if not isinstance(values, dict):
            raise PackError(f"Base model section {section} must be an object")
        for item_id in values:
            if item_id in registry:
                raise PackError(f"Duplicate base-model ID {item_id}")
            registry[item_id] = section
    for section in ("policies", "dilemmas"):
        values = model.get(section, [])
        if not isinstance(values, list):
            raise PackError(f"Base model section {section} must be an array")
        for item in values:
            item_id = item.get("id")
            if not item_id:
                raise PackError(f"Base model {section} record has no id")
            if item_id in registry:
                raise PackError(f"Duplicate base-model ID {item_id}")
            registry[item_id] = section
    return registry


def check_record_key(section: str, key: str, record: dict[str, Any]) -> None:
    if record.get("id") != key:
        raise PackError(f"{section}.{key} has record id {record.get('id')!r}")


def merge_mapping(
    merged: dict[str, Any],
    candidate: dict[str, Any],
    section: str,
    global_ids: dict[str, str],
) -> None:
    base_values = merged.setdefault(section, {})
    candidate_values = candidate.get(section, {})
    if not isinstance(base_values, dict) or not isinstance(candidate_values, dict):
        raise PackError(f"Section {section} must be an object")
    for key, record in candidate_values.items():
        if not isinstance(record, dict):
            raise PackError(f"{section}.{key} must be an object")
        check_record_key(section, key, record)
        if key in base_values:
            if base_values[key] != record:
                raise PackError(f"ID collision in {section}: {key}")
            continue
        if key in global_ids:
            raise PackError(f"Global ID collision: {key} already belongs to {global_ids[key]}")
        base_values[key] = copy.deepcopy(record)
        global_ids[key] = section


def merge_array(
    merged: dict[str, Any],
    candidate: dict[str, Any],
    section: str,
    global_ids: dict[str, str] | None = None,
) -> None:
    base_values = merged.setdefault(section, [])
    candidate_values = candidate.get(section, [])
    if not isinstance(base_values, list) or not isinstance(candidate_values, list):
        raise PackError(f"Section {section} must be an array")
    by_id = {item.get("id"): item for item in base_values}
    for record in candidate_values:
        if not isinstance(record, dict) or not record.get("id"):
            raise PackError(f"{section} candidate record must contain an id")
        item_id = record["id"]
        if item_id in by_id:
            if by_id[item_id] != record:
                raise PackError(f"ID collision in {section}: {item_id}")
            continue
        if global_ids is not None and item_id in global_ids:
            raise PackError(f"Global ID collision: {item_id} already belongs to {global_ids[item_id]}")
        base_values.append(copy.deepcopy(record))
        by_id[item_id] = record
        if global_ids is not None:
            global_ids[item_id] = section


def semantic_validate(model: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    facts = model.get("facts", {})
    claims = model.get("claims", {})
    arguments = model.get("arguments", {})
    policies = model.get("policies", [])
    dilemmas = model.get("dilemmas", [])

    if not all(isinstance(x, dict) for x in (facts, claims, arguments)):
        raise PackError("facts, claims, and arguments must be objects")

    for key, record in facts.items():
        check_record_key("facts", key, record)
    for key, record in claims.items():
        check_record_key("claims", key, record)
        if record.get("kind") == "terminal" and not record.get("stressTest"):
            raise PackError(f"Terminal claim {key} has no stressTest")
    for key, record in arguments.items():
        check_record_key("arguments", key, record)
        target = record.get("targetClaimId")
        bridge = record.get("bridgeClaimId")
        if target not in claims:
            raise PackError(f"Argument {key} has unknown targetClaimId {target}")
        if bridge not in claims:
            raise PackError(f"Argument {key} has unknown bridgeClaimId {bridge}")
        if claims[bridge].get("kind") not in {"bridge", "terminal"}:
            raise PackError(f"Argument {key} bridge {bridge} is not normative")
        for fact_id in record.get("factIds", []):
            if fact_id not in facts:
                raise PackError(f"Argument {key} has unknown factId {fact_id}")

    args_by_target: dict[str, list[dict[str, Any]]] = {}
    for record in arguments.values():
        args_by_target.setdefault(record["targetClaimId"], []).append(record)

    for policy in policies:
        for direction, field in (("support", "supportClaimId"), ("oppose", "opposeClaimId")):
            claim_id = policy.get(field)
            if claim_id not in claims:
                raise PackError(f"Policy {policy.get('id')} has unknown {field} {claim_id}")
            claim = claims[claim_id]
            if claim.get("kind") != "policy" or claim.get("direction") != direction:
                raise PackError(f"Policy {policy.get('id')} has invalid {direction} claim {claim_id}")
            count = len(args_by_target.get(claim_id, []))
            if count < 3:
                warnings.append(
                    f"Policy {policy.get('id')} {direction} direction has {count} root argument(s); active model expects at least 3."
                )

    terminal_ids = {key for key, value in claims.items() if value.get("kind") == "terminal"}
    for dilemma in dilemmas:
        if dilemma.get("left") not in terminal_ids or dilemma.get("right") not in terminal_ids:
            raise PackError(f"Dilemma {dilemma.get('id')} must compare terminal claims")

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(claim_id: str, path: list[str]) -> None:
        if claim_id in visiting:
            raise PackError("Normative justification cycle: " + " -> ".join(path + [claim_id]))
        if claim_id in visited:
            return
        visiting.add(claim_id)
        for argument in args_by_target.get(claim_id, []):
            bridge_id = argument["bridgeClaimId"]
            if claims[bridge_id].get("kind") != "terminal":
                visit(bridge_id, path + [claim_id])
        visiting.remove(claim_id)
        visited.add(claim_id)

    for policy in policies:
        visit(policy["supportClaimId"], [])
        visit(policy["opposeClaimId"], [])

    return warnings


def validate_command(args: argparse.Namespace) -> int:
    pack = load_json(args.pack)
    if pack.get("schema") != "minimal-bridge-expansion-pack" or pack.get("schemaVersion") != 1:
        raise PackError("Unsupported expansion-pack schema")
    warnings = validate_with_schema(pack, args.schema)
    print("Expansion pack JSON is valid.")
    for warning in warnings:
        print(f"WARNING: {warning}")
    return 0


def merge_command(args: argparse.Namespace) -> int:
    base = load_json(args.base_model)
    pack = load_json(args.pack)
    if pack.get("schema") != "minimal-bridge-expansion-pack" or pack.get("schemaVersion") != 1:
        raise PackError("Unsupported expansion-pack schema")
    warnings = validate_with_schema(pack, args.schema)

    base_ref = pack.get("baseModel", {})
    if base_ref.get("id") and base.get("meta", {}).get("id") != base_ref.get("id"):
        raise PackError(
            f"Pack targets model id {base_ref.get('id')}, but base model id is {base.get('meta', {}).get('id')}"
        )
    if base_ref.get("version") and base.get("meta", {}).get("version") != base_ref.get("version"):
        warnings.append(
            f"Pack was prepared against {base_ref.get('version')}; supplied base is {base.get('meta', {}).get('version')}."
        )

    if not pack.get("annotations", {}).get("promotionReady", False) and not args.allow_draft:
        raise PackError("Pack is marked promotionReady=false. Re-run with --allow-draft only for a staging snapshot.")

    merged = copy.deepcopy(base)
    candidate = pack.get("candidateModel", {})
    registry = collect_global_ids(merged)
    for section in ("facts", "claims", "arguments"):
        merge_mapping(merged, candidate, section, registry)
    merge_array(merged, candidate, "policies", registry)
    merge_array(merged, candidate, "dilemmas", registry)
    merge_array(merged, candidate, "sources", None)

    semantic_warnings = semantic_validate(merged)
    warnings.extend(semantic_warnings)

    if args.new_version:
        merged.setdefault("meta", {})["version"] = args.new_version
    merged.setdefault("meta", {})["updatedAt"] = args.updated_at
    merged["importHistory"] = merged.get("importHistory", []) + [
        {
            "packId": pack.get("meta", {}).get("packId"),
            "createdAt": pack.get("meta", {}).get("createdAt"),
            "reviewStatus": pack.get("meta", {}).get("reviewStatus"),
            "promotionReady": pack.get("annotations", {}).get("promotionReady", False),
        }
    ]

    output = Path(args.output)
    output.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Merged model written to {output}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate", help="Validate an expansion pack against its JSON Schema")
    validate.add_argument("pack")
    validate.add_argument("--schema", default="argument-chain-expansion-pack.schema.json")
    validate.set_defaults(func=validate_command)

    merge = sub.add_parser("merge", help="Merge candidateModel records into an exported base model JSON")
    merge.add_argument("base_model")
    merge.add_argument("pack")
    merge.add_argument("output")
    merge.add_argument("--schema", default="argument-chain-expansion-pack.schema.json")
    merge.add_argument("--new-version")
    merge.add_argument("--updated-at", default="2026-07-13")
    merge.add_argument("--allow-draft", action="store_true")
    merge.set_defaults(func=merge_command)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except PackError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
