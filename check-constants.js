const Audio = require('expo-av');

console.log('Available iOS Audio Quality Constants:');
Object.keys(Audio).filter(key => key.includes('RECORDING_OPTION_IOS_AUDIO_QUALITY')).forEach(key => {
  console.log(`  ${key}`);
});

console.log('\nAvailable iOS Output Format Constants:');
Object.keys(Audio).filter(key => key.includes('RECORDING_OPTION_IOS_OUTPUT_FORMAT')).forEach(key => {
  console.log(`  ${key}`);
});

console.log('\nAvailable Android Output Format Constants:');
Object.keys(Audio).filter(key => key.includes('RECORDING_OPTION_ANDROID_OUTPUT_FORMAT')).forEach(key => {
  console.log(`  ${key}`);
});

console.log('\nAvailable Android Audio Encoder Constants:');
Object.keys(Audio).filter(key => key.includes('RECORDING_OPTION_ANDROID_AUDIO_ENCODER')).forEach(key => {
  console.log(`  ${key}`);
});

console.log('\nAll Recording Option Presets:');
Object.keys(Audio).filter(key => key.startsWith('RECORDING_OPTIONS_')).forEach(key => {
  console.log(`  ${key}`);
});
