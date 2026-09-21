import assert from "node:assert/strict";
import test from "node:test";
import { decideHandoff } from "../src/tenant_handoff.ts";

test("an onboarding question leaves a stable channel and emails the account admin", () => {
  const result = decideHandoff({
    account_id: "shop_42",
    conversation_id: "conv_9",
    admin_email: "ops@example.com",
    transcript: [
      { author: "visitor", text: "Can an admin finish onboarding before checkout opens?" },
      { author: "agent", text: "I will pass this to the account team." },
    ],
  });

  assert.deepEqual(result, {
    channel: "support_shop_42_conv_9",
    shouldEmail: true,
    subject: "Admin handoff for shop_42",
    transcriptText: "visitor: Can an admin finish onboarding before checkout opens?\nagent: I will pass this to the account team.",
  });
});
