// AdminSession utility functions for Supabase
import supabase from '../config/supabase.js';

export const AdminSession = {
  async create(data) {
    const { data: result, error } = await supabase
      .from('admin_sessions')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }
};

export default AdminSession;