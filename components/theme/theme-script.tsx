"use client";

import { THEME_SCRIPT } from "@bini59/design";

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
