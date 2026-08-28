export type SubscriptionStatus =
  | "pending_activation"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | null;

/**
 * Teksten på knappen der fører til betaling.
 *
 * En bruger uden aktivt abonnement har allerede en konto og har dermed
 * været igennem checkout mindst én gang. "Kom i gang" ville antyde at
 * intet var sket — og skjule at der ligger en påbegyndt betaling.
 */
export function checkoutLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "pending_activation":
      return "Færdiggør betaling";
    case "past_due":
      return "Prøv betalingen igen";
    case "canceled":
    case "expired":
      return "Tegn medlemskab igen";
    default:
      // Ingen abonnementsrække — brugeren har aldrig startet en betaling.
      return "Kom i gang";
  }
}
