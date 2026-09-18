// PetFormPanel.tsx
// Pet detail/edit panel — one SlideOver, two phases for an existing pet:
// "view" (read-only, categorized fields — mirrors the adopter dashboard's
// own PetDetailPanel.tsx) opens by default, with an "Edit" button in the
// sticky footer that switches to "edit" (the full form, unchanged from
// before). Creating a brand new pet has no view phase — it always opens
// straight into the form.
//
// `petID` present -> fetched fresh via the staff-only GET
// /staff/me/pets/:id, which is richer than the public GET /pets/:id this
// panel used to call: it adds petCode, microchipID, petSize, petBGroup, and
// the raw petDOB (the public shape only ever returns the formatted
// petAge) — exactly the fields the view needs to display and the edit form
// needs to pre-fill with real values instead of leaving them blank for
// staff to re-enter. `petID` absent/null -> create mode.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw, FaTimes } from "react-icons/fa";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import { getSpecies, getBreeds } from "../../../../../../logic/api/petsApi";
import { formatShortDate } from "../../../../../../logic/utils/datetime";
import {
  createPet,
  updatePet,
  deletePet,
  getPetPhotos,
  deletePetPhoto,
  getShelterPetDetail,
  PET_ADOPTION_STATUS_VALUES,
  PET_INTAKE_TYPE_VALUES,
  type CreatePetPayload,
  type IntakeType,
  type PetAdoptionStatus,
  type PetSex,
  type PetSize,
  type StaffPetFullDetail,
} from "../../../../../../logic/api/staffPetsApi";

interface PetFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Present -> view/edit an existing pet, fetched fresh from GET /staff/me/pets/:id. Absent/null -> create mode. */
  petID?: number | null;
}

type PanelMode = "view" | "edit";

interface PetFormState {
  speciesID: string;
  breedID: string;
  petName: string;
  petDOB: string;
  petSex: PetSex | "";
  petColor: string;
  petSize: PetSize | "";
  intakeDate: string;
  intakeType: IntakeType | "";
  petWeight: string;
  petHeight: string;
  petBGroup: string;
  petDesc: string;
  // Shown in both modes (same fields/order as the edit form), but POST
  // /pets doesn't accept any of these — the backend always creates a pet at
  // adoptionStatus "available" with no profile fields set. So on create,
  // saveMutation sends these via a follow-up PUT once the pet exists,
  // rather than in the create request itself.
  microchipID: string;
  compatibleWithChildren: boolean;
  compatibleWithPets: boolean;
  specialNeeds: boolean;
  featuredFlag: boolean;
  adoptionStatus: PetAdoptionStatus | "";
}

const EMPTY_FORM: PetFormState = {
  speciesID: "",
  breedID: "",
  petName: "",
  petDOB: "",
  petSex: "",
  petColor: "",
  petSize: "",
  intakeDate: "",
  intakeType: "",
  petWeight: "",
  petHeight: "",
  petBGroup: "",
  petDesc: "",
  microchipID: "",
  compatibleWithChildren: false,
  compatibleWithPets: false,
  specialNeeds: false,
  featuredFlag: false,
  // Matches what POST /pets always sets server-side, so a create that
  // leaves this untouched needs no follow-up PUT just for this field.
  adoptionStatus: "available",
};

const PET_SEX_OPTIONS: { value: PetSex; label: string }[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];
const PET_SIZE_OPTIONS: PetSize[] = ["Small", "Medium", "Large"];

const INTAKE_TYPE_LABEL: Record<IntakeType, string> = {
  stray: "Stray",
  surrendered: "Surrendered",
  transferred: "Transferred",
};

const ADOPTION_STATUS_LABEL: Record<PetAdoptionStatus, string> = {
  incoming: "Incoming",
  available: "Available",
  pending: "Pending",
  adopted: "Adopted",
  fostered: "Fostered",
  transferred: "Transferred",
  deceased: "Deceased",
};

