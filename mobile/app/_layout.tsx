import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

// TODO: centralized config
const API_URL = "https://nachos-backend-728473520070.us-central1.run.app";

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    // Create notification channel (required for Android)
    createNotificationChannel();

    // Request notification permissions
    requestNotificationPermissions();

    // TODO: For push notifications, you'll need to integrate Firebase Cloud Messaging
    // and send the FCM token to your backend instead of Expo push token
    // registerForPushNotificationsAsync().then(token => {
    //   if (token) {
    //     console.log("FCM Token:", token);
    //     sendTokenToBackend(token);
    //   }
    // });

    // Listen for notification events (foreground & background)
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('User pressed notification');
        // Handle notification tap
        const data = detail.notification?.data;
        if (data && data.url) {
          router.push(data.url as any);
        } else {
          router.push('/chat');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="focus/index"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen
        name="strategy/index"
        options={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      />
    </Stack>
  );
}

async function createNotificationChannel() {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: 'default',
      name: 'Default',
      importance: 4, // High importance
      vibration: true,
      vibrationPattern: [300, 500],
    });
  }
}

async function requestNotificationPermissions() {
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus === 1) { // AUTHORIZED
    console.log('Notification permissions granted');
  } else {
    console.log('Notification permissions denied');
  }
}

// TODO: Uncomment and implement when you add Firebase Cloud Messaging
// async function sendTokenToBackend(token: string) {
//   try {
//     await fetch(`${API_URL}/notifications/register-token`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ token }),
//     });
//     console.log("Token registered with backend");
//   } catch (error) {
//     console.error("Failed to register token:", error);
//   }
// }

// TODO: Implement FCM token registration for push notifications
// async function registerForPushNotificationsAsync() {
//   // You'll need to install @react-native-firebase/messaging
//   // and get the FCM token from there
//   return null;
// }
