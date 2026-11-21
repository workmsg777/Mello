import { useState } from "react";
import { Text, View } from "react-native";
import { ChoiceChip } from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import type { DatingCatalog, DatingState } from "../../types/dating";

type Selection = { ids: string[]; required: boolean };
export function usePartnerOptions(
  catalog: DatingCatalog,
  state: DatingState,
  codes: string[],
) {
  const categories = catalog.profileOptionCategories.filter(
    (c) => codes.includes(c.code) && c.allowMatchPreference,
  );
  const [edits, setEdits] = useState<Record<string, Selection>>({});
  const controls = categories.map((category) => {
    const saved = state.optionPreferences.filter(
      (p) => p.categoryId === category.id,
    );
    const current = edits[category.id] ?? {
      ids: saved.map((p) => p.optionId),
      required: saved.some((p) => p.isDealbreaker),
    };
    const edit = (next: Selection) =>
      setEdits((prev) => ({ ...prev, [category.id]: next }));
    return (
      <View key={category.id} style={{ gap: 8 }}>
        <Text>{category.name} in a partner</Text>
        <Text>
          {category.isSensitive
            ? "Select any acceptable answers if this is essential. Leave empty for any answer."
            : "Select any answers you prefer, or leave empty for any answer."}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {catalog.profileOptions
            .filter((o) => o.categoryId === category.id)
            .map((o) => (
              <ChoiceChip
                key={o.id}
                label={o.label}
                selected={current.ids.includes(o.id)}
                onPress={() =>
                  edit({
                    required: category.isSensitive || current.required,
                    ids: current.ids.includes(o.id)
                      ? current.ids.filter((id) => id !== o.id)
                      : [...current.ids, o.id],
                  })
                }
              />
            ))}
        </View>
        {current.ids.length > 0 &&
          category.allowDealbreaker &&
          !category.isSensitive && (
            <ChoiceChip
              label="At least one is essential"
              selected={current.required}
              onPress={() => edit({ ...current, required: !current.required })}
            />
          )}
      </View>
    );
  });
  const save = async () => {
    for (const [id, selection] of Object.entries(edits))
      await datingApi.optionPreferences(id, selection.ids, selection.required);
  };
  return { controls, save };
}
