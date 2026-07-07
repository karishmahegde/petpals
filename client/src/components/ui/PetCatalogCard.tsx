import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaPaw } from "react-icons/fa";
import type { PetCard } from "../../logic/api/petsApi";

const CardComponent = ({ pet }: { pet: PetCard }) => {
  const [searchParams] = useSearchParams();
  const qPetId = searchParams.get("petID"); // auto-open via ?petID=...

  const [openId, setOpenId] = useState<number | null>(null);

  // Auto-open this card's modal if the URL matches this pet
  useEffect(() => {
    if (qPetId && Number(qPetId) === pet.petID) setOpenId(pet.petID);
  }, [qPetId, pet.petID]);

  const isDeepLinked = openId === pet.petID;

  return (
    <div
      className={`bg-rose-md p-4 text-black font-body rounded-xl ${
        isDeepLinked ? "ring-4 ring-gold-dark ring-offset-2" : ""
      }`}
    >
      {pet.petPhoto ? (
        <img
          src={pet.petPhoto}
          alt={`${pet.petName} photo`}
          className="w-40 object-contain"
        />
      ) : (
        <FaPaw
          className="h-8 w-8 text-rose-md"
          aria-label={`${pet.petName} photo placeholder`}
        />
      )}

      <div className="flex flex-col justify-center px-3 text-white">
        <p className="mt-2 text-md font-bold font-body truncate">
          {pet.petName}
        </p>
        <div className="">
          <p className="text-xs font-light truncate pb-2">
            {pet.breed.breedName}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-gold-light border-2 border-rose-dark p-1 rounded-3xl text-xs text-center text-black font-light">
            {pet.petAge}
          </div>
          <div className="flex-1 bg-gold-light border-2 border-rose-dark p-1 rounded-3xl text-xs text-center text-black font-light">
            {pet.petSex}
          </div>
        </div>

        <button
          className="bg-black text-white my-2 px-2 py-3 text-xs rounded-2xl"
          onClick={() => setOpenId(pet.petID)}
        >
          Know More
        </button>
      </div>

      {/* TODO: render <PetDetailsModal petId={openId} onClose={() => setOpenId(null)} /> once it's built next sprint */}
    </div>
  );
};

export default CardComponent;
