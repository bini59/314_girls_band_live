#!/usr/bin/env python3
"""Offline snapshot -> D1 SQL. Operator supplies JSON from export-postgres.sql.
Never connects to a database. Prints SQL to stdout; use a restrictive umask.
"""
import datetime
import json
import sys

TABLES = ["series", "work", "tour", "band", "live", "live_band", "live_format", "ticket_tier", "vendor", "ticket_sale", "ticket_sale_tier", "api_key"]
JSON_COLUMNS = {("band", "sns_links"), ("live", "official_urls")}
DATES = {"created_at", "updated_at", "starts_at", "ends_at", "start_at", "doors_open_at", "end_at", "deleted_at", "announce_at", "payment_deadline_at", "revoked_at", "last_used_at"}

def quote(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    if not isinstance(value, str) or "\x00" in value:
        raise ValueError("unsupported SQL value")
    return "'" + value.replace("'", "''") + "'"

def convert(snapshot):
    if set(snapshot) != set(TABLES):
        raise ValueError("snapshot must contain exactly all domain tables")
    lines = ["-- Import into an EMPTY migrated D1 database. UTC dates are epoch milliseconds.", "PRAGMA defer_foreign_keys = ON;"]
    for table in TABLES:
        for row in snapshot[table]:
            values = []
            for column, value in row.items():
                if not column.replace("_", "").isalnum():
                    raise ValueError("invalid column")
                if (table, column) in JSON_COLUMNS:
                    # Snapshot carries SQL NULL separately from the JSON value null.
                    value = None if row.get(column + "__sql_null") else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                elif column in DATES and value is not None:
                    date = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
                    if date.tzinfo is None:
                        date = date.replace(tzinfo=datetime.timezone.utc)
                    value = int(date.timestamp() * 1000)
                if not column.endswith("__sql_null"):
                    values.append((column, quote(value)))
            columns = ",".join('"' + c + '"' for c, _ in values)
            lines.append(f'INSERT INTO "{table}" ({columns}) VALUES ({",".join(v for _, v in values)});')
    lines.append("PRAGMA foreign_key_check;")
    return "\n".join(lines) + "\n"

if __name__ == "__main__":
    print(convert(json.load(sys.stdin)), end="")
