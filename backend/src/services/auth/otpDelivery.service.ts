import Errors from '../../errors';
import type { OtpPurpose } from '../../types/auth';
import { authConfig } from '../../config/auth';

export class OtpDeliveryService {
  constructor(private readonly sendRequest: typeof fetch = fetch) {}
  async send(phone: string, otp: string, purpose: OtpPurpose): Promise<void> {
    const mode =
      process.env.OTP_DELIVERY_MODE ??
      (process.env.NODE_ENV === 'production' ? 'disabled' : 'console');

    if (mode === 'console' && process.env.NODE_ENV !== 'production') {
      console.info(`[Mello ${purpose} OTP] ${phone}: ${otp}`);
      return;
    }

    if (mode === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
      const token = process.env.TWILIO_AUTH_TOKEN?.trim();
      const messagingService = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
      const sender = process.env.TWILIO_FROM_NUMBER?.trim();
      if (
        !sid ||
        !/^AC[0-9a-f]{32}$/i.test(sid) ||
        !token ||
        (!messagingService && !sender)
      ) {
        throw new Errors.SystemError(
          'Twilio SMS credentials and a sender must be configured',
        );
      }
      const body = new URLSearchParams({
        To: phone,
        Body: `Your Mello code is ${otp}. It expires in ${Math.ceil(authConfig.otpTtlSeconds / 60)} minutes. Do not share this code.`,
        ...(messagingService
          ? { MessagingServiceSid: messagingService }
          : { From: sender! }),
      });
      try {
        const response = await this.sendRequest(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) throw new Error('SMS provider rejected the message');
        return;
      } catch {
        // Provider responses can contain phone numbers and other sensitive data.
        throw new Errors.SystemError(
          'Unable to send your code right now. Please try again shortly.',
        );
      }
    }

    throw new Errors.SystemError(
      'OTP delivery provider is not configured for this environment',
    );
  }
}
