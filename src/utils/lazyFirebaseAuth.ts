export const loadFirebaseAuth = async () => {
  const [{ auth, fetchToken }, firebaseAuth] = await Promise.all([
    import("@/utils/firebase"),
    import("firebase/auth"),
  ] as const);
  return { auth, fetchToken, ...firebaseAuth };
};
