import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FaPaw, FaHeart, FaRegHeart } from "react-icons/fa";
import {
  addFavorite,
  removeFavorite,
  type PetCard,
} from "../../../logic/api/petsApi";
import { getMyFavorites } from "../../../logic/api/adoptersApi";
import { showAdopterAccountToast } from "../../../logic/toast/adopterAccountToast";
import { showLoginRequiredToast } from "../../../logic/toast/loginRequiredToast";
import useAuthStore from "../../../logic/store/useAuthStore";

interface CardComponentProps {
  pet: PetCard;
  openId: number | null;
  onKnowMore: (petID: number) => void;
  // CTA text. Defaults to the catalog wording; the "My Pets" renderings pass
  // "View Details" (the click then routes to the My Pets side panel, not the
  // public PetDetailsModal — the parent decides via its onKnowMore handler).
  ctaLabel?: string;
}

const CardComponent = ({
  pet,
  openId,
  onKnowMore,
  ctaLabel = "Know More",
}: CardComponentProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, role } = useAuthStore();
  const isAdopter = Boolean(token) && role === "Adopter";

  const { data: favorites } = useQuery({
    queryKey: ["adopter", "favorites"],
    queryFn: getMyFavorites,
    enabled: isAdopter,
  });
  const isFavorited =
    favorites?.some((favorite) => favorite.petID === pet.petID) ?? false;

  const invalidateFavorites = () =>
    queryClient.invalidateQueries({ queryKey: ["adopter", "favorites"] });
  const addMutation = useMutation({
    mutationFn: addFavorite,
    onSuccess: () => {
      invalidateFavorites();
      toast.success("Added to favorites!");
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });
  const removeMutation = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      invalidateFavorites();
      toast.success("Removed from favorites!");
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) {
      showLoginRequiredToast(navigate);
      return;
    }
    if (role !== "Adopter") {
      showAdopterAccountToast(navigate);
      return;
    }
    if (isFavorited) {
      removeMutation.mutate(pet.petID);
    } else {
      addMutation.mutate(pet.petID);
    }
  };

  const pillStyle =
    "flex-1 rounded-3xl border-2 border-neutral-lightgray p-1 text-center text-xs font-light text-black";
  const isDeepLinked = openId === pet.petID;
  return (
    <div
      className={`overflow-hidden font-body rounded-2xl bg-white shadow-md ${isDeepLinked ? "ring-4 ring-gold-md ring-offset-2" : ""}`}
    >
      <div className="relative aspect-square w-full">
        {pet.petPhoto ? (
          <img
            src={pet.petPhoto}
            alt={`${pet.petName} photo`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-offwhite">
            <FaPaw
              className="h-12 w-12 text-rose-md"
              aria-label={`${pet.petName} photo placeholder`}
            />
          </div>
        )}
        <button
          type="button"
          onClick={handleHeartClick}
          aria-label={
            isFavorited ? "Remove from favorites" : "Add to favorites"
          }
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/60 shadow"
        >
          {isFavorited ? (
            <FaHeart className="text-rose-md" />
          ) : (
            <FaRegHeart className="text-neutral-gray" />
          )}
        </button>
      </div>
      <div className="flex flex-col p-4">
        <p className="truncate text-md font-bold text-neutral-charcoal">
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
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default CardComponent;
