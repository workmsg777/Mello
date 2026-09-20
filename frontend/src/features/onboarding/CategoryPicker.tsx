import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChoiceChip } from "../../components/ui";
import type { DatingCatalog, DatingState } from "../../types/dating";
import { colors } from "../../theme";

export function CategoryPicker({
  codes,
  catalog,
  state,
  onChange,
}: {
  codes: string[];
  catalog: DatingCatalog;
  state: DatingState;
  onChange: (value: Record<string, string[]>) => void;
}) {
  const categories = catalog.profileOptionCategories.filter((c) =>
    codes.includes(c.code),
  );
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      categories.map((c) => [
        c.id,
        state.profileOptions
          .filter((x) => x.categoryId === c.id)
          .map((x) => x.optionId),
      ]),
    ),
  );
  const choose = (categoryId: string, optionId: string, single: boolean) => {
    const next = {
      ...selected,
      [categoryId]: single
        ? [optionId]
        : selected[categoryId]?.includes(optionId)
          ? selected[categoryId].filter((id) => id !== optionId)
          : [...(selected[categoryId] ?? []), optionId],
    };
    setSelected(next);
    onChange(next);
  };
  return (
    <>
      {categories.map((category) => (
        <View key={category.id} style={styles.group}>
          <Text style={styles.heading}>{category.name}</Text>
          <View style={styles.wrap}>
            {catalog.profileOptions
              .filter((x) => x.categoryId === category.id)
              .map((option) => (
                <ChoiceChip
                  key={option.id}
                  label={option.label}
                  selected={selected[category.id]?.includes(option.id) ?? false}
                  onPress={() =>
                    choose(
                      category.id,
                      option.id,
                      category.selectionMode === "SINGLE",
                    )
                  }
                />
              ))}
          </View>
        </View>
      ))}
    </>
  );
}
export function categoryInitial(
  codes: string[],
  catalog: DatingCatalog,
  state: DatingState,
) {
  const categories = catalog.profileOptionCategories.filter((c) =>
    codes.includes(c.code),
  );
  return Object.fromEntries(
    categories.map((c) => [
      c.id,
      state.profileOptions
        .filter((x) => x.categoryId === c.id)
        .map((x) => x.optionId),
    ]),
  );
}
const styles = StyleSheet.create({
  group: { gap: 9 },
  heading: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
});
