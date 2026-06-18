/**
 * Zod schema for the spot order ticket.
 *
 * Scope: this validates the *raw form fields* — presence and numeric format of
 * price/size. Order-feasibility checks that depend on live market/balance data
 * (minimum size, sufficient funds, a live market price) are NOT here; they live
 * in `useSpotTicket` as a derived `problem`, because they need async context.
 * Keeping the split means per-field messages render under each input via
 * `<FieldError>`, while feasibility shows once near the submit button.
 */
import { z } from "zod"

export type Tif = "GTC" | "IOC" | "FOK"

/** Parse a free-text amount: "" → null (empty), non-number → NaN, else value. */
function parseAmount(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export const orderFormSchema = z
  .object({
    orderType: z.enum(["limit", "market"]),
    side: z.enum(["buy", "sell"]),
    price: z.string(),
    size: z.string(),
    sizeUnit: z.string(),
    sizePercent: z.number(),
    tif: z.enum(["GTC", "IOC", "FOK"]),
    postOnly: z.boolean(),
    slippage: z.number(),
    autoDeposit: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // Price is only required for limit orders.
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

export type OrderFormValues = z.infer<typeof orderFormSchema>

/** First validation message for a given field, or undefined when valid. */
export function fieldIssue(
  result: ReturnType<typeof orderFormSchema.safeParse>,
  field: keyof OrderFormValues
): string | undefined {
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === field)?.message
}
