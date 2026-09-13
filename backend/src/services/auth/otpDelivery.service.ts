import Errors from '../../errors';
import type { OtpPurpose } from '../../types/auth';

export class OtpDeliveryService {
  async send(phone: string, otp: string, purpose: OtpPurpose): Promise<void> {
    const mode =
      process.env.OTP_DELIVERY_MODE ??
      (process.env.NODE_ENV === 'production' ? 'disabled' : 'console');

    if (mode === 'console' && process.env.NODE_ENV !== 'production') {
      console.info(`[Mello ${purpose} OTP] ${phone}: ${otp}`);
      return;
    }

    throw new Errors.SystemError(
      'OTP delivery provider is not configured for this environment',
    );
  }
}
