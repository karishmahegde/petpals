// components/ui/Avatar.tsx
// Renders a DiceBear Cameo avatar from a seed — the image is regenerated
// client-side every time, never stored as a file. Role-agnostic: reusable
// wherever any account's avatar needs to be shown (Staff/Vet/Volunteer/Donor
// profile pages, once built, alongside the Adopter one).
import { useMemo } from "react";
import { Avatar as DiceBearAvatar } from "@dicebear/core";
import { style, AVATAR_OPTIONS } from "../../logic/avatarConfig";

interface AvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

const Avatar = ({ seed, size = 64, className = "" }: AvatarProps) => {
  const dataUri = useMemo(
    () =>
      new DiceBearAvatar(style, { seed, size, ...AVATAR_OPTIONS }).toDataUri(),
    [seed, size],
  );

  return <img src={dataUri} alt="Adopter avatar" className={className} />;
};

export default Avatar;
