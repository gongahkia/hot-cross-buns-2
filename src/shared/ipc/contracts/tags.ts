import { z } from "zod";
import {
  MAX_LIST_LIMIT,
  cursorSchema,
  entityByIdRequestSchema,
  idSchema,
  isoDateTimeSchema,
  listLimitSchema,
  mutationAckSchema,
  pagedListResponseSchema
} from "./core";

export const tagColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable();
export const tagEntityKindSchema = z.enum(["task", "event", "note"]);
export type TagEntityKind = z.infer<typeof tagEntityKindSchema>;

export const tagSummarySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(120),
    color: tagColorSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    taskCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    noteCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative()
  })
  .strict();

export type TagSummary = z.infer<typeof tagSummarySchema>;

export const tagListRequestSchema = z
  .object({
    cursor: cursorSchema.optional(),
    limit: listLimitSchema,
    query: z.string().trim().max(120).optional()
  })
  .strict();

export type TagListRequest = z.input<typeof tagListRequestSchema>;

export const tagListResponseSchema = pagedListResponseSchema(tagSummarySchema, MAX_LIST_LIMIT);
export type TagListResponse = z.infer<typeof tagListResponseSchema>;

export const tagCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    color: tagColorSchema.optional()
  })
  .strict();

export type TagCreateRequest = z.input<typeof tagCreateRequestSchema>;

export const tagUpdateRequestSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(120).optional(),
    color: tagColorSchema.optional()
  })
  .strict()
  .refine((request) => request.name !== undefined || request.color !== undefined, {
    message: "At least one tag field must be supplied"
  });

export type TagUpdateRequest = z.input<typeof tagUpdateRequestSchema>;

export const tagDeleteRequestSchema = entityByIdRequestSchema;
export type TagDeleteRequest = z.input<typeof tagDeleteRequestSchema>;

export const tagMergeRequestSchema = z
  .object({
    sourceId: idSchema,
    targetId: idSchema
  })
  .strict()
  .refine((request) => request.sourceId !== request.targetId, {
    message: "Source and target tags must differ"
  });

export type TagMergeRequest = z.input<typeof tagMergeRequestSchema>;

export const tagBulkApplyRequestSchema = z
  .object({
    tagIds: z.array(idSchema).min(1).max(64),
    entityKind: tagEntityKindSchema,
    entityIds: z.array(idSchema).min(1).max(500),
    mode: z.enum(["add", "remove", "replace"])
  })
  .strict();

export type TagBulkApplyRequest = z.input<typeof tagBulkApplyRequestSchema>;

export const tagMutationResponseSchema = mutationAckSchema.extend({
  tag: tagSummarySchema.optional()
});

export type TagMutationResponse = z.infer<typeof tagMutationResponseSchema>;
