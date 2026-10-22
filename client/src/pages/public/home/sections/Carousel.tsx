import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { carouselSlides } from "../../../../static/content/home";
import ButtonElement from "../../../../components/ui/ButtonElement";

const Carousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000 }),
  ]);

  // The slides are 22:9 images with the picture and text in the middle ~60%
  // of the width. Below md a taller 8:5 frame crops the empty sides instead
  // of shrinking everything, and the arrows give way to swiping.
  return (
    <div className="relative overflow-hidden bg-rose-md" ref={emblaRef}>
      <div className="flex">
        {carouselSlides.map((slide) => (
          <div className="flex-[0_0_100%] aspect-[8/5] md:aspect-[22/9]" key={slide.src}>
            <img
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full object-cover"
            />
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
    </div>
  );
};

export default Carousel;
