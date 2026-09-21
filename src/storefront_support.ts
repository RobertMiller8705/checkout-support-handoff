import { createServer } from "node:http";
import { InfraiError, InfraiSupport } from "./infrai_support.ts";
import { decideHandoff, visitorLeavesSchema } from "./tenant_handoff.ts";

const support = new InfraiSupport();

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/visitor-left") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const parsed = visitorLeavesSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (!parsed.success) {
    response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: parsed.error.flatten() }));
    return;
  }

  const handoff = decideHandoff(parsed.data);
  try {
    await support.createChannel(handoff.channel);
    await support.publishVisitorLeft(handoff.channel, parsed.data.account_id, parsed.data.conversation_id);
    let message_id: unknown = null;
    if (handoff.shouldEmail) {
      const sent = await support.emailTranscript(parsed.data.admin_email, handoff.subject, handoff.transcriptText, `email-${parsed.data.conversation_id}`);
      message_id = (sent as { message_id?: unknown }).message_id ?? null;
    }
    response.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify({ channel: handoff.channel, emailed: handoff.shouldEmail, message_id }));
  } catch (error) {
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 502;
    response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("Storefront support handoff listening on http://localhost:3000");
});
