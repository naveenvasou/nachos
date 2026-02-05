import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// TODO: centralized config
const API_URL = "https://unsignificantly-logarithmic-deetta.ngrok-free.dev";

// 1. Configure Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Layout() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        console.log("Expo Push Token:", token);
        sendTokenToBackend(token);
      }
    });

    // Listen for notification received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification Received:", notification);
    });

    // Listen for user interacting with notification (tapping it)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("User tapped notification");
      // Check for deep link data
      const data = response.notification.request.content.data;
      if (data && data.url) {
        router.push(data.url);
      } else {
        router.push('/chat');
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
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

async function sendTokenToBackend(token: string) {
  try {
    await fetch(`${API_URL}/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    console.log("Token registered with backend");
  } catch (error) {
    console.error("Failed to register token:", error);
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
        ?? Constants.easConfig?.projectId;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        // Fallback for dev/Expo Go — try without explicit projectId
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }
    } catch (e) {
      console.log("Error getting push token:", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
