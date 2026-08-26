export const loadFirebaseAuth = async () => {
  const [{ auth, fetchToken }, firebaseAuth] = await Promise.all([
    import("@/utils/firebase"),
    import("firebase/auth"),
  ]);
  return { auth, fetchToken, ...firebaseAuth };
};
