import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { LoadingScreen } from "../../src/components/ui";
import { useAppDispatch, useAppSelector } from "../../src/store";
import { loadDatingData } from "../../src/store/datingSlice";

export default function OnboardingLayout() {
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.session.status);
  const dating = useAppSelector((s) => s.dating.status);
  useEffect(() => {
    if (session === "authenticated" && dating === "idle")
      void dispatch(loadDatingData());
  }, [dating, dispatch, session]);
  if (session === "anonymous") return <Redirect href="/auth" />;
  if (session !== "authenticated" || dating !== "ready")
    return <LoadingScreen />;
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    />
  );
}
