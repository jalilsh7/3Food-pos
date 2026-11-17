import { createFileRoute } from "@tanstack/react-router";

const SEND = "https://rest.payamak-panel.com/api/SendSMS/SendSMS";
const CREDIT = "https://rest.payamak-panel.com/api/SendSMS/GetCredit";
const PATTERN = "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber";

type Body = {
  action?: "send" | "credit";
  username?: string;
  password?: string;
  from?: string;
  to?: string;
  text?: string;
  bodyId?: string;
};

function form(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

export const Route = createFileRoute("/api/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ ok: false, detail: "بدنه نامعتبر" }, { status: 400 });
        }
        const username = (body.username ?? "").trim();
        const password = (body.password ?? "").trim();
        if (!username || !password) {
          return Response.json({ ok: false, detail: "نام کاربری و کلید API لازم است" }, { status: 400 });
        }
        try {
          if (body.action === "credit") {
            const res = await fetch(CREDIT, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: form({ username, password }),
            });
            const raw = await res.text();
            return Response.json({ ok: res.ok, detail: raw.slice(0, 400) });
          }
          const to = (body.to ?? "").trim();
          const text = (body.text ?? "").trim();
          const from = (body.from ?? "").trim();
          if (!to || !text) {
            return Response.json({ ok: false, detail: "شماره و متن لازم است" }, { status: 400 });
          }
          const bodyId = (body.bodyId ?? "").trim();
          const res = await fetch(bodyId ? PATTERN : SEND, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: bodyId
              ? form({ username, password, text, to, bodyId })
              : form({ username, password, to, from, text, isFlash: "false" }),
          });
          const raw = await res.text();
          const num = Number(raw.replace(/[^\d-]/g, ""));
          const ok = res.ok && (Number.isNaN(num) ? raw.length > 0 : num > 0);
          return Response.json({ ok, detail: raw.slice(0, 400) });
        } catch (err) {
          const message = err instanceof Error ? err.message : "خطای شبکه";
          return Response.json({ ok: false, detail: message }, { status: 502 });
        }
      },
    },
  },
});
