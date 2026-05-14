import { Badge } from "@/components/ui/badge";

type Status = "DRAFT" | "PUBLISHED";

export function StatusBadge({ status }: { status: Status }) {
  if (status === "PUBLISHED") {
    return <Badge variant="success">PUBLISHED</Badge>;
  }
  return <Badge variant="secondary">DRAFT</Badge>;
}
