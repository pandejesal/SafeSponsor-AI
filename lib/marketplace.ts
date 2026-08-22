import { z } from "zod";

// Collab Marketplace — inbound creator-application model (Aspire/Afluencer
// absorption, Phase 1 of COMPETITIVE_ABSORPTION_STRATEGY.md). Brands post
// collabs; verified creators apply; brands accept/reject from the dashboard.
// All Firestore access goes through Admin SDK API routes (App Check policy —
// clients never read the DB directly).

export const PLATFORMS = ["youtube", "instagram", "tiktok", "twitch"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const COMPENSATION_TYPES = ["paid", "gifted", "affiliate", "mixed"] as const;
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export const COLLAB_STATUSES = ["open", "closed"] as const;
export type CollabStatus = (typeof COLLAB_STATUSES)[number];

export const APPLICATION_STATUSES = ["pending", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const NICHES = [
  "gaming", "beauty", "fitness", "tech", "finance", "comedy",
  "food", "travel", "fashion", "education", "lifestyle", "other",
] as const;

export const collabCreateSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(2000),
  niche: z.enum(NICHES),
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(4),
  minFollowers: z.number().int().min(0).max(100_000_000).default(1000),
  compensation: z.object({
    type: z.enum(COMPENSATION_TYPES),
    amount: z.number().min(0).max(1_000_000).optional(),
    currency: z.string().length(3).default("USD"),
    details: z.string().trim().max(500).optional(),
  }),
  deliverables: z.array(z.string().trim().min(2).max(140)).min(1).max(10),
  deadlineDays: z.number().int().min(1).max(90).default(14),
});
export type CollabCreateInput = z.infer<typeof collabCreateSchema>;

export const applicationSchema = z.object({
  creatorHandle: z.string().trim().min(2).max(80),
  platform: z.enum(PLATFORMS),
  followers: z.number().int().min(0).max(1_000_000_000),
  email: z.string().email().max(254),
  pitch: z.string().trim().min(30).max(1500),
  links: z.array(z.string().url().max(300)).max(3).default([]),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

// Firestore document shapes (server-side serialization).
// Timestamps are typed loosely so this module stays safe to import from
// client components (no firebase-admin dependency at runtime).
export type TsLike = Date | { toDate?: () => Date } | null | undefined;

export interface CollabDoc {
  brandUid: string;
  brandName: string;
  title: string;
  description: string;
  niche: string;
  platforms: Platform[];
  minFollowers: number;
  compensation: {
    type: CompensationType;
    amount?: number;
    currency: string;
    details?: string;
  };
  deliverables: string[];
  applicationDeadline: TsLike;
  status: CollabStatus;
  applicationCount: number;
  createdAt: TsLike;
  updatedAt: TsLike;
}

export interface ApplicationDoc {
  collabId: string;
  brandUid: string;
  creatorUid?: string;
  creatorHandle: string;
  platform: Platform;
  followers: number;
  email: string;
  emailNormalized: string;
  pitch: string;
  links: string[];
  status: ApplicationStatus;
  safetyScore?: number;
  riskLevel?: string;
  createdAt: TsLike;
}

export function serializeCollab(id: string, data: CollabDoc) {
  return {
    id,
    brandName: data.brandName,
    title: data.title,
    description: data.description,
    niche: data.niche,
    platforms: data.platforms,
    minFollowers: data.minFollowers,
    compensation: data.compensation,
    deliverables: data.deliverables,
    applicationDeadline:
      data.applicationDeadline instanceof Date
        ? data.applicationDeadline.toISOString()
        : data.applicationDeadline?.toDate?.().toISOString?.() ?? null,
    status: data.status,
    applicationCount: data.applicationCount,
    createdAt: data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt?.toDate?.().toISOString?.() ?? null,
  };
}

export function serializeApplication(id: string, data: ApplicationDoc) {
  return {
    id,
    collabId: data.collabId,
    creatorHandle: data.creatorHandle,
    platform: data.platform,
    followers: data.followers,
    email: maskEmail(data.email),
    pitch: data.pitch,
    links: data.links,
    status: data.status,
    safetyScore: data.safetyScore ?? null,
    riskLevel: data.riskLevel ?? null,
    createdAt: data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt?.toDate?.().toISOString?.() ?? null,
  };
}

// Owner sees masked emails in list view; full email only on accept (in-app).
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "invalid";
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${"•".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}
