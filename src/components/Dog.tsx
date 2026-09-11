import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

export type DogMood = 'normal' | 'happy' | 'side-eye';
export type DogPose = 'sit' | 'wave' | 'talk' | 'judge';

type Props = {
  size?: number;
  mood?: DogMood;
  pose?: DogPose;
  speaking?: boolean;
};

const ink = '#493326';
const fur = '#EAB653';
const furTop = '#F7D477';
const ear = '#A96737';
const innerEar = '#D99A79';
const cream = '#FFF1CC';
const pink = '#EB8F91';
const collar = '#6FA9BE';

export function Dog({ size = 96, mood = 'normal', pose = 'sit', speaking = false }: Props) {
  const motion = useRef(new Animated.Value(0)).current;
  const [mouthOpen, setMouthOpen] = useState(false);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!speaking) {
      motion.stopAnimation();
      motion.setValue(0);
      setMouthOpen(false);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(motion, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(380),
      ]),
    );
    loop.start();
    const mouthTimer = setInterval(() => setMouthOpen((value) => !value), 210);
    return () => {
      loop.stop();
      clearInterval(mouthTimer);
    };
  }, [motion, speaking]);

  useEffect(() => {
    const blinkTimer = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 130);
    }, 3200);
    return () => clearInterval(blinkTimer);
  }, []);

  const animatedStyle = {
    transform: [
      { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) },
      { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', pose === 'judge' ? '-1.5deg' : '1.5deg'] }) },
    ],
  };

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`原创小狗豆包，${mood === 'happy' ? '开心' : mood === 'side-eye' ? '有点无语' : '认真'}地${speaking ? '说话' : '坐着'}`}>
      <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="bodyFur" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={furTop} />
              <Stop offset="1" stopColor={fur} />
            </LinearGradient>
          </Defs>

          <Ellipse cx="101" cy="188" rx="49" ry="7" fill="#6D4932" opacity="0.13" />

          <Path d="M140 144c26-5 33-28 22-35-9-6-17 6-10 14" fill="none" stroke={ink} strokeWidth="15" strokeLinecap="round" />
          <Path d="M140 144c24-5 30-26 22-33" fill="none" stroke={fur} strokeWidth="9" strokeLinecap="round" />

          <Path d="M69 119c8-14 20-20 32-20s25 6 32 20l13 43c4 15-7 25-22 25H78c-15 0-26-10-22-25z" fill="url(#bodyFur)" stroke={ink} strokeWidth="4.5" strokeLinejoin="round" />
          <Path d="M84 126c9-8 25-8 34 0l9 34c3 10-5 17-16 17H91c-11 0-19-7-16-17z" fill={cream} opacity="0.9" />

          {pose === 'wave' ? (
            <>
              <Path d="M66 130c-17-6-28-17-25-27 2-8 12-8 17-1 5 7 7 15 14 20" fill="url(#bodyFur)" stroke={ink} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx="42" cy="100" r="8" fill={furTop} stroke={ink} strokeWidth="4" />
              <Path d="M41 94v-7M36 96l-5-5M46 96l6-5" stroke={ink} strokeWidth="3" strokeLinecap="round" />
              <Path d="M132 136c9 6 12 14 8 20" fill="none" stroke={ink} strokeWidth="13" strokeLinecap="round" />
              <Path d="M132 136c9 6 12 14 8 20" fill="none" stroke={furTop} strokeWidth="7" strokeLinecap="round" />
            </>
          ) : pose === 'judge' ? (
            <>
              <Path d="M68 137c13 2 23 9 32 17" fill="none" stroke={ink} strokeWidth="15" strokeLinecap="round" />
              <Path d="M68 137c13 2 23 9 32 17" fill="none" stroke={furTop} strokeWidth="9" strokeLinecap="round" />
              <Path d="M133 137c-13 2-23 9-32 17" fill="none" stroke={ink} strokeWidth="15" strokeLinecap="round" />
              <Path d="M133 137c-13 2-23 9-32 17" fill="none" stroke={furTop} strokeWidth="9" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Path d="M68 137c-8 10-10 22-5 31" fill="none" stroke={ink} strokeWidth="15" strokeLinecap="round" />
              <Path d="M68 137c-8 10-10 22-5 31" fill="none" stroke={furTop} strokeWidth="9" strokeLinecap="round" />
              <Path d="M133 137c8 10 10 22 5 31" fill="none" stroke={ink} strokeWidth="15" strokeLinecap="round" />
              <Path d="M133 137c8 10 10 22 5 31" fill="none" stroke={furTop} strokeWidth="9" strokeLinecap="round" />
            </>
          )}

          <Path d="M71 174c-12 0-18 6-17 12h32c1-7-5-12-15-12z" fill={cream} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M130 174c12 0 18 6 17 12h-32c-1-7 5-12 15-12z" fill={cream} stroke={ink} strokeWidth="4" strokeLinejoin="round" />

          <Path d="M61 52C43 19 21 25 25 57c2 17 13 31 31 35l17-31z" fill={ear} stroke={ink} strokeWidth="5" strokeLinejoin="round" />
          <Path d="M140 52c18-33 40-27 36 5-2 17-13 31-31 35l-17-31z" fill={ear} stroke={ink} strokeWidth="5" strokeLinejoin="round" />
          <Path d="M48 46c-9-10-15-3-12 10 2 9 8 17 17 20" fill={innerEar} opacity="0.72" />
          <Path d="M153 46c9-10 15-3 12 10-2 9-8 17-17 20" fill={innerEar} opacity="0.72" />

          <Path d="M42 70c0-34 23-55 59-55s59 21 59 55v17c0 32-23 52-59 52S42 119 42 87z" fill="url(#bodyFur)" stroke={ink} strokeWidth="5" />
          <Path d="M77 20c6-13 17-13 23-2 7-11 18-8 21 5" fill={furTop} stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M58 62c7-22 24-33 43-35" fill="none" stroke="#FFE59A" strokeWidth="8" strokeLinecap="round" opacity="0.62" />
          <Path d="M94 27c4-4 10-4 14 0l-3 26h-8z" fill={cream} opacity="0.9" />

          <Ellipse cx="88" cy="92" rx="28" ry="24" fill={cream} />
          <Ellipse cx="114" cy="92" rx="28" ry="24" fill={cream} />
          <Ellipse cx="66" cy="96" rx="10" ry="6" fill={pink} opacity="0.42" />
          <Ellipse cx="136" cy="96" rx="10" ry="6" fill={pink} opacity="0.42" />

          {mood === 'side-eye' ? (
            <>
              <Path d="M63 61c8-5 17-4 23 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
              <Path d="M116 58c9-2 17 1 22 6" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
            </>
          ) : mood === 'happy' ? (
            <>
              <Path d="M65 65c6-7 14-7 20 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
              <Path d="M117 65c6-7 14-7 20 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Path d="M65 61c6-3 13-3 19 0" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
              <Path d="M118 61c6-3 13-3 19 0" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
            </>
          )}

          {blinking ? (
            <>
              <Path d="M68 75h16" stroke={ink} strokeWidth="4" strokeLinecap="round" />
              <Path d="M119 75h16" stroke={ink} strokeWidth="4" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Ellipse cx={mood === 'side-eye' ? 80 : 76} cy="75" rx="5.5" ry="7" fill={ink} />
              <Ellipse cx={mood === 'side-eye' ? 133 : 127} cy="75" rx="5.5" ry="7" fill={ink} />
              <Circle cx={mood === 'side-eye' ? 78.5 : 74.5} cy="72.5" r="1.6" fill="#FFFFFF" />
              <Circle cx={mood === 'side-eye' ? 131.5 : 125.5} cy="72.5" r="1.6" fill="#FFFFFF" />
            </>
          )}

          <Path d="M91 87c3-7 17-7 20 0 1 6-4 10-10 10s-11-4-10-10z" fill={ink} />
          <Path d="M101 96v5" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />

          {speaking && mouthOpen ? (
            <>
              <Ellipse cx="101" cy="108" rx="11" ry="9" fill={ink} />
              <Path d="M95 112c4-3 8-3 12 0" stroke={pink} strokeWidth="4" strokeLinecap="round" />
            </>
          ) : mood === 'happy' ? (
            <Path d="M87 104c7 12 21 12 28 0" fill="#FFFFFF" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
          ) : mood === 'side-eye' ? (
            <Path d="M92 108c7-2 15-2 22 0" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
          ) : (
            <Path d="M88 104c5 8 10 8 13 1 3 7 8 7 13-1" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          <Path d="M57 122c25 10 63 10 88 0" fill="none" stroke={collar} strokeWidth="8" strokeLinecap="round" />
          <Circle cx="101" cy="127" r="7" fill="#4E7E92" stroke={ink} strokeWidth="2.5" />
          <Path d="M101 132c-9-7-18 4-10 12l10 9 10-9c8-8-1-19-10-12z" fill={pink} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}
