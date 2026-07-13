import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { getFeaturedPets } from "../../../../logic/api/petsApi";
import CardComponent from "../../../../components/ui/PetCatalogCard";
import SectionContainer from "../../../../components/ui/SectionContainer";
import SectionHeading from "../../../../components/ui/SectionHeading";

const FeaturedPets = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: true,
    align: "start",
  });
  const { data: pets = [], isLoading } = useQuery({
    queryKey: ["pets-featured"],
    queryFn: getFeaturedPets,
  });

  return (
    <SectionContainer className="bg-rose-light">
      <SectionHeading>Featured Pets!</SectionHeading>
      <div className="max-w-6xl mx-auto">
        <div className="relative px-2 py-3">
          {/* Carousel */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-9 p-5">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="basis-[202px] shrink-0">
                      <div className="aspect-[3/4] rounded-2xl bg-neutral-offwhite animate-pulse" />
                    </div>
                  ))
                : pets.map((pet) => (
                    <div key={pet.petID} className="basis-[202px] shrink-0">
                      <CardComponent pet={pet} />
                    </div>
                  ))}
            </div>
            {/* Left Arrow */}
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Previous pets"
              className="
              absolute left-[-2%] top-1/2 -translate-y-1/2
              z-10 flex h-10 w-10 items-center justify-center
              rounded-full bg-white/80 shadow-md
              text-neutral-dark hover:bg-white
            "
            >
              <FaChevronLeft />
            </button>

            {/* Right Arrow */}
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Next pets"
              className="
              absolute right-[-2.8%] top-1/2 -translate-y-1/2
              z-10 flex h-10 w-10 items-center justify-center
              rounded-full bg-white/80 shadow-md
              text-neutral-dark hover:bg-white
            "
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
};

export default FeaturedPets;
