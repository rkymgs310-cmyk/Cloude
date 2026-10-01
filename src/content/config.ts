import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    keyword: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(true),
    reviewStatus: z.enum(['needs_review', 'approved']).optional(),
  }).refine((data) => data.reviewStatus !== 'needs_review' || data.draft, {
    message: '確認待ちの記事は draft: false にできません。',
  }),
});

export const collections = { posts };
