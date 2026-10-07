import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as dotenv from 'dotenv';

dotenv.config();

export const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const PROPERTY_ID = process.env.GA4_PROPERTY_ID!;
