/**
 * Money utilities - all amounts are integer paise (1 INR = 100 paise).
 * Never use floating-point numbers for money storage or calculation.
 */

/**
 * Pure integer half-up rounding: round(numerator / denominator).
 * In integer division, (n + d / 2) / d produces Banker's/Standard half-up for positive numbers.
 */
export function roundHalfUp(numerator: bigint | number, denominator: bigint | number): bigint {
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  if (den === 0n) throw new Error("Division by zero in money rounding");
  if (num === 0n) return 0n;

  const isNegative = (num < 0n) !== (den < 0n);
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;

  const quotient = (absNum + (absDen / 2n)) / absDen;
  return isNegative ? -quotient : quotient;
}

/**
 * Format paise into Indian Rupee string (e.g. 156000 -> "₹1,560.00").
 */
export function formatINR(paise: number | bigint | string | null | undefined): string {
  let p: bigint;
  try {
    if (typeof paise === "bigint") {
      p = paise;
    } else if (typeof paise === "number") {
      if (Number.isNaN(paise) || !Number.isFinite(paise)) {
        p = 0n;
      } else {
        p = BigInt(Math.round(paise));
      }
    } else if (typeof paise === "string") {
      const num = Number(paise);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        p = 0n;
      } else {
        p = BigInt(Math.round(num));
      }
    } else {
      p = 0n;
    }
  } catch {
    p = 0n;
  }
  const isNegative = p < 0n;
  const absP = isNegative ? -p : p;
  const rupees = absP / 100n;
  const remainder = absP % 100n;
  const paddedPaise = remainder.toString().padStart(2, "0");

  // Format integer part with Indian grouping (e.g., 12,34,567)
  const rupeeStr = rupees.toString();
  let formattedRupees = "";
  if (rupeeStr.length <= 3) {
    formattedRupees = rupeeStr;
  } else {
    const last3 = rupeeStr.slice(-3);
    const rest = rupeeStr.slice(0, -3);
    const parts: string[] = [];
    for (let i = rest.length; i > 0; i -= 2) {
      const start = Math.max(0, i - 2);
      parts.unshift(rest.slice(start, i));
    }
    formattedRupees = parts.join(",") + "," + last3;
  }

  return `${isNegative ? "-" : ""}₹${formattedRupees}.${paddedPaise}`;
}

/**
 * Converts decimal rupees string/number (e.g. 1560.50) safely to integer paise (156050).
 */
export function parseRupeesToPaise(rupees: number | string): bigint {
  if (typeof rupees === "number") {
    rupees = rupees.toFixed(2);
  }
  const clean = rupees.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) {
    throw new Error(`Invalid rupee amount: ${clean}`);
  }
  const isNegative = clean.startsWith("-");
  const absVal = isNegative ? clean.slice(1) : clean;
  const [whole, frac = ""] = absVal.split(".");
  const paddedFrac = (frac + "00").slice(0, 2);
  const paise = BigInt(whole) * 100n + BigInt(paddedFrac);
  return isNegative ? -paise : paise;
}

export function toPaise(rupees: number | string): number {
  return Number(parseRupeesToPaise(rupees));
}

/**
 * Calculates GST breakdown given taxable amount and tax rate.
 * If intra-state (supplier_state === customer_state), split equally between CGST and SGST.
 * If odd paise, give the extra paisa to CGST.
 * If inter-state (supplier_state !== customer_state), full rate to IGST.
 */
export function calculateGstBreakdown(params: {
  taxablePaise?: bigint | number;
  taxableAmountPaise?: bigint | number;
  ratePercent?: number;
  taxRatePercent?: number;
  supplierStateCode?: string;
  customerStateCode?: string;
  isInterstate?: boolean;
}): {
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalTaxPaise: bigint;
  isInterstate: boolean;
} {
  const rawTaxable = params.taxablePaise !== undefined ? params.taxablePaise : params.taxableAmountPaise;
  const taxable = BigInt(rawTaxable || 0);
  const rate = Number(params.ratePercent !== undefined ? params.ratePercent : params.taxRatePercent) || 0;

  const isInterstate =
    params.isInterstate !== undefined
      ? params.isInterstate
      : (params.supplierStateCode || "").trim().toUpperCase() !==
        (params.customerStateCode || "").trim().toUpperCase();

  if (taxable <= 0n || rate <= 0) {
    return {
      cgstPaise: 0n,
      sgstPaise: 0n,
      igstPaise: 0n,
      totalTaxPaise: 0n,
      isInterstate,
    };
  }

  const rateScaled = BigInt(Math.round(rate * 100));
  const totalTaxPaise = roundHalfUp(taxable * rateScaled, 10000n);
  if (isInterstate) {
    return {
      cgstPaise: 0n,
      sgstPaise: 0n,
      igstPaise: totalTaxPaise,
      totalTaxPaise,
      isInterstate: true,
    };
  } else {
    // Intra-state: CGST = SGST = rate/2
    // If total tax is odd, CGST gets the extra 1 paisa
    const half = totalTaxPaise / 2n;
    const remainder = totalTaxPaise % 2n;
    const cgstPaise = half + remainder;
    const sgstPaise = half;
    return {
      cgstPaise,
      sgstPaise,
      igstPaise: 0n,
      totalTaxPaise,
      isInterstate: false,
    };
  }
}
