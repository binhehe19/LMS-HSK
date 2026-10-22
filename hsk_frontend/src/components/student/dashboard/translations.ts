import { student } from "./student-vi";

// Retain source copy without adding an i18next runtime to the Next.js app.
export function useTranslation() {
  return {
    t(key: string, options?: string | Record<string, string | number>): string {
      const values = typeof options === "object" ? options : {};
      const dictionary = student.student as Record<string, string>;
      const value = dictionary[key.replace(/^student\./, "")] ??
        (typeof options === "string" ? options : String(values.defaultValue ?? key));
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ""));
    },
  };
}
