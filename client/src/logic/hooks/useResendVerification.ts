// Emails the signed-in user a new verification link — the one call behind
// every "Verify email" / "Resend" button (Profile, the dashboard banner, the
// adopt/donate gate), so they all toast the same way.
//
// Already verified (409, e.g. they verified on another device) isn't an
// error to them: the session and every cached profile catch up instead.
// Asked again within a minute (429): the toast says how long to wait.
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { errorReason, requestEmailVerification } from "../api/authApi";
import useAuthStore from "../store/useAuthStore";
import { queryClient } from "../queryClient";

const useResendVerification = () => {
  const updateUser = useAuthStore((state) => state.updateUser);

  const mutation = useMutation({
    mutationFn: requestEmailVerification,
    onSuccess: () => {
      toast.success("Verification email sent — check your inbox.");
    },
    onError: (err) => {
      if (errorReason(err) === "already_verified") {
        updateUser({ emailVerified: true });
        queryClient.invalidateQueries();
        toast.success("Your email is already verified.");
        return;
      }
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        const wait = err.response.data?.error?.details?.retryAfterSeconds;
        toast(
          typeof wait === "number"
            ? `We just sent one — you can ask again in ${wait} seconds.`
            : "We just sent one — please wait a minute before asking again.",
        );
        return;
      }
      toast.error("Couldn't send the email. Please try again.");
    },
  });

  return { resend: () => mutation.mutate(), pending: mutation.isPending };
};

export default useResendVerification;
