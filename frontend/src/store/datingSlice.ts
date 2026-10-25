import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { datingApi } from "../services/dating.service";
import type { DatingCatalog, DatingState } from "../types/dating";

interface DatingStoreState {
  catalog: DatingCatalog | null;
  state: DatingState | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const initialState: DatingStoreState = {
  catalog: null,
  state: null,
  status: "idle",
  error: null,
};
export const loadDatingData = createAsyncThunk("dating/load", async () => {
  const [catalog, state] = await Promise.all([
    datingApi.catalog(),
    datingApi.state(),
  ]);
  return { catalog, state };
});
export const refreshDatingState = createAsyncThunk(
  "dating/refresh",
  datingApi.state,
);

const datingSlice = createSlice({
  name: "dating",
  initialState,
  reducers: { clearDatingData: () => initialState },
  extraReducers: (builder) =>
    builder
      .addCase(loadDatingData.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadDatingData.fulfilled, (state, action) => {
        state.catalog = action.payload.catalog;
        state.state = action.payload.state;
        state.status = "ready";
      })
      .addCase(loadDatingData.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Unable to load your profile";
      })
      .addCase(refreshDatingState.fulfilled, (state, action) => {
        state.state = action.payload;
        state.status = "ready";
      }),
});

export const { clearDatingData } = datingSlice.actions;
export default datingSlice.reducer;
