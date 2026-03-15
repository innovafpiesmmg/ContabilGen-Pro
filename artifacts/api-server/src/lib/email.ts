import { Resend } from "resend";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let resend: Resend | null = null;
let cachedApiKey: string | null = null;

async function getResend(): Promise<{ client: Resend; from: string } | null> {
  // Check DB first, fall back to env var
  let apiKey = process.env.RESEND_API_KEY ?? null;
  let emailFrom = process.env.EMAIL_FROM ?? null;

  try {
    const rows = await db.select().from(appSettingsTable).where(
      eq(appSettingsTable.key, "resend_api_key"),
    );
    const fromRows = await db.select().from(appSettingsTable).where(
      eq(appSettingsTable.key, "email_from"),
    );
    if (rows[0]?.value) apiKey = rows[0].value;
    if (fromRows[0]?.value) emailFrom = fromRows[0].value;
  } catch {
    // DB read failed, use env var
  }

  if (!apiKey) return null;

  if (apiKey !== cachedApiKey) {
    resend = new Resend(apiKey);
    cachedApiKey = apiKey;
  }

  return {
    client: resend!,
    from: emailFrom ?? "ContabilGen Pro <noreply@contabilgen.app>",
  };
}

function getAppUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
  reqHeaders: Record<string, string | string[] | undefined>,
): Promise<void> {
  const appUrl = getAppUrl({ headers: reqHeaders });
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  const resendConfig = await getResend();

  if (!resendConfig) {
    console.warn("[email] RESEND_API_KEY not set — logging reset link to console:");
    console.warn(`[email] Reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resendConfig.client.emails.send({
    from: resendConfig.from,
    to,
    subject: "Restablece tu contraseña — ContabilGen Pro",
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Restablece tu contraseña</h2>
        <p style="color: #475569; margin-bottom: 24px;">
          Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
          Pulsa el botón de abajo para crear una nueva contraseña. El enlace caduca en <strong>1 hora</strong>.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 28px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Restablecer contraseña
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 28px;">
          Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña no cambiará.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">ContabilGen Pro · Generador de universos contables</p>
      </div>
    `,
  });
}
