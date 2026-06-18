/**
 * Zod schema for the margin order ticket — mirrors the spot `orderSchema`.
 *
 * Validates the raw price/size fields (presence + numeric format). The richer,
 * margin-specific feasibility checks (leverage capacity, borrow side, reduce-only
 * predicate, TP/SL bounds, sufficient funds) stay in MarginTicket's derived
 * `problem`, because they need live snapshot/risk data.
 */
import { z } from "zod"

function parseAmount(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export const marginOrderFormSchema = z
  .object({
    orderType: z.enum(["limit", "market"]),
    price: z.string(),
    size: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.orderType === "limit") {
      const p = parseAmount(v.price)
      if (p === null)
        ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price" })
      else if (Number.isNaN(p) || p <= 0)
        ctx.addIssue({
          code: "custom",
          path: ["price"],
          message: "Price must be greater than 0",
        })
    }
    const s = parseAmount(v.size)
    if (s === null)
      ctx.addIssue({ code: "custom", path: ["size"], message: "Enter a size" })
    else if (Number.isNaN(s) || s <= 0)
      ctx.addIssue({
        code: "custom",
        path: ["size"],
        message: "Size must be greater than 0",
      })
  })

export type MarginOrderFormValues = z.infer<typeof marginOrderFormSchema>

export function fieldIssue(
  result: ReturnType<typeof marginOrderFormSchema.safeParse>,
  field: keyof MarginOrderFormValues
): string | undefined {
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === field)?.message
}
