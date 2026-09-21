import { z } from "zod";

export const visitorLeavesSchema = z.object({
  account_id: z.string().min(1),
  conversation_id: z.string().min(1),
  admin_email: z.string().email(),
  transcript: z.array(z.object({
    author: z.enum(["visitor", "agent"]),
    text: z.string().min(1),
  })).min(1),
});

export type VisitorLeaves = z.infer<typeof visitorLeavesSchema>;

export function decideHandoff(input: VisitorLeaves): {
  channel: string;
  shouldEmail: boolean;
  subject: string;
  transcriptText: string;
} {
  const transcriptText = input.transcript
    .map((message) => `${message.author}: ${message.text}`)
    .join("\n");
  const adminThread = input.transcript.some((message) =>
    /onboard|account|admin|checkout/i.test(message.text),
  );

  return {
    channel: `support_${input.account_id}_${input.conversation_id}`,
    shouldEmail: true,
    subject: `${adminThread ? "Admin" : "Support"} handoff for ${input.account_id}`,
    transcriptText,
  };
}
