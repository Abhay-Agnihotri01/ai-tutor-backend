// ActivityLog utility functions for Supabase
import supabase from '../config/supabase.js';

export const ActivityLog = {
  async create(data) {
    const { data: result, error } = await supabase
      .from('activity_logs')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async findAll(options = {}) {
    let query = supabase.from('activity_logs').select('*');
    
    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    if (options.order) {
      const [field, direction] = options.order[0];
      query = query.order(field, { ascending: direction === 'ASC' });
    }
    
    const { data, error, count } = await query;
    if (error) throw error;
    
    return { rows: data || [], count };
  }
};

export default ActivityLog;