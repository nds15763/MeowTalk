#发布web版本
npx expo export --platform web

#打包安卓
npm install --global eas-cli
eas build --platform android

#打包ios
eas build --platform ios

