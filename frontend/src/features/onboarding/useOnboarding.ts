import { router, type Href } from "expo-router";
import { useState } from "react";
import { getApiErrorMessage } from "../../config/api";
import { datingApi } from "../../services/dating.service";
import { useAppDispatch, useAppSelector } from "../../store";
import { refreshDatingState } from "../../store/datingSlice";
import { stepByCode } from "../../utils/onboarding";

export function useOnboarding() {
  const dispatch = useAppDispatch();
  const catalog = useAppSelector((s) => s.dating.catalog);
  const state = useAppSelector((s) => s.dating.state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !state) throw new Error("Onboarding data is not loaded");

  const run = async (work: () => Promise<unknown>, next?: Href) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await dispatch(refreshDatingState()).unwrap();
      if (next) router.push(next);
      return true;
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const finish = (
    code: string,
    next: Href,
    skipped = false,
    before?: () => Promise<unknown>,
  ) =>
    run(async () => {
      if (before) await before();
      const step = stepByCode(catalog, code);
      await datingApi.finishStep(catalog.onboardingVersion, step.id, skipped);
    }, next);

  const progress = (stepCode: string) => {
    const sequence = stepByCode(catalog, stepCode).sequence;
    return Math.round(
      (sequence / Math.max(catalog.onboardingSteps.length, 1)) * 100,
    );
  };
  return { catalog, state, busy, error, setError, run, finish, progress };
}
