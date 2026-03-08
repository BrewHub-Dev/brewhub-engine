import { Expo } from 'expo-server-sdk';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || '' });

export async function sendPushNotification(
    pushTokens: string[],
    title: string,
    body: string,
    data: Record<string, any> = {}
) {
    if (!pushTokens || pushTokens.length === 0) return;

    const validTokens = pushTokens.filter(token => Expo.isExpoPushToken(token));
    if (validTokens.length === 0) {
        console.warn('[Push] No valid Expo push tokens found.');
        return;
    }

    const messages = validTokens.map(token => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data,
    }));

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('[Push] Sent chunk:', ticketChunk);
        } catch (error) {
            console.error('[Push] Error sending chunk:', error);
        }
    }
}
