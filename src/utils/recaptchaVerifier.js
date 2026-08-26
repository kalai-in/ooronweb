import { loadFirebaseAuth } from "@/utils/lazyFirebaseAuth";

// Single shared RecaptchaVerifier for the whole app — Login, Register, and
// ForgetPasswordModal all call getRecaptchaVerifier(containerId) instead of
// each keeping their own instance/ref. A module-level variable (not a React
// ref) is what makes it actually shared: refs are local to the component that
// created them, so three separate `useRef(null)`s can never point at the same
// verifier no matter how carefully each one is cleaned up.
let verifier = null;
let verifierContainerId = null;

export const clearRecaptchaVerifier = () => {
  const container = verifierContainerId
    ? document.getElementById(verifierContainerId)
    : null;
  if (verifier && container && document.body.contains(container)) {
    try {
      verifier.clear();
    } catch (error) {
      console.log("recaptcha clear failed", error);
    }
  }
  if (container && document.body.contains(container)) {
    container.innerHTML = "";
  }
  verifier = null;
  verifierContainerId = null;
};

// Always tears down and rebuilds — a verifier is single-use per send attempt,
// and reusing one after a failed/expired/timed-out send is what Firebase
// rejects. Swapping in a cloned container (not just clearing the old one)
// sidesteps grecaptcha's internal registry still remembering the DOM node as
// "already rendered" after an interrupted render.
export const getRecaptchaVerifier = async (containerId) => {
  clearRecaptchaVerifier();
  const oldContainer = document.getElementById(containerId);
  if (!oldContainer) return null;
  const container = oldContainer.cloneNode(false);
  oldContainer.replaceWith(container);

  const { auth, RecaptchaVerifier } = await loadFirebaseAuth();
  verifier = new RecaptchaVerifier(auth, container, {
    size: "invisible",
    "expired-callback": () => {
      console.log("[recaptcha] widget expired");
      verifier = null;
      verifierContainerId = null;
    },
  });
  verifierContainerId = containerId;
  return verifier;
};
