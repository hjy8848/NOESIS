import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { Card as ThoughtCard } from './types';

const spring = { damping: 18, stiffness: 150 };

export function Card({
  card,
  canNext,
  canPrevious,
  animations,
  onOpen,
  onNext,
  onPrevious,
}: {
  card: ThoughtCard;
  canNext: boolean;
  canPrevious: boolean;
  animations: boolean;
  onOpen: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const x = useSharedValue(0);
  const flip = useSharedValue(0);
  const flipTarget = useSharedValue(0);
  const pan = Gesture.Pan().activeOffsetX([-12, 12]).failOffsetY([-18, 18])
    .onUpdate(event => { x.value = event.translationX; })
    .onEnd(event => {
      const direction = event.translationX < 0 ? -1 : 1;
      if (Math.abs(event.translationX) > 90 || Math.abs(event.velocityX) > 700) {
        if ((direction < 0 && !canNext) || (direction > 0 && !canPrevious)) {
          x.value = animations ? withSpring(0, spring) : 0;
          return;
        }
        if (animations) x.value = withTiming(direction * 500, { duration: 180 }, finished => {
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
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotateZ: `${interpolate(x.value, [-300, 0, 300], [-9, 0, 9])}deg` }] }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1000 }, { rotateY: `${180 + flip.value * 180}deg` }] }));

  return <GestureDetector gesture={Gesture.Race(pan, longPress, tap)}>
    <Animated.View style={[styles.wrapper, motion]} accessibilityLabel={`${card.title}，点击翻面，长按阅读`}>
      <View style={styles.stackOne} />
      <View style={styles.stackTwo} />
      <Animated.View style={[styles.card, styles.face, front]}>
        <View style={styles.cornerRow}>
          <Text style={styles.corner}>NOESIS  /  {card.id.slice(0, 4).toUpperCase()}</Text>
          <Text style={styles.corner}>✦</Text>
        </View>
        <Text style={styles.symbol}>✦</Text>
        <Text numberOfLines={4} style={styles.title}>{card.title}</Text>
        <Text style={styles.foot}>点击翻面 · 左右滑动</Text>
      </Animated.View>
      <Animated.View style={[styles.card, styles.face, styles.back, back]}>
        <Text style={styles.corner}>思想卡片  /  {card.id.slice(0, 4).toUpperCase()}</Text>
        <Text numberOfLines={3} style={styles.title}>{card.title}</Text>
        <Text numberOfLines={8} style={styles.content}>{card.content || '尚未写下正文'}</Text>
        <Text style={styles.foot}>长按阅读全文</Text>
      </Animated.View>
    </Animated.View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', aspectRatio: 5 / 7, maxHeight: 460, alignSelf: 'center', marginVertical: 18 },
  stackOne: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#c4b69d', borderRadius: 22, transform: [{ rotate: '-3deg' }, { translateY: 5 }] },
  stackTwo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#d9ccb3', borderRadius: 22, transform: [{ rotate: '2deg' }, { translateY: 3 }] },
  card: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 22, padding: 24, backgroundColor: '#f4eddf', borderWidth: 4, borderColor: '#a88c61', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: .24, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  face: { backfaceVisibility: 'hidden' },
  back: { backgroundColor: '#e9dfcd' },
  cornerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  corner: { color: '#816e50', fontSize: 11, letterSpacing: 1.5 },
  symbol: { textAlign: 'center', fontSize: 76, color: '#9a7a4a' },
  title: { fontSize: 25, fontWeight: '600', color: '#344039', textAlign: 'center', lineHeight: 34 },
  content: { fontSize: 15, color: '#4e584f', lineHeight: 25, textAlign: 'center' },
  foot: { textAlign: 'center', color: '#80715a', fontSize: 11, letterSpacing: 1 },
});
