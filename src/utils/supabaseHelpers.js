import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

// Helper function to generate UUID
export const generateId = () => uuidv4();

// Helper function to handle Supabase errors
export const handleSupabaseError = (error, operation) => {
  console.error(`${operation} error:`, error);
  throw new Error(error.message || `${operation} failed`);
};

// Helper function to get current timestamp
export const getCurrentTimestamp = () => new Date().toISOString();