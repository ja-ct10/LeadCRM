-- Migration: Remove login OTP token table only
-- OTP-based login (2-factor) has been removed in favour of direct email+password auth.
-- Registration email verification OTP is KEPT — RegistrationOtpToken table is preserved.

DROP TABLE IF EXISTS "LoginOtpToken";
