import importlib.util
import unittest
spec = importlib.util.spec_from_file_location("exporter", "scripts/export-postgres.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)

class ExportTest(unittest.TestCase):
    def test_dates_json_null_quotes_and_ids(self):
        data = {table: [] for table in exporter.TABLES}
        data["band"] = [dict(id=42, name_en="μ's", sns_links=None, sns_links__sql_null=False, created_at="2026-10-01T09:00:00.123")]
        sql = exporter.convert(data)
        self.assertIn("42,'μ''s','null','2026-10-01T09:00:00.123+00:00'", sql)
        self.assertNotIn('"sns_links__sql_null"', sql)
        data["band"][0]["sns_links__sql_null"] = True
        self.assertIn("42,'μ''s',NULL", exporter.convert(data))
    def test_incomplete_snapshot_rejected(self):
        with self.assertRaises(ValueError): exporter.convert({})

if __name__ == "__main__": unittest.main()
