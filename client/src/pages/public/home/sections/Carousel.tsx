import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { carouselSlides } from "../../../../static/content/home";

const Carousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000 }),
  ]);

  return (
    <div className="relative overflow-hidden bg-rose-md" ref={emblaRef}>
      <div className="flex">
        {carouselSlides.map((slide) => (
          <div className="flex-[0_0_100%] aspect-[22/9]" key={slide.src}>
            <img
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => emblaApi?.scrollPrev()}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-neutral-charcoal hover:bg-white"
      >
        <FaChevronLeft />
      </button>

      <button
        type="button"
        onClick={() => emblaApi?.scrollNext()}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-neutral-charcoal hover:bg-white"
      >
        <FaChevronRight />
      </button>
    </div>
  );
};

export default Carousel;
