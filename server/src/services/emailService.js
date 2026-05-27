import { Resend } from 'resend';

// Configure Resend
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const emailFrom = process.env.EMAIL_FROM || "noreply@dizipay.in";

/**
 * Sends a temporary login password via Resend Email Gateway.
 */
export const sendTempPasswordEmail = async (email, name, tempPassword) => {
  console.log(`[EMAIL][SEND_REQUEST] → Initiating Resend email delivery for ${email}`);

  if (!email) {
    return { success: false, message: "Missing email address" };
  }

  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[EMAIL][SEND_FAILED] CRITICAL: RESEND_API_KEY configuration missing!');
      return { success: false, message: "Email gateway configuration missing" };
    } else {
      console.warn(`[EMAIL][SEND_SUCCESS] → Mock Mode delivery for ${email}. Temp password is: ${tempPassword}`);
      return { success: true, message: "Temporary password sent successfully via email (Mock Mode)", mock: true };
    }
  }

  try {
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 30px; border-b: 1px solid #f3f4f6; padding-bottom: 20px;">
          <h2 style="color: #0891b2; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em;">DIZIPAY</h2>
          <p style="color: #6b7280; font-size: 11px; margin-top: 4px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">SECURE OPERATIONS CENTER</p>
        </div>
        <div style="background-color: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 6px 0; color: #0f766e; font-size: 14px; font-weight: 700;">Temporary Password Issued</h3>
          <p style="margin: 0; color: #115e59; font-size: 13px; line-height: 1.5;">An administrator has requested a temporary password reset for your Dizipay account. Please use the temporary credentials below to log in.</p>
        </div>
        <div style="text-align: center; padding: 24px; background-color: #f9fafb; border: 1px dashed #d1d5db; border-radius: 12px; margin-bottom: 24px;">
          <span style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Your Temporary Credentials</span>
          <div style="font-family: monospace; font-size: 32px; font-weight: 850; color: #0891b2; margin: 10px 0; letter-spacing: 3px;">${tempPassword}</div>
        </div>
        <div style="color: #dc2626; background-color: #fef2f2; border: 1px solid #fee2e2; padding: 12px; border-radius: 8px; font-size: 12px; font-weight: 700; margin-bottom: 24px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>⚠️ WARNING: For security reasons, this temporary password will expire in 24 hours.</span>
        </div>
        <div style="font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 24px;">
          <strong style="color: #111827; font-size: 14px;">Next Steps:</strong>
          <ol style="margin-top: 8px; padding-left: 20px;">
            <li>Log in to the Dizipay panel at <a href="https://irecharge.in" style="color: #0891b2; text-decoration: none; font-weight: 700;">irecharge.in</a> using your email and this temporary password.</li>
            <li>On next login, you will be forced to change your password immediately to restore full access.</li>
            <li>Select a strong, unique password and do not share this email or your temporary password with anyone.</li>
          </ol>
        </div>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <div style="text-align: center; font-size: 11px; color: #9ca3af; line-height: 1.4;">
          This is an automated notification from the DIZIPAY Identity Manager. If you did not initiate this request, please alert a system administrator immediately.
        </div>
      </div>
    `;

    const { data: resData, error: resError } = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: 'DIZIPAY Security Notice: Temporary Login Password Issued',
      html: htmlContent,
      text: `Hello ${name || 'User'},

Your temporary login password is:

${tempPassword}

Please log in and immediately change your password. For security reasons, this temporary password expires in 24 hours.

* DIZIPAY Security Team`
    });

    if (resError) {
      console.error(`[EMAIL][GATEWAY_ERROR] → Resend responded with error:`, resError);
      throw new Error(resError.message || "Resend API error");
    }

    console.log(`[EMAIL][SEND_SUCCESS] → Resend email delivered to ${email} (ID: ${resData?.id})`);
    return { success: true, message: "Temporary password sent successfully via email" };
  } catch (error) {
    console.error(`[EMAIL][SEND_FAILED] → Fatal error sending email to ${email}:`, error.message);
    return { success: false, message: error.message || "Failed to send email" };
  }
};
