import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { getApiErrorMessage } from "../config/api";
import {
  getPartnerCatalog,
  partnerApi,
  partnerPhotoUrl,
  type PartnerContent as Content,
  type PartnerPhoto,
} from "../services/partner.service";
const localTime = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
function Input({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function PartnerContent() {
  const [items, setItems] = useState<Content[]>([]),
    [kinds, setKinds] = useState<string[]>([]),
    [filter, setFilter] = useState("ALL"),
    [editor, setEditor] = useState(false),
    [id, setId] = useState<string | undefined>(),
    [kind, setKind] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState(""),
    [starts, setStarts] = useState(""),
    [ends, setEnds] = useState(""),
    [published, setPublished] = useState(false),
    [photos, setPhotos] = useState<PartnerPhoto[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const load = () => {
    setLoading(true);
    void Promise.all([partnerApi.content(), getPartnerCatalog()])
      .then(([content, catalog]) => {
        setItems(content);
        setKinds(catalog.contentKinds);
        setError(null);
      })
      .catch((caught) => setError(getApiErrorMessage(caught)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const edit = (item?: Content) => {
    setId(item?.id);
    setKind(item?.kind ?? kinds[0] ?? "");
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setPrice(item?.priceInr?.toString() ?? "");
    setStarts(localTime(item?.startsAt ?? null));
    setEnds(localTime(item?.endsAt ?? null));
    setPublished(item?.isPublished ?? false);
    setPhotos(item?.photos ?? []);
    setEditor(true);
    setError(null);
    setNotice(null);
  };
  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (!result.canceled) {
        const photo = await partnerApi.upload(result.assets[0]!);
        setPhotos((current) => [...current, photo]);
      }
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const parseDate = (value: string) => {
        if (!value.trim()) return null;
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
          throw new Error("Use YYYY-MM-DD HH:mm for event times.");
        const parsed = new Date(value.replace(" ", "T"));
        if (
          !Number.isFinite(parsed.getTime()) ||
          localTime(parsed.toISOString()) !== value
        )
          throw new Error("Choose a valid event date and time.");
        return parsed.toISOString();
      };
      if (price.trim() && !/^\d+$/.test(price.trim()))
        throw new Error(
          "Enter a whole-number price in rupees, or leave it empty.",
        );
      setItems(
        await partnerApi.saveContent(
          {
            kind,
            title: title.trim(),
            description: description.trim(),
            priceInr: price.trim() ? Number(price) : null,
            startsAt: parseDate(starts),
            endsAt: parseDate(ends),
            isPublished: published,
            photoIds: photos.map((photo) => photo.id),
          },
          id,
        ),
      );
      setEditor(false);
      setNotice(
        published
          ? "Published. Your café content is available to users viewing your published venue."
          : "Draft saved. Publish it whenever it is ready.",
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
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>What’s happening at your place?</Text>
          <Text style={s.copy}>
            Menus, thoughtful packages, date plans and special events, managed
            by your café team.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => edit()}
          style={s.button}
        >
          <Text style={s.buttonText}>Add new</Text>
        </Pressable>
      </View>
      {error ? (
        <View>
          <Text style={s.error}>{error}</Text>
          {!editor ? (
            <Pressable onPress={load}>
              <Text style={s.link}>Reload content</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {notice ? <Text style={s.notice}>{notice}</Text> : null}
      {editor ? (
        <View style={s.card}>
          <Text style={s.heading}>{id ? "Update" : "Create"} café content</Text>
          <View style={s.row}>
            {kinds.map((value) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: kind === value }}
                key={value}
                disabled={busy}
                onPress={() => setKind(value)}
                style={[s.chip, kind === value && s.active]}
              >
                <Text
                  style={[s.chipText, kind === value && { color: "white" }]}
                >
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input label="Title" value={title} onChange={setTitle} />
          <Input
            label="Description / menu details"
            value={description}
            onChange={setDescription}
            multiline
          />
          <Input
            label="Price in rupees (optional)"
            value={price}
            onChange={setPrice}
          />
          <Text style={s.copy}>
            For events, enter the start time. Times use your device’s local time
            zone.
          </Text>
          <Input
            label="Start · YYYY-MM-DD HH:mm"
            value={starts}
            onChange={setStarts}
          />
          <Input
            label="End · YYYY-MM-DD HH:mm (optional)"
            value={ends}
            onChange={setEnds}
          />
          <Text style={s.label}>Photos · {photos.length}/10</Text>
          <View style={s.row}>
            {photos.map((photo) => (
              <View key={photo.id} style={{ gap: 5 }}>
                <Image
                  source={{ uri: partnerPhotoUrl(photo.url) }}
                  style={s.photo}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo from this content"
                  disabled={busy}
                  onPress={() =>
                    setPhotos((current) =>
                      current.filter((item) => item.id !== photo.id),
                    )
                  }
                >
                  <Text style={s.link}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy || photos.length >= 10}
            onPress={() => void upload()}
            style={s.outline}
          >
            <Text style={s.link}>
              {busy ? "Working…" : "Add photo from device"}
            </Text>
          </Pressable>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.heading}>Publish this content</Text>
              <Text style={s.copy}>
                Drafts are only visible to your café team. Published items
                appear when the venue itself is published.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Publish content"
              value={published}
              onValueChange={setPublished}
              disabled={busy}
            />
          </View>
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !title.trim() || !kind}
              onPress={() => void save()}
              style={[s.button, (busy || !title.trim()) && { opacity: 0.5 }]}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.buttonText}>
                  Save {published ? "& publish" : "draft"}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setEditor(false)}
            >
              <Text style={s.link}>Cancel editing</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={s.row}>
        {["ALL", ...kinds].map((value) => (
          <Pressable
            accessibilityRole="button"
            key={value}
            onPress={() => setFilter(value)}
            style={[s.chip, filter === value && s.active]}
          >
            <Text style={[s.chipText, filter === value && { color: "white" }]}>
              {value === "ALL"
                ? "All content"
                : value.charAt(0) + value.slice(1).toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      {items
        .filter((item) => filter === "ALL" || item.kind === filter)
        .map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.row}>
              <Text style={s.eyebrow}>
                {item.kind} · {item.isPublished ? "PUBLISHED" : "DRAFT"}
              </Text>
            </View>
            <Text style={s.heading}>{item.title}</Text>
            <Text style={s.copy}>{item.description}</Text>
            {item.priceInr !== null ? (
              <Text style={s.heading}>
                ₹{item.priceInr.toLocaleString("en-IN")}
              </Text>
            ) : null}
            {item.startsAt ? (
              <Text style={s.copy}>
                {new Date(item.startsAt).toLocaleString()}
                {item.endsAt
                  ? ` – ${new Date(item.endsAt).toLocaleString()}`
                  : ""}
              </Text>
            ) : null}
            <View style={s.row}>
              {item.photos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: partnerPhotoUrl(photo.url) }}
                  style={s.photo}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => edit(item)}
              style={s.outline}
            >
              <Text style={s.link}>Edit {item.kind.toLowerCase()}</Text>
            </Pressable>
          </View>
        ))}
      {!items.length && !editor ? (
        <View style={s.card}>
          <Text style={s.heading}>Give them something to look forward to.</Text>
          <Text style={s.copy}>
            Add your first menu, package, plan or event. Your team can keep
            everything current together.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  page: { gap: 20 },
  title: { fontSize: 27, color: "#203D35", fontWeight: "700", marginBottom: 8 },
  copy: { color: "#7D8C80", fontSize: 12, lineHeight: 20 },
  heading: { color: "#203D35", fontSize: 17, fontWeight: "700" },
  eyebrow: {
    color: "#A55D2B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  label: { color: "#48554F", fontSize: 12, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#DFE5DA",
    borderRadius: 22,
    padding: 22,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DFE5DA",
    borderRadius: 12,
    padding: 14,
    color: "#203D35",
    fontSize: 14,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#DFE5DA",
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  active: { backgroundColor: "#315C4C", borderColor: "#315C4C" },
  chipText: { color: "#315C4C", fontSize: 12 },
  button: {
    backgroundColor: "#315C4C",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 13, fontWeight: "700" },
  outline: {
    borderWidth: 1,
    borderColor: "#DFE5DA",
    padding: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  link: { color: "#A55D2B", fontWeight: "700", fontSize: 12, padding: 6 },
  photo: { width: 110, height: 110, borderRadius: 12 },
  error: { color: "#AE3838", fontSize: 12, lineHeight: 20 },
  notice: {
    backgroundColor: "#EAF0E5",
    padding: 15,
    borderRadius: 14,
    color: "#315C4C",
    fontSize: 12,
    lineHeight: 20,
  },
});
