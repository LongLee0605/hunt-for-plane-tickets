import { z } from "zod";

export const createRuleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  departureCode: z.string().trim().length(3).toUpperCase(),
  arrivalCode: z.string().trim().length(3).toUpperCase(),
  maxPrice: z.number().positive(),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  airlines: z.array(z.enum(["vietnamairlines", "vietjet"])).min(1),
  active: z.boolean().optional().default(true),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
