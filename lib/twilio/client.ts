/**
 * Minimal Twilio REST wrapper for SMS. No SDK dep — fetch + Basic Auth.
 * Server-only; reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM.
 */

export type SmsResult = {
  sid: string;
  status: string;
  to: string;
  from: string;
};

export async function sendSms(args: {
  to: string;
  body: string;
}): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    throw new Error(
      "Twilio not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM)",
    );
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({
    To: args.to,
    From: from,
    Body: args.body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as {
    sid: string;
    status: string;
    to: string;
    from: string;
  };
  return { sid: data.sid, status: data.status, to: data.to, from: data.from };
}
