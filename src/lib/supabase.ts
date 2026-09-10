// Mock data storage in-memory
const attendanceData: any[] = [];

// Create mock Supabase client
const mockClient = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: function(col: string, val: any) {
        return {
          eq: (col2: string, val2: any) => ({
            neq: (col3: string, val3: any) => ({
              limit: (n: number) => ({
                single: async () => {
                  const filtered = attendanceData.filter(item =>
                    item[col] === val && item[col2] === val2 && item[col3] !== val3
                  );
                  return { data: filtered[0] || null, error: null };
                }
              })
            }),
            single: async () => {
              const filtered = attendanceData.filter(item =>
                item[col] === val && item[col2] === val2
              );
              return { data: filtered[0] || null, error: null };
            }
          }),
          single: async () => {
            const filtered = attendanceData.filter(item => item[col] === val);
            return { data: filtered[0] || null, error: null };
          }
        };
      },
      single: async () => {
        return { data: attendanceData[0] || null, error: null };
      }
    }),
    insert: async (data: any) => {
      attendanceData.push({ id: Date.now(), ...data });
      return { error: null };
    }
  })
};

export const supabasePublic = mockClient as any;
export const supabaseAdmin = mockClient as any;