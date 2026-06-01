import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.log(`[WhatsApp MOCK] To: ${to}\nMessage: ${message}\n`);
    return true;
  }

  try {
    const from = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    await client.messages.create({ from, to: toNumber, body: message });
    console.log(`✅ WhatsApp sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`❌ WhatsApp failed to ${to}:`, err);
    return false;
  }
}
