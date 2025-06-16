import fetch from 'node-fetch';

const EXPO_SERVER_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotification(token, message) {
  const messageData = {
    to: token,
    title: message.title,
    body: message.body,
    sound: 'default',
    priority: 'high',
    data: message.data || {},
  };

  try {
    const response = await fetch(EXPO_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Error sending push notification:', data);
      throw new Error(data.message || 'Failed to send notification');
    }
    return data;
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    throw error;
  }
}
