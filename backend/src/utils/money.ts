import { Prisma } from "../generated/prisma/client.js";

export function toMoneyString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}

export function money(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function sumMoney(
  values: Array<Prisma.Decimal | string | number>,
): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(money(value)),
    money(0),
  );
}

/** Apply a percent rate to an amount, rounded to 2 decimal places. */
export function percentOf(
  amount: Prisma.Decimal | string | number,
  percent: Prisma.Decimal | string | number,
): Prisma.Decimal {
  return money(amount)
    .mul(money(percent))
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
