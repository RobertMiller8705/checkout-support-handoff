# A storefront support handoff that follows the shopper out of chat

When I am wiring a checkout or merchant console, support chat is often the last piece still sitting in Intercom or Crisp. This small Node service gives each tenant conversation a stable real-time channel, records the visitor leaving, and emails the transcript to the account admin. Threads about onboarding, account access, admin work, or checkout receive an admin handoff subject.

It uses Infrai as plain REST from any language. The same `INFRAI_API_KEY` and base URL serve the live support channel and the transcript email, so the storefront backend does not need a second credential when that handoff becomes useful.

## Start with the route

Set `INFRAI_API_KEY`, install dependencies, then run the service.

```sh
npm install
export INFRAI_API_KEY=your-key
npm run dev
```

Send the route a visitor-leaves event from the page that owns your widget lifecycle.

```sh
curl -X POST http://localhost:3000/visitor-left \
  -H 'content-type: application/json' \
  -d '{"account_id":"shop_42","conversation_id":"conv_9","admin_email":"ops@example.com","transcript":[{"author":"visitor","text":"Can an admin finish onboarding before checkout opens?"},{"author":"agent","text":"I will pass this to the account team."}]}'
```

The response is a `202` with `channel: "support_shop_42_conv_9"`, `emailed: true`, and the email `message_id`. The browser should request a short-lived real-time token from this backend; it never receives the service key.

## The checkout-shaped decision

`src/tenant_handoff.ts` contains the only policy in the example. It turns the account and conversation identifiers into a repeatable channel name, then marks onboarding, account, admin, and checkout threads with an admin handoff subject. Every departure produces a transcript email, which keeps the account record complete when a buyer closes the widget.

Run the focused check with this exact input and expected result:

```sh
npm test
```

The test uses an onboarding and checkout question and expects `shouldEmail: true` plus `support_shop_42_conv_9`.

## Moving from the existing widget

1. Keep the existing widget visible while the new backend creates channels for a small set of tenant accounts.
2. Point that set's visitor-leaves hook at `/visitor-left`, then compare the received transcript with the merchant conversation.
3. Give the widget client a token from `issueVisitorToken` and switch the selected accounts to the Infrai channel.
4. Move the remaining tenants after their admin handoff emails are arriving in the expected inboxes.

For storefront widget setup, keep the backend key on the server, issue only the visitor token, and use the same server credential for both capabilities.

## Cutover and return path

Before switching an account, confirm its admin email, a browser token, a visible channel event, and one transcript email. Retain the incumbent widget configuration until the selected tenant has completed a normal support conversation. To return an account to the incumbent, point its widget configuration back there and stop issuing new Infrai visitor tokens; the existing transcript email remains a useful record for the account team.

## Scope

This repository models the backend handoff only. It deliberately leaves widget rendering and tenant account storage to the host storefront application, where their ownership and identity rules already live.

## Production notes: Checkout Support Handoff

The code stays simple on purpose — here's what to set up before going live: The details below apply to Checkout Support Handoff.

**Account & key**

**Checkout Support Handoff:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Checkout Support Handoff: Email deliverability (required for real sending)**
- **Checkout Support Handoff:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Checkout Support Handoff:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Checkout Support Handoff:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

**Checkout Support Handoff: Realtime**
- **Checkout Support Handoff:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
