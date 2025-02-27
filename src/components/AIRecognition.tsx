// import React, { useState, useRef } from 'react';
// import { StyleSheet, View, Text, TouchableOpacity, Platform, PermissionsAndroid } from 'react-native';
// import AudioRecorderPlayer from 'react-native-audio-recorder-player';
// // import { Camera } from 'react-native-vision-camera';

// interface AIRecognitionProps {
//   onResult?: (result: string) => void;
// }

// export default function AIRecognition({ onResult }: AIRecognitionProps) {
//   const [isRecording, setIsRecording] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
//   const [result, setResult] = useState<string | null>(null);
//   const audioRecorder = useRef(new AudioRecorderPlayer());
//   // const cameraRef = useRef<Camera | null>(null);

//   const requestPermissions = async (type: 'audio' | 'video') => {
//     if (Platform.OS === 'android') {
//       const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
//       if (type === 'video') {
//         permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
//       }
      
//       const granted = await PermissionsAndroid.requestMultiple(permissions);
//       return Object.values(granted).every(
//         permission => permission === PermissionsAndroid.RESULTS.GRANTED
//       );
//     }
//     return true;
//   };

//   const startRecording = async (type: 'audio' | 'video') => {
//     try {
//       const hasPermission = await requestPermissions(type);
//       if (!hasPermission) {
//         console.error('Permission not granted');
//         return;
//       }

//       if (type === 'audio') {
//         const result = await audioRecorder.startRecorder();
//         console.log(result);
//       } else {
//         // Start video recording using vision-camera
//         if (cameraRef.current) {
//           await cameraRef.current.startRecording({
//             onRecordingFinished: (video) => processRecording(video, 'video'),
//             onRecordingError: (error) => console.error(error),
//           });
//         }
//       }

//       setIsRecording(true);
//       setRecordingType(type);
//       setResult(null);
//     } catch (error) {
//       console.error('Error starting recording:', error);
//     }
//   };

//   const stopRecording = async () => {
//     try {
//       if (recordingType === 'audio') {
//         const result = await audioRecorder.stopRecorder();
//         processRecording(result, 'audio');
//       } else if (recordingType === 'video' && cameraRef.current) {
//         await cameraRef.current.stopRecording();
//       }
//     } catch (error) {
//       console.error('Error stopping recording:', error);
//     } finally {
//       setIsRecording(false);
//       setRecordingType(null);
//     }
//   };

//   const processRecording = async (filePath: string, type: 'audio' | 'video') => {
//     setIsProcessing(true);

//     try {
//       const formData = new FormData();
//       formData.append('file', {
//         uri: filePath,
//         type: type === 'video' ? 'video/mp4' : 'audio/m4a',
//         name: 'recording.' + (type === 'video' ? 'mp4' : 'm4a'),
//       });
//       formData.append('type', type);

//       const response = await fetch('/api/process-media', {
//         method: 'POST',
//         body: formData,
//       });

//       if (!response.ok) {
//         throw new Error('Processing failed');
//       }

//       const data = await response.json();
//       setResult(data.result);
//       onResult?.(data.result);
//     } catch (error) {
//       console.error('Error processing recording:', error);
//       setResult('Error processing the recording');
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>AI Recognition</Text>

//       <View style={styles.buttonContainer}>
//         <TouchableOpacity
//           style={[
//             styles.button,
//             recordingType === 'audio' && styles.recordingButton,
//             (isRecording || isProcessing) && styles.disabledButton,
//           ]}
//           onPress={() => startRecording('audio')}
//           disabled={isRecording || isProcessing}
//         >
//           <Text style={styles.buttonText}>
//             {recordingType === 'audio' ? 'Stop Recording' : 'Record Audio'}
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={[
//             styles.button,
//             recordingType === 'video' && styles.recordingButton,
//             (isRecording || isProcessing) && styles.disabledButton,
//           ]}
//           onPress={() => startRecording('video')}
//           disabled={isRecording || isProcessing}
//         >
//           <Text style={styles.buttonText}>
//             {recordingType === 'video' ? 'Stop Recording' : 'Record Video'}
//           </Text>
//         </TouchableOpacity>
//       </View>

//       {isRecording && (
//         <TouchableOpacity
//           style={styles.stopButton}
//           onPress={stopRecording}
//         >
//           <Text style={styles.buttonText}>Stop Recording</Text>
//         </TouchableOpacity>
//       )}

//       {isProcessing && (
//         <View style={styles.processingContainer}>
//           <Text style={styles.processingText}>Processing...</Text>
//         </View>
//       )}

//       {result && (
//         <View style={styles.resultContainer}>
//           <Text style={styles.resultTitle}>Recognition Result:</Text>
//           <Text style={styles.resultText}>{result}</Text>
//         </View>
//       )}

//       {recordingType === 'video' && (
//         <Camera
//           ref={cameraRef}
//           style={styles.camera}
//           device="back"
//           isActive={recordingType === 'video'}
//         />
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     padding: 16,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     marginBottom: 24,
//   },
//   buttonContainer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     gap: 16,
//     marginBottom: 16,
//   },
//   button: {
//     backgroundColor: '#007AFF',
//     padding: 12,
//     borderRadius: 8,
//     minWidth: 120,
//     alignItems: 'center',
//   },
//   recordingButton: {
//     backgroundColor: '#FF3B30',
//   },
//   disabledButton: {
//     opacity: 0.5,
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   stopButton: {
//     backgroundColor: '#FF9500',
//     padding: 12,
//     borderRadius: 8,
//     minWidth: 120,
//     alignItems: 'center',
//     marginTop: 16,
//   },
//   processingContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 16,
//   },
//   processingText: {
//     color: '#8E8E93',
//     fontSize: 16,
//   },
//   resultContainer: {
//     backgroundColor: '#F2F2F7',
//     padding: 16,
//     borderRadius: 8,
//     marginTop: 16,
//     width: '100%',
//   },
//   resultTitle: {
//     fontSize: 16,
//     fontWeight: '600',
//     marginBottom: 8,
//   },
//   resultText: {
//     fontSize: 14,
//   },
//   camera: {
//     width: '100%',
//     height: 200,
//     marginTop: 16,
//   },
// });