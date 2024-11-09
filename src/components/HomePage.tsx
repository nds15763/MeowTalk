import React from 'react';
import { Text, View, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import tw from 'twrnc';

export default function HomePage() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={tw`flex-1 bg-background`}>
      <View style={tw`absolute inset-0 opacity-30 z-0`}>
        <Image 
          source={require('../../images/home-back.png')} 
          style={tw`w-full h-full`}
          resizeMode="repeat"
        />
      </View>
      
      <View style={tw`flex-1 items-center justify-center p-5 z-10`}>
        <View style={tw`w-[300px] h-[300px] rounded-full overflow-hidden mb-8`}>
          <Image
            source={require('../../images/cat_logo.png')}
            style={tw`w-full h-full`}
            resizeMode="cover"
          />
        </View>
        
        <Text style={tw`text-[40px] font-montserrat font-bold text-[#000958] text-center mb-5`}>
          Meow Talker
        </Text>
        
        <Text style={tw`text-[20px] font-dm-sans text-[#000958] text-center mb-10`}>
          Want to Know {'\n'}
          What Your Cat is Saying?
        </Text>
        
        <TouchableOpacity
          style={[
            tw`
              w-[159px] 
              h-[64px] 
              rounded-[100px] 
              justify-center 
              items-center 
              px-2
              shadow-button
              active:scale-95 
              transition-all
              z-20
            `,
            { backgroundColor: '#ff5b2e' }
          ]}
          onPress={() => navigation.navigate('Chat' as never)}
        >
          <Text style={tw`
            text-white 
            font-red-hat 
            text-[24px] 
            font-bold 
            leading-[32px]
          `}>
            Talk Now
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

