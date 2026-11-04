import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { Card as ThoughtCard } from './types';
import { palette } from './ui';

const spring = { damping: 21, stiffness: 155, mass: 0.85 };

export function Card({
  card,
  cardNumber,
  canNext,
  canPrevious,
  animations,
  onOpen,
  onNext,
  onPrevious,
}: {
  card: ThoughtCard;
  cardNumber: number;
  canNext: boolean;
  canPrevious: boolean;
  animations: boolean;
  onOpen: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const screenWidth = Dimensions.get('window').width;
  const x = useSharedValue(0);
  const flip = useSharedValue(0);
  const flipTarget = useSharedValue(0);
  const scale = useSharedValue(animations ? 0.965 : 1);

  useEffect(() => {
    if (animations) scale.value = withSpring(1, spring);
  }, [animations, scale]);

  const pan = Gesture.Pan().activeOffsetX([-12, 12]).failOffsetY([-18, 18])
    .onUpdate(event => { x.value = event.translationX; })
    .onEnd(event => {
      const direction = event.translationX < 0 || (Math.abs(event.translationX) < 8 && event.velocityX < 0) ? -1 : 1;
      if (Math.abs(event.translationX) > Math.max(86, screenWidth * 0.24) || Math.abs(event.velocityX) > 660) {
        if ((direction < 0 && !canNext) || (direction > 0 && !canPrevious)) {
          x.value = animations ? withSpring(0, spring) : 0;
          return;
        }
        if (animations) x.value = withTiming(direction * (screenWidth + 100), { duration: 235, easing: Easing.out(Easing.cubic) }, finished => {
          if (finished) {
            if (direction < 0) runOnJS(onNext)(); else runOnJS(onPrevious)();
          }
        });
        else if (direction < 0) runOnJS(onNext)(); else runOnJS(onPrevious)();
      } else x.value = animations ? withSpring(0, spring) : 0;
    })
    .onFinalize((_event, success) => {
      if (!success) x.value = animations ? withSpring(0, spring) : 0;
    });

  const tap = Gesture.Tap().maxDistance(12).onEnd((_event, success) => {
    if (success) {
      flipTarget.value = flipTarget.value === 0 ? 1 : 0;
      flip.value = animations ? withSpring(flipTarget.value, spring) : flipTarget.value;
    }
  });

  const longPress = Gesture.LongPress().minDuration(450).maxDistance(12).onEnd((_event, success) => {
    if (success) runOnJS(onOpen)();
  });

  const motion = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.value), [0, 350], [1, 0.9], Extrapolation.CLAMP),
    transform: [
      { translateX: x.value },
      { rotateZ: `${interpolate(x.value, [-320, 0, 320], [-7, 0, 7], Extrapolation.CLAMP)}deg` },
      { scale: scale.value * interpolate(Math.abs(x.value), [0, 160], [1, 0.985], Extrapolation.CLAMP) },
    ],
  }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1200 }, { rotateY: `${180 + flip.value * 180}deg` }] }));
  const printedNumber = String(cardNumber).padStart(2, '0');

  return <GestureDetector gesture={Gesture.Race(pan, longPress, tap)}>
    <Animated.View style={[styles.wrapper, motion]} accessibilityRole="button" accessibilityLabel={`${card.title}，轻触翻面，左右滑动切换，长按阅读`}>
      <View style={styles.stackFar} />
      <View style={styles.stackNear} />
      <Animated.View style={[styles.card, styles.face, front]}>
        <View pointerEvents="none" style={styles.innerFrame} />
        <View style={styles.cornerRow}>
          <Text style={styles.corner}>NOESIS  /  THOUGHT</Text>
          <Text style={styles.corner}>{printedNumber}</Text>
        </View>
        <View style={styles.frontBody}>
          <Text style={styles.watermark}>{printedNumber}</Text>
          <View style={styles.accentRule} />
          <Text numberOfLines={4} style={styles.title}>{card.title}</Text>
          <View style={[styles.accentRule, styles.shortRule]} />
        </View>
        <Text style={styles.foot}>轻触翻面　·　左右滑动</Text>
      </Animated.View>
      <Animated.View style={[styles.card, styles.face, styles.back, back]}>
        <View pointerEvents="none" style={styles.innerFrame} />
        <View style={styles.cornerRow}>
          <Text style={styles.corner}>卡片正文</Text>
          <Text style={styles.corner}>{printedNumber}</Text>
        </View>
        <View style={styles.backBody}>
          <Text numberOfLines={2} style={styles.backTitle}>{card.title}</Text>
          <View style={styles.backRule} />
          <Text numberOfLines={8} style={styles.content}>{card.content || '这张卡片还没有正文。'}</Text>
        </View>
        <Text style={styles.foot}>长按阅读全文</Text>
      </Animated.View>
    </Animated.View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  wrapper: { width: '88%', maxWidth: 340, aspectRatio: 0.72, maxHeight: 460, alignSelf: 'center', marginVertical: 16 },
  stackFar: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#e4dccb', borderRadius: 22, transform: [{ rotate: '-2.4deg' }, { translateY: 7 }, { translateX: -2 }] },
  stackNear: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#eee7d9', borderRadius: 22, transform: [{ rotate: '1.4deg' }, { translateY: 3 }, { translateX: 1 }] },
  card: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 21, padding: 25, backgroundColor: palette.card, borderWidth: 1, borderColor: '#d9d0c0', justifyContent: 'space-between', shadowColor: palette.shadow, shadowOpacity: 0.15, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  face: { backfaceVisibility: 'hidden' },
  back: { backgroundColor: '#f3eee3' },
  innerFrame: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, borderWidth: 1, borderColor: '#ebe4d6', borderRadius: 15 },
  cornerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  corner: { color: palette.gold, fontSize: 9, letterSpacing: 1.7 },
  frontBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  watermark: { position: 'absolute', color: '#947a56', opacity: 0.1, fontFamily: 'serif', fontSize: 112, lineHeight: 125 },
  accentRule: { width: 34, height: 1, backgroundColor: palette.accent, opacity: 0.8, marginBottom: 24 },
  shortRule: { width: 20, marginTop: 22, marginBottom: 0 },
  title: { color: palette.ink, fontFamily: 'serif', fontSize: 30, lineHeight: 40, fontWeight: '400', textAlign: 'center' },
  foot: { color: palette.muted, textAlign: 'center', fontSize: 10, letterSpacing: 1.25 },
  backBody: { flex: 1, justifyContent: 'center', paddingVertical: 15 },
  backTitle: { color: palette.ink, fontFamily: 'serif', fontSize: 21, lineHeight: 29, textAlign: 'center' },
  backRule: { width: 27, height: 1, backgroundColor: palette.accent, alignSelf: 'center', marginVertical: 17 },
  content: { color: '#54534b', fontFamily: 'serif', fontSize: 15, lineHeight: 25, textAlign: 'center' },
});
