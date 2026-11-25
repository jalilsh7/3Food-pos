/** Stable module identity used by diagnostics and future module registry. */
export const smsModuleManifest = {
  id: "sms",
  version: 1,
  status: "active",
  entry: "./index",
  capabilities: ["service-templates", "campaigns", "manual-sms", "send-logs"],
} as const;
