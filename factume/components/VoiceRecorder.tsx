import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, Radius, Spacing } from '../constants/Colors';

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  disabled?: boolean;
  mode?: 'create' | 'edit';
  accentColor?: string;
  exampleText?: string;
}

type RecordingState = 'idle' | 'recording' | 'processing';

const NUM_BARS = 9;

export default function VoiceRecorder({ onRecordingComplete, disabled = false, mode = 'create', accentColor = Colors.primary, exampleText }: VoiceRecorderProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const outerPulse = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.15))
  ).current;
  const durationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startAnimations = () => {
    // Pulsation du bouton
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();

    // Anneau extérieur qui s'étend
    Animated.loop(
      Animated.sequence([
        Animated.timing(outerPulse, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(outerPulse, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // Barres ondes sonores avec hauteurs variées
    const barHeights = [0.3, 0.6, 0.9, 0.7, 1.0, 0.7, 0.9, 0.6, 0.3];
    waveLoops.current = waveAnims.map((anim, i) => {
      const maxH = barHeights[i] || 0.5;
      const speed = 300 + i * 60;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: maxH,
            duration: speed,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.15,
            duration: speed,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });
  };

  const stopAnimations = () => {
    pulseLoop.current?.stop();
    waveLoops.current.forEach((l) => l.stop());
    pulseAnim.stopAnimation(() => pulseAnim.setValue(1));
    outerPulse.stopAnimation(() => outerPulse.setValue(1));
    waveAnims.forEach((a) => {
      a.stopAnimation();
      Animated.timing(a, { toValue: 0.15, duration: 300, useNativeDriver: true }).start();
    });
  };

  const startRecording = async () => {
    if (disabled) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('voice.permissionTitle'), t('voice.permissionMsg'));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      setRecording(rec);
      setState('recording');
      setDuration(0);
      durationRef.current = 0;

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);

      startAnimations();
    } catch (e) {
      Alert.alert(t('voice.errorMicTitle'), t('voice.errorMicMsg'));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAnimations();
    setState('processing');

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error('Enregistrement vide');
      const finalDuration = durationRef.current;
      setState('idle');
      setDuration(0);
      onRecordingComplete(uri, finalDuration);
    } catch {
      setState('idle');
      Alert.alert(t('voice.errorStopTitle'), t('voice.errorStopMsg'));
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const btnColor = isRecording ? Colors.danger : isProcessing ? Colors.gray400 : accentColor;

  return (
    <View style={styles.container}>
      {/* Barres waveform */}
      <View style={styles.waveform}>
        {waveAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.waveBar,
              {
                backgroundColor: isRecording ? Colors.danger : accentColor,
                transform: [{ scaleY: anim }],
              },
            ]}
          />
        ))}
      </View>

      {/* Label durée */}
      <View style={styles.durationRow}>
        {isRecording && (
          <Ionicons name="radio-button-on" size={14} color={Colors.danger} style={{ marginRight: 5 }} />
        )}
        <Text style={[styles.durationText, { color: accentColor }, isRecording && { color: Colors.danger }]}>
          {isRecording ? formatDuration(duration) : isProcessing ? 'Analyse en cours...' : ''}
        </Text>
      </View>

      {/* Bouton principal */}
      <View style={styles.buttonArea}>
        {/* Anneau d'onde externe (visible pendant l'enregistrement) */}
        {isRecording && (
          <Animated.View
            style={[
              styles.outerRing,
              { borderColor: Colors.danger + '30', transform: [{ scale: outerPulse }] },
            ]}
          />
        )}
        {/* Anneau interne pulse */}
        <Animated.View
          style={[
            styles.innerRing,
            { borderColor: (isRecording ? Colors.danger : accentColor) + '40', transform: [{ scale: pulseAnim }] },
          ]}
        />

        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || disabled}
          activeOpacity={0.85}
        >
          <View style={[styles.button, { backgroundColor: btnColor, shadowColor: btnColor }]}>
            {isProcessing ? (
              <ActivityIndicator size="large" color={Colors.white} />
            ) : isRecording ? (
              <Ionicons name="stop" size={38} color={Colors.white} />
            ) : (
              <Ionicons name="mic" size={40} color={Colors.white} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Instructions contextuelles */}
      <View style={styles.instructionBox}>
        {isRecording ? (
          <Text style={styles.instructionActive}>{t('voice.recording')}</Text>
        ) : isProcessing ? (
          <Text style={styles.instructionSub}>
            {mode === 'edit' ? t('voice.processingEdit') : t('voice.processingCreate')}
          </Text>
        ) : mode === 'edit' ? (
          <>
            <Text style={styles.instructionTitle}>{t('voice.editTitle')}</Text>
            <View style={[styles.instructionExample, { borderColor: accentColor + '30', backgroundColor: accentColor + '08' }]}>
              <Ionicons name="bulb-outline" size={15} color={accentColor} style={{ marginTop: 1, marginRight: 6 }} />
              <Text style={styles.instructionExampleText}>{t('voice.editExample')}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.instructionTitle}>{t('voice.createTitle')}</Text>
            <View style={[styles.instructionExample, { borderColor: accentColor + '30', backgroundColor: accentColor + '08' }]}>
              <Ionicons name="bulb-outline" size={15} color={accentColor} style={{ marginTop: 1, marginRight: 6 }} />
              <Text style={styles.instructionExampleText}>
                {exampleText || t('voice.createExampleDefault')}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    width: '100%',
  },
  // Waveform
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 48,
  },
  waveBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  durationText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
  // Bouton
  buttonArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  outerRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
  },
  innerRing: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 2,
  },
  button: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  // Instructions
  instructionBox: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    maxWidth: 320,
  },
  instructionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  instructionActive: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.danger,
    textAlign: 'center',
  },
  instructionExample: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  instructionExampleText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 20,
  },
  instructionSub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
