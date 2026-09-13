// Single source of truth for avatar generation — imported everywhere an
// avatar is generated or displayed. Never redefine AVATAR_OPTIONS inline: a
// saved seed must render identically wherever it's shown, so the option
// arrays (and the parsed Style instance) live here once.
import { Style } from "@dicebear/core";
import definition from "@dicebear/styles/cameo.json" with { type: "json" };

export const style = new Style(definition);

// Constrained to PetPals' palette. Every other Cameo option (hair,
// expression, accessories, shade, etc.) is left at the library's default
// range — not restricted.
export const AVATAR_OPTIONS = {
  backgroundColor: ["f0dfdf", "ffe7b9", "e3eeef", "fafafa"],
  bodyColor: ["dfa8a8", "ffca61", "b0e5ec", "6ba8b0", "ca7d7d", "d9a745"],
};
