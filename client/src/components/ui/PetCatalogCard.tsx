import { FaPaw } from "react-icons/fa";
import type { PetCard } from "../../logic/api/petsApi";

interface CardComponentProps {
  pet: PetCard;
  openId: number | null;
  onKnowMore: (petID: number) => void;
}

const CardComponent = ({ pet, openId, onKnowMore }: CardComponentProps) => {
  const pillStyle =
    "flex-1 rounded-3xl border-2 border-neutral-lightgray p-1 text-center text-xs font-light text-black";

  const isDeepLinked = openId === pet.petID;

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white shadow-md ${
        isDeepLinked ? "ring-4 ring-gold-md ring-offset-2" : ""
      }`}
    >
      {pet.petPhoto ? (
        <div className="aspect-square w-full">
          <img
            src={pet.petPhoto}
            alt={`${pet.petName} photo`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-neutral-offwhite">
          <FaPaw
            className="h-12 w-12 text-rose-md"
            aria-label={`${pet.petName} photo placeholder`}
          />
        </div>
      )}

      <div className="flex flex-col p-4">
        <p className="truncate text-md font-bold font-body text-neutral-charcoal">
          {pet.petName}
        </p>
        <p className="truncate pb-2 text-xs font-light text-teal-dark">
          {pet.breed.breedName}
        </p>

        <div className="flex gap-2">
          <div className={pillStyle}>{pet.petAge}</div>
          <div className={pillStyle}>{pet.petSex}</div>
        </div>

        <button
          className="my-2 rounded-xl bg-black px-2 py-3 text-xs text-white"
          onClick={() => onKnowMore(pet.petID)}
        >
          Know More
        </button>
      </div>
    </div>
  );
};

export default CardComponent;
