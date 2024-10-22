import { Emotion } from '../types/emotion';

export const emotions: Emotion[] = [
  {
    id: 'happy',
    icon: '😺',
    title: 'Happy',
    description: 'Your cat is content and feeling good.',
    audioFile: 'happy_meow.mp3',
  },
  {
    id: 'sad',
    icon: '😿',
    title: 'Sad',
    description: 'Your cat might be feeling down or unwell.',
    audioFile: 'sad_meow.mp3',
  },
  {
    id: 'angry',
    icon: '😠',
    title: 'Angry',
    description: 'Your cat is irritated or frustrated.',
    audioFile: 'angry_meow.mp3',
  },
  {
    id: 'playful',
    icon: '😺',
    title: 'Playful',
    description: 'Your cat is in a fun, energetic mood.',
    audioFile:'playful_meow.mp3',
  },
  {
    id: 'curious',
    icon: '🧐',
    title: 'Curious',
    description: 'Your cat is interested and exploring.',
    audioFile:'curious_meow.mp3',
  },
];

