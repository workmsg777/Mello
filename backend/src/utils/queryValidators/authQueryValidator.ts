import { z, ZodError, type ZodType } from 'zod';
import Errors from '../../errors';
import { accountTypes } from '../../types/auth';

const phoneSchema = z.string().trim().min(8).max(32);
const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'otp must contain 6 digits');

const deviceSchema = z
  .object({
    deviceId: z.string().trim().min(1).max(255).optional(),
    deviceName: z.string().trim().min(1).max(255).optional(),
    platform: z.enum(['ANDROID', 'IOS', 'WEB', 'UNKNOWN']).optional(),
  })
  .optional();

const partnerSignupSchema = z.object({
  ownerName: z.string().trim().min(1).max(200),
  businessName: z.string().trim().min(1).max(200),
  category: z.enum(['CAFE', 'HOTEL', 'ACTIVITY', 'OTHER']),
  description: z.string().trim().max(5_000).optional(),
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(20),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  businessPhone: phoneSchema.optional(),
  businessEmail: z.string().trim().email().max(320).optional(),
});

const platformSignupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  registrationKey: z.string().min(1).max(500),
});

const signupRequestOtpSchema = z.object({
  phone: phoneSchema,
  accountType: z.enum(accountTypes),
});

const signupVerifySchema = z.discriminatedUnion('accountType', [
  z.object({
    phone: phoneSchema,
    otp: otpSchema,
    accountType: z.literal('DATING_USER'),
    device: deviceSchema,
  }),
  z.object({
    phone: phoneSchema,
    otp: otpSchema,
    accountType: z.literal('PARTNER_USER'),
    partner: partnerSignupSchema,
    device: deviceSchema,
  }),
  z.object({
    phone: phoneSchema,
    otp: otpSchema,
    accountType: z.literal('PLATFORM_USER'),
    platformUser: platformSignupSchema,
    device: deviceSchema,
  }),
]);

const loginRequestOtpSchema = z.object({
  phone: phoneSchema,
});

const loginVerifySchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
  device: deviceSchema,
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32).max(1_000),
});

function parse<T>(schema: ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) => {
          const field = issue.path.join('.');
          return field ? `${field}: ${issue.message}` : issue.message;
        })
        .join(', ');
      throw new Errors.BadRequestError(message);
    }
    throw error;
  }
}

export type SignupRequestOtpInput = z.infer<typeof signupRequestOtpSchema>;
export type SignupVerifyInput = z.infer<typeof signupVerifySchema>;
export type LoginRequestOtpInput = z.infer<typeof loginRequestOtpSchema>;
export type LoginVerifyInput = z.infer<typeof loginVerifySchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const validateSignupRequestOtp = (
  value: unknown,
): SignupRequestOtpInput => parse(signupRequestOtpSchema, value);

export const validateSignupVerify = (value: unknown): SignupVerifyInput =>
  parse(signupVerifySchema, value);

export const validateLoginRequestOtp = (value: unknown): LoginRequestOtpInput =>
  parse(loginRequestOtpSchema, value);

export const validateLoginVerify = (value: unknown): LoginVerifyInput =>
  parse(loginVerifySchema, value);

export const validateRefreshToken = (value: unknown): RefreshTokenInput =>
  parse(refreshTokenSchema, value);
