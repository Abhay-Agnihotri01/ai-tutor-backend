
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    try {
        console.log('Testing Fix Query...');

        // logic: get instructors with their courses, and for each course, get enrollment count
        /*
          .select(`
            id, firstName, lastName,
            courses (
              id,
              enrollments (count)
            )
          `)
        */

        const { data: topInstructors, error: queryError } = await supabase
            .from('users')
            .select(`
        id, firstName, lastName,
        courses (
          id,
          enrollments (count)
        )
      `)
            .eq('role', 'instructor')
            .limit(5);

        if (queryError) {
            console.error('Fix Query failed:', queryError);
        } else {
            console.log('Fix Query success:', JSON.stringify(topInstructors, null, 2));

            // Simulate the mapping logic to see if we get the numbers
            const mapped = topInstructors.map(instructor => ({
                ...instructor,
                coursesCount: instructor.courses?.length || 0,
                studentsCount: instructor.courses?.reduce((sum, course) =>
                    sum + (course.enrollments?.length || course.enrollments[0]?.count || 0), 0) || 0
            }));
            console.log('Mapped Result:', mapped);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

testQuery();
