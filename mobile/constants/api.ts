// Centralized API configuration
// All API-related constants should be imported from here

export const API_URL = "https://nachos-backend-728473520070.us-central1.run.app";

// WebSocket URL derived from API URL
export const WS_URL = API_URL.replace(/^http/, 'ws');

// For local development (Android Emulator)
export const LOCAL_API_URL = "http://10.0.2.2:8000";

// Feature flags
export const USE_LOCAL_API = false;

// Helper to get the correct API URL based on environment
export function getApiUrl(): string {
    return USE_LOCAL_API ? LOCAL_API_URL : API_URL;
}

export function getWsUrl(): string {
    return USE_LOCAL_API ? LOCAL_API_URL.replace(/^http/, 'ws') : WS_URL;
}
