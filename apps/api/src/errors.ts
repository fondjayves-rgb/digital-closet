export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireResult<T>(result: { data: T | null; error: { code?: string; message?: string } | null }): NonNullable<T> {
  if (result.error) {
    const code = result.error.code;
    if (code === '23505') throw new HttpError(409, 'This record already exists. Refresh and try again.');
    if (code === '23503' || code === '23514' || code === '42501' || code === 'P0001') throw new HttpError(400, 'The operation is not allowed for these records. Refresh your closet and try again.');
    if (code === 'PGRST116') throw new HttpError(404, 'Record not found.');
    throw new HttpError(503, 'Database unavailable. Check the Supabase connection and apply the database migration.');
  }
  if (result.data === null) throw new HttpError(404, 'Record not found.');
  return result.data as NonNullable<T>;
}
