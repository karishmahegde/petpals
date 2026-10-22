import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { carouselSlides, type Slide } from "../../../../static/content/home";
import ButtonElement from "../../../../components/ui/ButtonElement";

// Banner size in pixels — `crop` fractions are of this.
const BANNER_WIDTH = 2452;
const BANNER_HEIGHT = 1000;

// Shows only `slide.crop` of the banner: the frame takes the crop's shape and
// the full image is scaled and shifted inside it. The edges fade out so a cut
// through a shadow doesn't show as a hard line.
const CroppedPicture = ({ slide }: { slide: Slide }) => {
  const { left, right, top, bottom } = slide.crop;
  const width = right - left;
  const height = bottom - top;
  return (
    <div
      className="relative h-52 overflow-hidden"
      style={{
        aspectRatio: `${width * BANNER_WIDTH} / ${height * BANNER_HEIGHT}`,
        maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <img
        src={slide.src}
        alt={slide.pictureAlt}
        className="absolute max-w-none"
        style={{
          width: `${100 / width}%`,
          left: `${(-left / width) * 100}%`,
          top: `${(-top / height) * 100}%`,
        }}
      />
    </div>
  );
};

const Carousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000 }),
  ]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Desktop shows each 22:9 banner whole, with arrows. Phones get their own
  // layout — the picture cropped out of the banner above the heading and text
  // as real text — swiped, with dots to show where you are.
  return (
    <div className="relative overflow-hidden bg-rose-md" ref={emblaRef}>
      <div className="flex">
        {carouselSlides.map((slide) => (
          <div className="flex-[0_0_100%]" key={slide.src}>
            <img
              src={slide.src}
              alt={`${slide.heading} ${slide.body}`}
              className="hidden aspect-[22/9] h-auto w-full object-cover md:block"
            />
            <div
              className="flex h-full flex-col items-center px-8 pb-12 pt-8 text-center md:hidden"
              style={{ backgroundColor: slide.background }}
            >
              <CroppedPicture slide={slide} />
              <h2 className="mt-5 font-display text-3xl leading-tight text-neutral-charcoal">
                {slide.heading}
              </h2>
              <p className="mt-3 max-w-xs font-body text-sm text-neutral-charcoal">
                {slide.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ButtonElement
        onClick={() => emblaApi?.scrollPrev()}
        aria-label="Previous slide"
        size="bare"
        variant="outline"
        className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-neutral-charcoal hover:bg-white"
      >
        <FaChevronLeft />
      </ButtonElement>

      <ButtonElement
        onClick={() => emblaApi?.scrollNext()}
        aria-label="Next slide"
        size="bare"
        variant="outline"
        className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-neutral-charcoal hover:bg-white"
      >
        <FaChevronRight />
      </ButtonElement>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 md:hidden">
        {carouselSlides.map((slide, index) => (
          <ButtonElement
            key={slide.src}
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === selected}
            size="bare"
            variant="outline"
            className={`h-2 rounded-full transition-all ${
              index === selected ? "w-6 bg-neutral-charcoal" : "w-2 bg-neutral-charcoal/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Carousel;
