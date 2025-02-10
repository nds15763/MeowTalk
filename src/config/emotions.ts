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
    audioFiles: [
      require('../../audios/call_1.mp3'),
      require('../../audios/call_2.mp3'),
      require('../../audios/call_3.mp3'),
      require('../../audios/call_4.mp3'),
      require('../../audios/call_5.mp3'),
    ],
    categoryId: 'friendly',
  },
  {
    id: 'comfortable',
    icon: '😌',
    title: 'Comfortable',
    description: 'Your cat feels comfortable and relaxed',
    audioFiles: [
      require('../../audios/comfortable_1.mp3'),
    ],
    categoryId: 'friendly',
  },
  {
    id: 'flighty',
    icon: '🥰',
    title: 'Affectionate',
    description: 'Affectionately calling to other cats',
    audioFiles: [
      require('../../audios/flighty_1.mp3'),
      require('../../audios/flighty_2.mp3'),
    ],
    categoryId: 'friendly',
  },
  {
    id: 'satisfy',
    icon: '😊',
    title: 'Satisfied',
    description: 'Feeling satisfied',
    audioFiles: [
      require('../../audios/satisfy_1.mp3'),
      require('../../audios/satisfy_2.mp3'),
    ],
    categoryId: 'friendly',
  },
  {
    id: 'yummy',
    icon: '😋',
    title: 'Delicious',
    description: 'Enjoying tasty food',
    audioFiles: [
      require('../../audios/yummy_1.mp3'),
      require('../../audios/yummy_2.mp3'),
      require('../../audios/yummy_3.mp3'),
    ],
    categoryId: 'friendly',
  },
  {
    id: 'hello',
    icon: '👋',
    title: 'Greeting',
    description: 'Friendly greeting and being affectionate',
    audioFiles: [
      require('../../audios/hello_1.mp3'),
      require('../../audios/hello_2.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'for_food',
    icon: '🍽️',
    title: 'Food Request',
    description: 'Greeting and requesting food',
    audioFiles: [
      require('../../audios/for-food_1.mp3'),
      require('../../audios/for-food_2.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'ask_for_play',
    icon: '🎭',
    title: 'Play Invitation',
    description: 'Inviting to play',
    audioFiles: [
      require('../../audios/ask-for-play_1.mp3'),
      require('../../audios/ask-for-play_2.mp3'),
      require('../../audios/ask-for-play_3.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'ask_for_hunting',
    icon: '🐁',
    title: 'Hunt Invitation',
    description: 'Excited, wanting to hunt',
    audioFiles: [
      require('../../audios/ask-for-hunting_1.mp3'),
      require('../../audios/ask-for-hunting_2.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'discomfort',
    icon: '😣',
    title: 'Distressed',
    description: 'Feeling upset, uncomfortable, leave me alone',
    audioFiles: [
      require('../../audios/discomfort_1.mp3'),
      require('../../audios/discomfort_2.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'find_mom',
    icon: '🐈',
    title: 'Help/Finding Mom',
    description: 'Seeking help or looking for mom',
    audioFiles: [
      require('../../audios/find_mom.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'anxious',
    icon: '😰',
    title: 'Anxious/Scared',
    description: 'Feeling anxious or scared',
    audioFiles: [
      require('../../audios/anxious_1.mp3'),
      require('../../audios/anxious_2.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'courtship',
    icon: '💕',
    title: 'Mating Call',
    description: 'Looking for a mate',
    audioFiles: [
      require('../../audios/courtship_1.mp3'),
      require('../../audios/courtship_2.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'curious',
    icon: '🤔',
    title: 'Curious',
    description: 'Being perfunctory or curious',
    audioFiles: [
      require('../../audios/curious_1.mp3'),
      require('../../audios/curious_2.mp3'),
      require('../../audios/curious_3.mp3'),
    ],
    categoryId: 'attention',
  },
  {
    id: 'goaway',
    icon: '🚫',
    title: 'Go Away!',
    description: 'Go away!',
    audioFiles: [
      require('../../audios/goaway_1.mp3'),
      require('../../audios/goaway_2.mp3'),
    ],
    categoryId: 'warning',
  },
  {
    id: 'goout',
    icon: '👉',
    title: 'Get Out!',
    description: 'Get out!',
    audioFiles: [
      require('../../audios/goout_1.mp3'),
      require('../../audios/goout_2.mp3'),
    ],
    categoryId: 'warning',
  },
  {
    id: 'dieaway',
    icon: '💀',
    title: 'Back Off!',
    description: 'Back off immediately!',
    audioFiles: [
      require('../../audios/dieaway_1.mp3'),
      require('../../audios/dieaway_2.mp3'),
    ],
    categoryId: 'warning',
  },
  {
    id: 'warning',
    icon: '⚠️',
    title: 'Warning',
    description: 'Warning and expulsion',
    audioFiles: [
      require('../../audios/warning_1.mp3'),
      require('../../audios/warning_2.mp3'),
    ],
    categoryId: 'warning',
  },
  {
    id: 'unhappy',
    icon: '😒',
    title: 'Unhappy',
    description: 'Leave me alone, dissatisfied',
    audioFiles: [
      require('../../audios/unhappy_1.mp3'),
      require('../../audios/unhappy_2.mp3'),
    ],
    categoryId: 'warning',
  },
  {
    id: 'alert',
    icon: '🚨',
    title: 'Alert',
    description: 'Hostile and vigilant',
    audioFiles: [
      require('../../audios/alert_1.mp3'),
    ],
    categoryId: 'warning',
  },
  {
    id: 'for_fight',
    icon: '🥊',
    title: 'Strong Warning',
    description: 'Strong warning, preparing to fight',
    audioFiles: [
      require('../../audios/for-fight_1.mp3'),
      require('../../audios/for-fight_2.mp3'),
    ],
    categoryId: 'warning',
  },
];
