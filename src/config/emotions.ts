import { Emotion, EmotionCategory } from '../types/emotion';

export const emotionCategories: EmotionCategory[] = [
  {
    id: 'friendly',
    title: 'Friendly',
    description: 'Cat feels pleased, content, or friendly',
  },
  {
    id: 'attention',
    title: 'Attention',
    description: 'Cat wants to get your attention',
  },
  {
    id: 'warning',
    title: 'Warning',
    description: 'Cat feels anxious, angry, or wants to warn',
  },
];

export const emotions: Emotion[] = [
  {
    id: 'call',
    icon: '😺',
    title: 'Friendly Call',
    description: 'Friendly calling to other cats',
    audioFile: require('../../audios/call.mp3'),
    categoryId: 'friendly',
  },
  {
    id: 'comfortable',
    icon: '😌',
    title: 'Comfortable',
    description: 'Your cat feels comfortable and relaxed',
    audioFile: require('../../audios/comfortable.mp3'),
    categoryId: 'friendly',
  },
  {
    id: 'flighty',
    icon: '🥰',
    title: 'Affectionate',
    description: 'Affectionately calling to other cats',
    audioFile: require('../../audios/flighty.mp3'),
    categoryId: 'friendly',
  },
  {
    id: 'satisfy',
    icon: '😊',
    title: 'Satisfied',
    description: 'Feeling satisfied',
    audioFile: require('../../audios/satisfy.mp3'),
    categoryId: 'friendly',
  },
  {
    id: 'yummy',
    icon: '😋',
    title: 'Delicious',
    description: 'Enjoying tasty food',
    audioFile: require('../../audios/yummy.mp3'),
    categoryId: 'friendly',
  },
  {
    id: 'hello',
    icon: '👋',
    title: 'Greeting',
    description: 'Friendly greeting and being affectionate',
    audioFile: require('../../audios/hello.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'for_food',
    icon: '🍽️',
    title: 'Food Request',
    description: 'Greeting and requesting food',
    audioFile: require('../../audios/for_food.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'ask_for_play',
    icon: '🎭',
    title: 'Play Invitation',
    description: 'Inviting to play',
    audioFile: require('../../audios/ask_for_play.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'ask_for_hunting',
    icon: '🐁',
    title: 'Hunt Invitation',
    description: 'Excited, wanting to hunt',
    audioFile: require('../../audios/ask_for_hunting.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'discomfort',
    icon: '😣',
    title: 'Distressed',
    description: 'Feeling upset, uncomfortable, leave me alone',
    audioFile: require('../../audios/discomfort.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'find_mom',
    icon: '🐈',
    title: 'Help/Finding Mom',
    description: 'Seeking help or looking for mom',
    audioFile: require('../../audios/find_mom.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'anxious',
    icon: '😰',
    title: 'Anxious/Scared',
    description: 'Feeling anxious or scared',
    audioFile: require('../../audios/anxious.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'courtship',
    icon: '💕',
    title: 'Mating Call',
    description: 'Looking for a mate',
    audioFile: require('../../audios/courtship.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'curious',
    icon: '🤔',
    title: 'Curious',
    description: 'Being perfunctory or curious',
    audioFile: require('../../audios/curious.mp3'),
    categoryId: 'attention',
  },
  {
    id: 'goaway',
    icon: '🚫',
    title: 'Go Away!',
    description: 'Go away!',
    audioFile: require('../../audios/goaway.mp3'),
    categoryId: 'warning',
  },
  {
    id: 'goout',
    icon: '👉',
    title: 'Get Out!',
    description: 'Get out!',
    audioFile: require('../../audios/goout.mp3'),
    categoryId: 'warning',
  },
  {
    id: 'dieaway',
    icon: '💀',
    title: 'Back Off!',
    description: 'Back off immediately!',
    audioFile: require('../../audios/dieaway.mp3'),
    categoryId: 'warning',
  },
  {
    id: 'warning',
    icon: '⚠️',
    title: 'Warning',
    description: 'Warning and expulsion',
    audioFile: require('../../audios/warning.mp3'),
    categoryId: 'warning',
  },
  {
    id: 'unhappy',
    icon: '😒',
    title: 'Unhappy',
    description: 'Leave me alone, dissatisfied',
    audioFile: require('../../audios/unhappy.mp3'),
    categoryId: 'warning',
  },
  {
    id: 'alert',
    icon: '🚨',
    title: 'Alert',
    description: 'Hostile and vigilant',
    audioFile: require('../../audios/alert.mp3'),
    categoryId: 'warning',
  },
  // {
  //   id: 'for_fight',
  //   icon: '🥊',
  //   title: 'Strong Warning',
  //   description: 'Strong warning, preparing to fight',
  //   audioFile: require('../../audios/for_fight.mp3'),
  //   categoryId: 'warning',
  // },
  // {
  //   id: 'scared',
  //   icon: '😱',
  //   title: 'Scared',
  //   description: 'Your cat feels scared or threatened.',
  //   audioFile: require('../../audios/scared_meow.mp3'),
  //   categoryId: 'warning',
  // },
];
