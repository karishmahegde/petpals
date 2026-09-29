import { PiImageLight } from "react-icons/pi";
import type { FaqImage as FaqImageContent } from "../../../static/content/faqs";

interface FaqImageProps {
  image: FaqImageContent;
  className?: string;
}

// Renders the image once `src` is set in faqs.ts; until then, a dashed
// placeholder of the same footprint that names the image it's waiting for.
const FaqImage = ({ image, className = "" }: FaqImageProps) => {
  if (image.src) {
    return (
      <img
        src={image.src}
        alt={image.alt}
        className={`w-full rounded-xl object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={image.alt}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-gray bg-neutral-offwhite p-6 text-center text-neutral-gray ${className}`}
    >
      <PiImageLight className="h-10 w-10" aria-hidden="true" />
      <p className="text-xs font-light">{image.alt}</p>
    </div>
  );
};

export default FaqImage;
