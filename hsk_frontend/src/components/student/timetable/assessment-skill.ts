// Skill metadata is safe to expose even when assessment questions are withheld.
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const normalize = (value: unknown): string => typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
export function assessmentSkill(value: {skill?: unknown; assessmentType?: unknown; content?: unknown}): string {
 const content = record(value.content);
 return normalize(value.skill) || normalize(record(record(content.layout).meta).skill) || normalize(value.assessmentType) || normalize(content.assessmentType);
}
