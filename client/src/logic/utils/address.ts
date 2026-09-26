// The structured address every role carries (addressLine1/2, city, state,
// zip, country — same columns on every role table), plus a one-line
// display form for detail panels.
export interface Address {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// "12 Oak St, Apt 4, Athens, GA, 30601, United States" — skipping blank
// parts; "" when nothing is filled in yet.
export const formatAddress = (a: Address): string =>
  [
    a.addressLine1,
    a.addressLine2,
    [a.city, a.state].filter(Boolean).join(", "),
    a.zip,
    a.country,
  ]
    .filter(Boolean)
    .join(", ");
