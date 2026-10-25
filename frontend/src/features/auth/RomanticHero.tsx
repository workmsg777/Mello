import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../../theme";

export function RomanticHero() {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let active = true;
    const configure = (reduce: boolean) => {
      loop?.stop();
      float.setValue(0);
      if (!reduce && active) {
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(float, {
              toValue: 1,
              duration: 2800,
              useNativeDriver: true,
            }),
            Animated.timing(float, {
              toValue: 0,
              duration: 2800,
              useNativeDriver: true,
            }),
          ]),
        );
        loop.start();
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(configure);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      configure,
    );
    return () => {
      active = false;
      loop?.stop();
      subscription.remove();
    };
  }, [float]);
  return (
    <View
      style={s.wrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={s.orbit} />
      <View style={s.orbitInner} />
      <Animated.View
        style={[
          s.portrait,
          s.left,
          {
            transform: [
              { rotate: "-12deg" },
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -12],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=85",
          }}
          style={s.photo}
        />
        <Text style={s.photoCaption}>a little curiosity.</Text>
      </Animated.View>
      <Animated.View
        style={[
          s.portrait,
          s.right,
          {
            transform: [
              { rotate: "10deg" },
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-6, 7],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=85",
          }}
          style={s.photo}
        />
        <Text style={s.photoCaption}>a little courage.</Text>
      </Animated.View>
      <Animated.View
        style={[
          s.heart,
          {
            transform: [
              {
                scale: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1.08],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="heart" size={32} color="white" />
      </Animated.View>
      <View style={s.message}>
        <Text style={s.messageText}>you had me at hello.</Text>
        <Ionicons name="heart-outline" size={16} color={colors.coral} />
      </View>
      <Text style={s.star}>✦</Text>
      <Text style={s.smallStar}>✧</Text>
      <Text style={s.tinyHeart}>♡</Text>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: {
    height: 310,
    width: 330,
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  orbit: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 150,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E4BDC5",
    top: 0,
    left: 20,
  },
  orbitInner: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 130,
    backgroundColor: "#F6DADE",
    top: 25,
    left: 45,
  },
  portrait: {
    position: "absolute",
    width: 143,
    height: 191,
    padding: 7,
    paddingBottom: 10,
    backgroundColor: "#FFFCF7",
    borderRadius: 11,
    shadowColor: "#7A3A52",
    shadowOpacity: 0.17,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  left: { left: 24, top: 39 },
  right: { right: 18, top: 72 },
  photo: { width: "100%", height: 148, borderRadius: 6 },
  photoCaption: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontStyle: "italic",
    color: colors.plum,
    fontSize: 11,
    textAlign: "center",
    paddingTop: 9,
  },
  heart: {
    position: "absolute",
    top: 128,
    left: 141,
    width: 57,
    height: 57,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.coral,
    borderWidth: 4,
    borderColor: "#FBEAEB",
  },
  message: {
    position: "absolute",
    bottom: 10,
    left: 37,
    backgroundColor: "white",
    borderRadius: 25,
    paddingHorizontal: 23,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    transform: [{ rotate: "-5deg" }],
  },
  messageText: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontSize: 18,
    fontStyle: "italic",
    color: colors.plum,
  },
  star: {
    position: "absolute",
    top: 13,
    right: 33,
    fontSize: 37,
    color: colors.coral,
  },
  smallStar: {
    position: "absolute",
    top: 209,
    left: 2,
    fontSize: 35,
    color: "#B48769",
  },
  tinyHeart: {
    position: "absolute",
    top: 9,
    left: 77,
    fontSize: 22,
    color: colors.coral,
  },
});
