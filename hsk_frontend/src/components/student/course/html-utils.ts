export function stripHtml(value: string) { return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim(); }
