import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { logout, restoreSession, verifyOtp } from "../services/auth.service";
import type { AuthMode, StoredSession } from "../types/auth";

interface SessionState {
  status: "idle" | "loading" | "authenticated" | "anonymous";
  session: StoredSession | null;
}

const initialState: SessionState = { status: "idle", session: null };

export const bootstrapSession = createAsyncThunk(
  "session/bootstrap",
  restoreSession,
);
export const authenticateOtp = createAsyncThunk(
  "session/authenticate",
  (input: { phone: string; otp: string; mode: AuthMode }) =>
    verifyOtp(input.phone, input.otp, input.mode),
);
export const signOut = createAsyncThunk("session/signOut", logout);

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    sessionExpired(state) {
      state.status = "anonymous";
      state.session = null;
    },
    setSession(state, action: PayloadAction<StoredSession>) {
      state.status = "authenticated";
      state.session = action.payload;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(bootstrapSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.session = action.payload;
        state.status = action.payload ? "authenticated" : "anonymous";
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.status = "anonymous";
        state.session = null;
      })
      .addCase(authenticateOtp.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.session = action.payload;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.status = "anonymous";
        state.session = null;
      }),
});

export const { sessionExpired } = sessionSlice.actions;
export default sessionSlice.reducer;
