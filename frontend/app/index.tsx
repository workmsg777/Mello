import { router } from "expo-router";
import { useEffect } from "react";
import { getApiErrorMessage } from "../src/config/api";
import { LoadingScreen, PrimaryButton, Screen } from "../src/components/ui";
import { loadDatingData } from "../src/store/datingSlice";
import { useAppDispatch, useAppSelector } from "../src/store";
import { resumePath } from "../src/utils/onboarding";
import { Text } from "react-native";

export default function EntryScreen() {
  const dispatch = useAppDispatch();
  const sessionStatus = useAppSelector((s) => s.session.status);
  const dating = useAppSelector((s) => s.dating);
  useEffect(() => {
    if (sessionStatus === "anonymous") router.replace("/auth");
    if (sessionStatus === "authenticated" && dating.status === "idle")
      void dispatch(loadDatingData());
  }, [dating.status, dispatch, sessionStatus]);
  useEffect(() => {
    if (
      sessionStatus !== "authenticated" ||
      dating.status !== "ready" ||
      !dating.catalog ||
      !dating.state
    )
      return;
    if (dating.state.onboarding.progress?.status === "COMPLETED")
      router.replace("/home");
    else router.replace(resumePath(dating.catalog, dating.state));
  }, [dating.catalog, dating.state, dating.status, sessionStatus]);

  if (dating.status === "error")
    return (
      <Screen>
        <Text>{getApiErrorMessage(dating.error)}</Text>
        <PrimaryButton
          label="Try again"
          onPress={() => void dispatch(loadDatingData())}
        />
      </Screen>
    );
  return <LoadingScreen />;
}
