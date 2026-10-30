import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getApiErrorMessage } from "../config/api";
import {
  getPartnerCatalog,
  partnerApi,
  type Employee,
  type PartnerCatalog,
} from "../services/partner.service";
export function PartnerTeam() {
  const [team, setTeam] = useState<Employee[]>([]),
    [catalog, setCatalog] = useState<PartnerCatalog | null>(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [role, setRole] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const load = () => {
    setLoading(true);
    void Promise.all([partnerApi.team(), getPartnerCatalog()])
      .then(([members, meta]) => {
        setTeam(members);
        setCatalog(meta);
        setRole(meta.roles.find((item) => item.assignable)?.code ?? "");
        setError(null);
      })
      .catch((caught) => setError(getApiErrorMessage(caught)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const add = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setTeam(
        await partnerApi.addEmployee({
          name: name.trim(),
          phone: `+91${phone}`,
          role,
        }),
      );
      setName("");
      setPhone("");
      setNotice(
        "Employee added. Ask them to choose Partner login and verify an OTP on their own phone. No message has been sent automatically.",
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (employee: Employee) => {
    setBusy(true);
    setError(null);
    try {
      setTeam(
        await partnerApi.setEnabled(
          employee.id,
          employee.status === "SUSPENDED",
        ),
      );
      setNotice(
        employee.status === "SUSPENDED"
          ? "Access restored. The employee can log in again."
          : "Employee access disabled and existing sessions revoked.",
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <ActivityIndicator color="#315C4C" />;
  return (
    <View style={s.page}>
      <Text style={s.title}>Your café team</Text>
      <Text style={s.copy}>
        Add employees to this café. Support can manage menus, photos, plans,
        packages and events. Business settings and team access stay with you.
      </Text>
      {error ? (
        <View>
          <Text style={s.error}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={s.link}>Reload team</Text>
          </Pressable>
        </View>
      ) : null}
      {notice ? <Text style={s.notice}>{notice}</Text> : null}
      <View style={s.card}>
        <Text style={s.heading}>Add an employee</Text>
        <Text style={s.label}>Employee name</Text>
        <TextInput
          accessibilityLabel="Employee name"
          value={name}
          onChangeText={setName}
          maxLength={200}
          style={s.input}
        />
        <Text style={s.label}>Employee mobile number (+91)</Text>
        <TextInput
          accessibilityLabel="Employee mobile number"
          value={phone}
          onChangeText={(value) =>
            setPhone(value.replace(/\D/g, "").slice(0, 10))
          }
          keyboardType="phone-pad"
          maxLength={10}
          style={s.input}
        />
        <Text style={s.label}>Role</Text>
        <View style={s.row}>
          {catalog?.roles
            .filter((item) => item.assignable)
            .map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: role === item.code }}
                key={item.code}
                onPress={() => setRole(item.code)}
                style={s.role}
              >
                <Text style={s.roleText}>{item.label}</Text>
              </Pressable>
            ))}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !name.trim() || phone.length !== 10 || !role}
          onPress={() => void add()}
          style={[
            s.button,
            (busy || !name.trim() || phone.length !== 10) && { opacity: 0.5 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={s.buttonText}>Add employee</Text>
          )}
        </Pressable>
      </View>
      {team.map((employee) => (
        <View key={employee.id} style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.heading}>{employee.name}</Text>
              <Text style={s.copy}>
                {catalog?.roles.find((item) => item.code === employee.role)
                  ?.label ?? employee.role}{" "}
                ·{" "}
                {employee.status === "PENDING"
                  ? "Awaiting first OTP login"
                  : employee.status === "SUSPENDED"
                    ? "Access disabled"
                    : "Active"}
              </Text>
              <Text style={s.copy}>{employee.phone}</Text>
            </View>
            {catalog?.roles.find((item) => item.code === employee.role)
              ?.assignable ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void toggle(employee)}
              >
                <Text style={s.link}>
                  {employee.status === "SUSPENDED"
                    ? "Enable access"
                    : "Disable access"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  page: { gap: 18 },
  title: { fontSize: 27, color: "#203D35", fontWeight: "700" },
  copy: { color: "#7D8C80", fontSize: 12, lineHeight: 20 },
  error: { color: "#AE3838", fontSize: 12 },
  notice: {
    backgroundColor: "#EAF0E5",
    padding: 15,
    borderRadius: 14,
    color: "#315C4C",
    fontSize: 12,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: "#DFE5DA",
    backgroundColor: "white",
    padding: 22,
    borderRadius: 22,
    gap: 10,
  },
  heading: { color: "#203D35", fontSize: 17, fontWeight: "700" },
  label: { color: "#48554F", fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#DFE5DA",
    borderRadius: 12,
    padding: 14,
    color: "#203D35",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  role: { backgroundColor: "#EAF0E5", padding: 12, borderRadius: 12 },
  roleText: { color: "#315C4C", fontSize: 12, fontWeight: "600" },
  button: {
    backgroundColor: "#315C4C",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "white", fontSize: 13, fontWeight: "700" },
  link: { color: "#A55D2B", fontWeight: "700", fontSize: 12, padding: 8 },
});
