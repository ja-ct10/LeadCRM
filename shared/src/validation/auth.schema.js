"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingProgressSchema = exports.CompanySetupSchema = exports.RegisterSchema = exports.StrongPasswordSchema = void 0;
const zod_1 = require("zod");
exports.StrongPasswordSchema = zod_1.z.string().min(8).max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9\s])/, 'Use uppercase and lowercase letters, a number, and a special character');
exports.RegisterSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(2, 'First name is required').max(100),
    lastName: zod_1.z.string().trim().min(2, 'Last name is required').max(100),
    email: zod_1.z.string().trim().toLowerCase().email('Valid email required'),
    password: exports.StrongPasswordSchema,
    acceptTerms: zod_1.z.boolean().optional(),
    invitationToken: zod_1.z.string().min(1).optional(),
}).superRefine((data, ctx) => {
    if (!data.invitationToken && data.acceptTerms !== true) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['acceptTerms'],
            message: 'You must accept the terms and conditions',
        });
    }
});
const WebsiteSchema = zod_1.z.string().trim().max(2048).url('Enter a valid website URL')
    .refine(value => /^https?:\/\//i.test(value), 'Use an http or https website');
exports.CompanySetupSchema = zod_1.z.object({
    companyName: zod_1.z.string().trim().min(2, 'Company name is required').max(100),
    industry: zod_1.z.string().trim().min(1, 'Industry is required').max(100),
    companySize: zod_1.z.string().trim().min(1, 'Company size is required').max(20),
    website: WebsiteSchema.or(zod_1.z.literal('')).optional(),
    timezone: zod_1.z.string().max(100).refine(value => {
        try {
            new Intl.DateTimeFormat('en', { timeZone: value });
            return true;
        }
        catch {
            return false;
        }
    }, 'Choose a valid time zone').optional(),
});
exports.OnboardingProgressSchema = zod_1.z.object({
    expectedStep: zod_1.z.number().int().min(0).max(2),
    step: zod_1.z.number().int().min(0).max(2),
}).refine(data => Math.abs(data.step - data.expectedStep) === 1, {
    message: 'Move one onboarding step at a time',
    path: ['step'],
});
