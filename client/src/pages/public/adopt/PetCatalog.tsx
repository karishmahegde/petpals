import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { getPets } from "../../../logic/api/petsApi";
import CardComponent from "../../../components/ui/PetCatalogCard";

const LIMIT = 20;

const PetCatalog = () => {
  const [page, setPage] = useState(1);

  const {
    data: petsResult,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["pets", page],
    queryFn: () => getPets({}, page, LIMIT),
    placeholderData: keepPreviousData,
  });

  const pets = petsResult?.data ?? [];
  const pagination = petsResult?.pagination;

  const errorMessage =
    axios.isAxiosError(error) && error.response?.data?.message
      ? error.response.data.message
      : "Failed to load pets.";

  return (
    <div id="pets" className="bg-neutral-offwhite py-14 px-6 font-body">
      <div className="text-center">
        <h1 className="lg:text-4xl text-3xl font-bold text-black mb-4">
          Pet Catalog 🐶
        </h1>
        <p>Warning! ⚠️ Extreme cuteness ahead 🥰</p>
      </div>

      <div className="mt-10 max-w-6xl mx-auto">
        {/* TODO: filter bar goes here, above the grid */}

        <div>
          {isError && (
            <div className="mx-6 my-6 rounded-md bg-rose-light p-4 text-rose-dark">
              {errorMessage}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-lg bg-neutral-offwhite animate-pulse"
                />
              ))}
            </div>
          ) : pets.length === 0 ? (
            <p className="text-center text-neutral-gray py-12">
              No pets match your filters yet — try widening your search.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-9">
                {pets.map((pet) => (
                  <CardComponent key={pet.petID} pet={pet} />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="rounded-md bg-teal-dark px-4 py-2 text-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-neutral-charcoal">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="rounded-md bg-teal-dark px-4 py-2 text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PetCatalog;
