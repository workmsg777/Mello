import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPartnerCatalog,
  type PartnerCity,
} from "../services/partner.service";
import { getApiErrorMessage } from "../config/api";
export function CitySelect({
  value,
  onSelect,
  disabled = false,
}: {
  value: string;
  onSelect: (city: PartnerCity) => void;
  disabled?: boolean;
}) {
  const [cities, setCities] = useState<PartnerCity[]>([]),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError(null);
    void getPartnerCatalog()
      .then((catalog) => setCities(catalog.cities))
      .catch((caught) => setError(getApiErrorMessage(caught)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  return (
    <View style={s.field}>
      <Text style={s.label}>CITY</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select city"
        disabled={disabled || loading}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={[s.select, disabled && { opacity: 0.6 }]}
      >
        <Text style={s.value}>
          {value || (loading ? "Loading cities…" : "Choose your city")}
        </Text>
        <Text style={s.value}>⌄</Text>
      </Pressable>
      {error ? (
        <Pressable accessibilityRole="button" onPress={load}>
          <Text style={s.error}>{error} · Tap to retry</Text>
        </Pressable>
      ) : null}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.row}>
              <Text style={s.heading}>Choose your city</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close city selector"
                onPress={() => setOpen(false)}
              >
                <Text style={s.value}>Close ✕</Text>
              </Pressable>
            </View>
            <Text style={s.hint}>Your state is filled automatically.</Text>
            <TextInput
              accessibilityLabel="Search cities"
              value={search}
              onChangeText={setSearch}
              placeholder="Search city or state"
              style={s.input}
            />
            {loading ? (
              <ActivityIndicator />
            ) : (
              <FlatList
                data={cities.filter((city) =>
                  `${city.label} ${city.state}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )}
                keyExtractor={(city) => city.value}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={s.hint}>
                    No supported cities match that search.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label}, ${item.state}`}
                    onPress={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    style={[
                      s.option,
                      item.value === value && { backgroundColor: "#EAF0E5" },
                    ]}
                  >
                    <Text style={s.value}>{item.label}</Text>
                    <Text style={s.hint}>{item.state}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { color: "#48554f", fontSize: 11, fontWeight: "800", marginBottom: 7 },
  select: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#DDD6C9",
    borderRadius: 13,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFEFA",
  },
  value: { color: "#25362f", fontSize: 14 },
  error: { color: "#AE3838", fontSize: 11, paddingTop: 7 },
  backdrop: {
    flex: 1,
    backgroundColor: "#203D3580",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fffdf7",
    borderRadius: 24,
    padding: 22,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    height: "75%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heading: { color: "#203D35", fontSize: 20, fontWeight: "700" },
  hint: { fontSize: 12, color: "#7D8C80", lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#DFE5DA",
    borderRadius: 12,
    padding: 14,
    marginVertical: 16,
    color: "#203D35",
  },
  option: { padding: 14, borderRadius: 12, gap: 4 },
});