const STATUS_TONE: Record<PetAdoptionStatus, BadgeTone> = {
  incoming: "gold",
  available: "teal",
  pending: "gold",
  adopted: "green",
  fostered: "teal",
  transferred: "neutral",
  deceased: "red",
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

// Marks a required field's label — every field canSubmit checks gets one.
const Required = () => (
  <span className="text-rose-dark" aria-hidden="true">
    {" "}
    *
  </span>
);

// View-mode styling — matches the adopter dashboard's PetDetailPanel.tsx.
const sectionTitle = "font-display text-lg text-neutral-dark";
const infoLabel = "font-body text-sm font-semibold text-teal-dark";
const infoValue = "font-body text-sm text-neutral-charcoal";
const divider = "my-5 border-t border-neutral-lightgray";
const quoteBlock = "font-body text-sm italic text-neutral-charcoal";

const yesNo = (b: boolean) => (b ? "Yes" : "No");

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={infoLabel}>{k}</dt>
    <dd className={infoValue}>{v}</dd>
  </>
);

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const PetFormPanel = ({ open, onClose, petID }: PetFormPanelProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEdit = petID != null;

  const [mode, setMode] = useState<PanelMode>("edit");
  const [form, setForm] = useState<PetFormState>(EMPTY_FORM);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // The photo is staged client-side and only actually uploaded when the
  // main form is saved — see saveMutation and staffPetsApi.ts's updatePet
  // (multipart, field changes + the file in one request).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Local preview for the staged file — object URLs must be revoked or
  // they leak; this effect owns that lifecycle.
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const resetPhotoForm = () => {
    setPhotoFile(null);
    setPhotoError(null);
  };

  // Existing pet -> opens read-only; nothing to view yet for a brand new
  // one. Also discards any staged-but-unsaved photo from a previous open.
  useEffect(() => {
    if (!open) return;
    setMode(isEdit ? "view" : "edit");
    resetPhotoForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, petID]);

  const { data: species } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
    enabled: open,
  });

  const speciesIDNum = form.speciesID ? Number(form.speciesID) : null;
  const { data: breeds } = useQuery({
    queryKey: ["breeds", speciesIDNum],
    queryFn: () => getBreeds([speciesIDNum!]),
    enabled: open && speciesIDNum !== null,
  });

  const petQuery = useQuery({
    queryKey: ["staff", "pet-detail", petID],
    queryFn: () => getShelterPetDetail(petID!),
    enabled: open && isEdit,
  });

  const photosQuery = useQuery({
    queryKey: ["staff", "pet-photos", petID],
    queryFn: () => getPetPhotos(petID!),
    enabled: open && isEdit,
  });

  // Builds the edit form's state from a fetched pet — shared by the
  // re-seed-on-open effect and "Cancel" (discards unsaved edits by
  // rebuilding from the last-fetched data rather than just switching mode).
  const buildFormFromPet = (pet: StaffPetFullDetail): PetFormState => {
    const matchedSpecies = species?.find(
      (s) => s.speciesName === pet.breed.speciesName,
    );
    return {
      speciesID: matchedSpecies ? String(matchedSpecies.speciesID) : "",
      breedID: String(pet.breed.breedID),
      petName: pet.petName,
      petDOB: pet.petDOB.slice(0, 10),
      petSex: pet.petSex === "Male" ? "M" : pet.petSex === "Female" ? "F" : "",
      petColor: pet.petColor,
      petSize: pet.petSize ?? "",
      intakeDate: pet.intakeDate.slice(0, 10),
      intakeType: pet.intakeType ?? "",
      petWeight: String(pet.petWeight),
      petHeight: String(pet.petHeight),
      petBGroup: pet.petBGroup,
      petDesc: pet.petDesc ?? "",
      microchipID: pet.microchipID ?? "",
      compatibleWithChildren: pet.compatibleWithChildren,
      compatibleWithPets: pet.compatibleWithPets,
      specialNeeds: pet.specialNeeds,
      featuredFlag: pet.featuredFlag,
      adoptionStatus: pet.adoptionStatus,
    };
  };

  // Re-seed on every open: create mode -> blank form; edit mode -> wait for
  // the detail fetch, then pre-fill (including deriving speciesID from the
  // breed's speciesName, since the detail shape has no speciesID directly).
  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!petQuery.data || !species) return;
    setForm(buildFormFromPet(petQuery.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, petQuery.data, species]);

  const closeAndReset = () => {
    resetPhotoForm();
    setIsDeleteOpen(false);
    onClose();
  };

  // Back to the read-only view, discarding any unsaved changes — including
  // a staged-but-unsaved photo.
  const cancelEdit = () => {
    if (petQuery.data) setForm(buildFormFromPet(petQuery.data));
    resetPhotoForm();
    setMode("view");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: CreatePetPayload = {
        breedID: Number(form.breedID),
        petName: form.petName.trim(),
        petDOB: form.petDOB,
        petSex: form.petSex as PetSex,
        petColor: form.petColor.trim(),
        petSize: form.petSize as PetSize,
        intakeDate: form.intakeDate,
        petWeight: Number(form.petWeight),
        petHeight: Number(form.petHeight),
      };
      if (form.petBGroup.trim()) payload.petBGroup = form.petBGroup.trim();
      if (form.intakeType) payload.intakeType = form.intakeType;

      const profileFields = {
        petDesc: form.petDesc.trim() || null,
        microchipID: form.microchipID.trim() || null,
        compatibleWithChildren: form.compatibleWithChildren,
        compatibleWithPets: form.compatibleWithPets,
        specialNeeds: form.specialNeeds,
        featuredFlag: form.featuredFlag,
        adoptionStatus: form.adoptionStatus as PetAdoptionStatus,
      };

      if (!isEdit) {
        const created = await createPet(payload);
        // POST /pets ignores all of the above (it always creates at
        // "available" with no profile fields, and is plain JSON — no file
        // support) — only follow up with a PUT if the staff member actually
        // set one of these or staged a photo, to skip a no-op request on
        // the common case of leaving them all at their defaults.
        const hasProfileFields =
          profileFields.petDesc !== null ||
          profileFields.microchipID !== null ||
          profileFields.compatibleWithChildren ||
          profileFields.compatibleWithPets ||
          profileFields.specialNeeds ||
          profileFields.featuredFlag ||
          profileFields.adoptionStatus !== "available";
        return hasProfileFields || photoFile
          ? updatePet(
              created.petID,
              hasProfileFields ? profileFields : {},
              photoFile,
            )
          : created;
      }

      // photoFile rides along in the same request as the field changes —
      // see staffPetsApi.ts's updatePet. undefined (nothing staged) leaves
      // the pet's existing photo untouched server-side.
      return updatePet(petID!, { ...payload, ...profileFields }, photoFile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      if (isEdit) {
        queryClient.invalidateQueries({
          queryKey: ["staff", "pet-detail", petID],
        });
        queryClient.invalidateQueries({
          queryKey: ["staff", "pet-photos", petID],
        });
        toast.success("Pet updated");
        resetPhotoForm();
        setMode("view");
      } else {
        toast.success("Pet created");
        closeAndReset();
      }
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoID: number) => deletePetPhoto(petID!, photoID),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff", "pet-photos", petID],
      });
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deletePetMutation = useMutation({
    mutationFn: () => deletePet(petID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      toast.success("Pet deleted");
      closeAndReset();
    },
    onError: (err) => {
      toast.error(extractError(err));
      setIsDeleteOpen(false);
    },
  });

  // Validates and stages a file the moment it's picked — it isn't actually
  // uploaded until the main form is saved (saveMutation).
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!ALLOWED_PHOTO_MIME.has(file.type)) {
      setPhotoError("Unsupported file type. Allowed: JPEG, PNG, WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("File exceeds the 5 MB limit.");
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
  };

  const canSubmit =
    form.breedID !== "" &&
    form.petName.trim() !== "" &&
    form.petDOB !== "" &&
    form.petSex !== "" &&
    form.petColor.trim() !== "" &&
    form.petSize !== "" &&
    form.intakeDate !== "" &&
    form.petWeight !== "" &&
    form.petHeight !== "" &&
    form.adoptionStatus !== "" &&
    !saveMutation.isPending;

  const photos = photosQuery.data ?? [];
  const pet = petQuery.data;
  const showView = isEdit && mode === "view" && pet;
  const showForm = mode === "edit" && (!isEdit || pet);

  const title = !isEdit
    ? "Add Pet"
    : mode === "view"
      ? "Pet Details"
      : "Edit Pet";

  return (
    <>
      <SlideOver
        open={open}
        onClose={closeAndReset}
        title={title}
        footer={
          showView && pet ? (
            <div className="flex flex-col gap-3">
              <ButtonElement
                onClick={() => {
                  closeAndReset();
                  navigate(`/staff/pets/${pet.petID}/health-passport`);
                }}
                size="panel"
                variant="outline"
                className="w-full bg-gold-md text-white hover:brightness-95"
              >
                View Health Passport
              </ButtonElement>
              <ButtonElement
                onClick={() => setMode("edit")}
                size="panel"
                className="w-full bg-teal-dark hover:brightness-95"
              >
                Edit
              </ButtonElement>
            </div>
          ) : undefined
        }
      >
        {isEdit && petQuery.isLoading && (
          <p className="p-6 font-body text-sm text-neutral-gray">
            Loading pet…
          </p>
        )}
        {isEdit && petQuery.isError && (
          <p className="p-6 font-body text-sm text-rose-dark">
            Couldn't load this pet. Please try again.
          </p>
        )}

        {showView && pet && (
          <div className="p-6">
            {/* Summary banner */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {pet.petPhoto ? (
                <img
                  src={pet.petPhoto}
                  alt={`${pet.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {pet.petName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {pet.breed.breedName} · {pet.shelter.shelterName}
                </p>
              </div>
              <Badge
                tone={STATUS_TONE[pet.adoptionStatus]}
                className="shrink-0"
              >
                {ADOPTION_STATUS_LABEL[pet.adoptionStatus]}
              </Badge>
            </div>

            {/* Basic info */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="ID" v={pet.petCode} />
              <InfoRow k="Microchip ID" v={pet.microchipID || "—"} />
              <InfoRow k="Age" v={pet.petAge} />
              <InfoRow
                k="Date of Birth"
                v={formatShortDate(new Date(pet.petDOB))}
              />
              <InfoRow k="Sex" v={pet.petSex} />
              <InfoRow k="Color" v={pet.petColor} />
              <InfoRow k="Size" v={pet.petSize ?? "—"} />
              <InfoRow k="Blood Group" v={pet.petBGroup} />
              <InfoRow k="Height" v={`${pet.petHeight} cm`} />
              <InfoRow k="Weight" v={`${pet.petWeight} kg`} />
            </dl>

            {/* Intake */}
            <div className={divider} />
            <h2 className={sectionTitle}>Intake</h2>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Date" v={formatShortDate(new Date(pet.intakeDate))} />
              <InfoRow
                k="Type"
                v={pet.intakeType ? INTAKE_TYPE_LABEL[pet.intakeType] : "—"}
              />
            </dl>

            {/* Description */}
            <div className={divider} />
            <h2 className={sectionTitle}>Description</h2>
            <p className={`mt-2 ${quoteBlock}`}>
              {pet.petDesc ? `"${pet.petDesc}"` : "No description on file."}
            </p>

            {/* Compatibility */}
            <div className={divider} />
            <h2 className={sectionTitle}>Compatibility</h2>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Children" v={yesNo(pet.compatibleWithChildren)} />
              <InfoRow k="Other Pets" v={yesNo(pet.compatibleWithPets)} />
              <InfoRow k="Special Needs?" v={yesNo(pet.specialNeeds)} />
              <InfoRow k="Featured" v={yesNo(pet.featuredFlag)} />
            </dl>
          </div>
        )}

        {showForm && (
          <form
            className="flex flex-col gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) saveMutation.mutate();
            }}
          >
            <h3 className={sectionTitle}>Primary Details</h3>

            <div>
              <label className={labelClass} htmlFor="pet-species">
                Species
                <Required />
              </label>
              <select
                id="pet-species"
                required
                value={form.speciesID}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    speciesID: e.target.value,
                    breedID: "",
                  }))
                }
                className={fieldClass}
              >
                <option value="">- Select -</option>
                {species?.map((s) => (
                  <option key={s.speciesID} value={s.speciesID}>
                    {s.speciesName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-breed">
                Breed
                <Required />
              </label>
              <select
                id="pet-breed"
                required
                disabled={speciesIDNum === null}
                value={form.breedID}
                onChange={(e) =>
                  setForm((f) => ({ ...f, breedID: e.target.value }))
                }
                className={`${fieldClass} disabled:opacity-50`}
              >
                <option value="">
                  {speciesIDNum === null
                    ? "Select a species first"
                    : "- Select -"}
                </option>
                {breeds?.map((b) => (
                  <option key={b.breedID} value={b.breedID}>
                    {b.breedName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-name">
                Name
                <Required />
              </label>
              <input
                id="pet-name"
                required
                maxLength={45}
                value={form.petName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, petName: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-dob">
                  Date of birth
                  <Required />
                </label>
                <input
                  id="pet-dob"
                  type="date"
                  required
                  value={form.petDOB}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petDOB: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-sex">
                  Sex
                  <Required />
                </label>
                <select
                  id="pet-sex"
                  required
                  value={form.petSex}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      petSex: e.target.value as PetSex,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="">- Select -</option>
                  {PET_SEX_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-color">
                  Color
                  <Required />
                </label>
                <input
                  id="pet-color"
                  required
                  maxLength={45}
                  value={form.petColor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petColor: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-size">
                  Size
                  <Required />
                </label>
                <select
                  id="pet-size"
                  required
                  value={form.petSize}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      petSize: e.target.value as PetSize,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="">- Select -</option>
                  {PET_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={divider} />
            <h3 className={sectionTitle}>Medical Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-weight">
                  Weight (kg)
                  <Required />
                </label>
                <input
                  id="pet-weight"
                  type="number"
                  required
                  min={0.1}
                  step="0.1"
                  value={form.petWeight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petWeight: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-height">
                  Height (cm)
                  <Required />
                </label>
                <input
                  id="pet-height"
                  type="number"
                  required
                  min={0.1}
                  step="0.1"
                  value={form.petHeight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petHeight: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-bgroup">
                Blood group{" "}
                <span className="font-normal text-neutral-gray">
                  (optional — defaults to "N/A")
                </span>
              </label>
              <input
                id="pet-bgroup"
                maxLength={5}
                value={form.petBGroup}
                onChange={(e) =>
                  setForm((f) => ({ ...f, petBGroup: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            <div className={divider} />
            <h3 className={sectionTitle}>Profile</h3>

            <div>
              <label className={labelClass} htmlFor="pet-desc">
                Description
              </label>
              <textarea
                id="pet-desc"
                rows={3}
                maxLength={500}
                value={form.petDesc}
                onChange={(e) =>
                  setForm((f) => ({ ...f, petDesc: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-microchip">
                Microchip ID
              </label>
              <input
                id="pet-microchip"
                maxLength={45}
                value={form.microchipID}
                onChange={(e) =>
                  setForm((f) => ({ ...f, microchipID: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 font-body text-sm text-neutral-charcoal">
                <input
                  type="checkbox"
                  checked={form.compatibleWithChildren}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      compatibleWithChildren: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-neutral-lightgray text-teal-dark focus:ring-teal-dark"
                />
                Good with children
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-neutral-charcoal">
                <input
                  type="checkbox"
                  checked={form.compatibleWithPets}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      compatibleWithPets: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-neutral-lightgray text-teal-dark focus:ring-teal-dark"
                />
                Good with other pets
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-neutral-charcoal">
                <input
                  type="checkbox"
                  checked={form.specialNeeds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, specialNeeds: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-neutral-lightgray text-teal-dark focus:ring-teal-dark"
                />
                Has special needs
              </label>
              <label className="mt-3 flex items-center gap-2 font-body text-sm text-neutral-charcoal">
                <input
                  type="checkbox"
                  checked={form.featuredFlag}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, featuredFlag: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-neutral-lightgray text-teal-dark focus:ring-teal-dark"
                />
                ⭐️ Feature on home page
              </label>
            </div>

            <div className={divider} />
            <h3 className={sectionTitle}>Shelter &amp; Adoption</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-intake-date">
                  Intake date
                  <Required />
                </label>
                <input
                  id="pet-intake-date"
                  type="date"
                  required
                  value={form.intakeDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, intakeDate: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-intake-type">
                  Intake type{" "}
                  <span className="font-normal text-neutral-gray">
                    (optional)
                  </span>
                </label>
                <select
                  id="pet-intake-type"
                  value={form.intakeType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      intakeType: e.target.value as IntakeType | "",
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="">- Unknown -</option>
                  {PET_INTAKE_TYPE_VALUES.map((type) => (
                    <option key={type} value={type}>
                      {INTAKE_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-status">
                Status
                <Required />
              </label>
              <select
                id="pet-status"
                required
                value={form.adoptionStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    adoptionStatus: e.target.value as PetAdoptionStatus,
                  }))
                }
                className={fieldClass}
              >
                {PET_ADOPTION_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {ADOPTION_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className={divider} />
            <h3 className={sectionTitle}>Photo</h3>

            <div>
              {photoFile ? (
                // Staged — not uploaded yet. Saved together with the rest
                // of the form; "Remove selection" only discards the local
                // pick, it never touches the server.
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src={photoPreviewUrl ?? undefined}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover ring-2 ring-gold-md"
                  />
                  <div>
                    <p className="font-body text-xs font-medium text-gold-dark">
                      Pending — saved with your changes
                    </p>
                    <ButtonElement
                      onClick={() => setPhotoFile(null)}
                      size="bare"
                      variant="outline"
                      className="mt-1 text-xs text-rose-dark underline"
                    >
                      Remove selection
                    </ButtonElement>
                  </div>
                </div>
              ) : photos.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-3">
                  {photos.map((photo) => (
                    <div key={photo.photoID} className="relative">
                      <img
                        src={photo.photoURL}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover ring-2 ring-gold-md"
                      />
                      <ButtonElement
                        onClick={() =>
                          deletePhotoMutation.mutate(photo.photoID)
                        }
                        disabled={deletePhotoMutation.isPending}
                        aria-label="Remove photo"
                        title="Remove photo"
                        size="bare"
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-dark shadow-sm hover:brightness-90"
                      >
                        <FaTimes className="h-2.5 w-2.5" />
                      </ButtonElement>
                    </div>
                  ))}
                </div>
              ) : (
                !photosQuery.isLoading && (
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-neutral-offwhite">
                    <FaPaw className="h-8 w-8 text-rose-md" aria-hidden />
                  </div>
                )
              )}

              <label
                htmlFor="pet-photo-file"
                className="font-body text-xs text-neutral-gray"
              >
                {photos.length > 0 || photoFile
                  ? "Replace photo"
                  : "Add a photo"}{" "}
                (JPEG, PNG, or WebP - max 5 MB)
              </label>
              <input
                id="pet-photo-file"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handlePhotoSelect}
                className="mt-1 w-full font-body text-xs text-neutral-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-light file:px-3 file:py-1.5 file:font-body file:text-sm file:font-medium file:text-neutral-dark hover:file:bg-rose-light"
              />
              {photoError && (
                <p className="mt-2 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
                  {photoError}
                </p>
              )}
            </div>

            <p className="text-xs text-neutral-gray">
              <span className="text-rose-dark">*</span> Required fields
            </p>

            <div className="flex gap-3">
              {isEdit && (
                <ButtonElement
                  onClick={cancelEdit}
                  size="panel"
                  variant="outline"
                  className="flex-1 border border-neutral-lightgray text-neutral-charcoal hover:bg-neutral-lightgray"
                >
                  Cancel
                </ButtonElement>
              )}
              <ButtonElement
                type="submit"
                disabled={!canSubmit}
                size="panel"
                className="flex-1 bg-green hover:brightness-95 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending
                  ? isEdit
                    ? "Saving…"
                    : "Creating…"
                  : isEdit
                    ? "Save"
                    : "Create Pet"}
              </ButtonElement>
            </div>
          </form>
        )}

        {isEdit && mode === "edit" && pet && (
          <div className="border-t border-neutral-lightgray p-6">
            <div className="rounded-2xl border border-teal-md bg-teal-light p-4">
              <p className="font-body text-sm text-neutral-charcoal">
                Moving {pet.petName} to another shelter?{" "}
                <ButtonElement
                  onClick={() => {
                    closeAndReset();
                    navigate(`/staff/transfers?petID=${pet.petID}`);
                  }}
                  size="bare"
                  variant="outline"
                  className="font-semibold text-teal-dark underline hover:brightness-90"
                >
                  Initiate a transfer
                </ButtonElement>{" "}
                in the Transfers tab.
              </p>
            </div>
          </div>
        )}

        {isEdit && mode === "edit" && pet && (
          <div className="border-t border-neutral-lightgray p-6">
            <div className="rounded-2xl border border-rose-md bg-rose-lightest p-4">
              <h3 className="font-display text-lg text-rose-dark">
                Danger zone
              </h3>
              <p className="mt-1 font-body text-sm text-neutral-charcoal">
                Deleting a pet removes its profile and photos for good. This is
                blocked while it has a Pending or Accepted application.
              </p>
              <ButtonElement
                onClick={() => setIsDeleteOpen(true)}
                size="panel"
                variant="outline"
                className="mt-3 border border-rose-dark text-rose-dark hover:bg-rose-dark hover:text-white"
              >
                Delete pet
              </ButtonElement>
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={isDeleteOpen}
        title="Delete this pet?"
        confirmLabel="Delete"
        isPending={deletePetMutation.isPending}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => deletePetMutation.mutate()}
      >
        This permanently removes {pet?.petName ?? "this pet"}'s profile and
        photos. This can't be undone.
      </ConfirmActionModal>
    </>
  );
};

export default PetFormPanel;
